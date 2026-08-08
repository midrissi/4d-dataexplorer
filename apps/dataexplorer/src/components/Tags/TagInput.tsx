import { cn } from '@4d/ui'
import { Plus, Tags, X } from 'lucide-react'
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { measureSuggestionPlacement } from '~/components/QueryBuilder/AttributePathInput'
import { useTranslation } from '~/i18n'
import { MAX_FAVOURITE_TAGS, normalizeFavouriteTags } from '~/store/favourite-meta'
import { favouriteTagChipTone, isPredefinedFavouriteTag, useUsedTagsStore } from '~/store/used-tags'
import { TagChip } from './TagChip'

type SuggestionPlacement = ReturnType<typeof measureSuggestionPlacement>

function commitDraft(draft: string, selected: string[]): string[] | null {
  const next = normalizeFavouriteTags([...selected, draft])
  if (next.length === selected.length) return null
  return next.slice(0, MAX_FAVOURITE_TAGS)
}

/**
 * Reusable tag assigner: chip field + autocomplete from the shared used-tags store.
 * Enter / comma / Tab commit; Backspace removes the last chip when the draft is empty.
 *
 * Suggestions are portaled to `document.body` so overflow parents (lists, panels)
 * cannot clip the list. Option mousedown still commits before blur closes it.
 */
export function TagInput({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  className,
  max = MAX_FAVOURITE_TAGS,
  dense = false,
}: {
  value: readonly string[]
  onChange: (tags: string[]) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  max?: number
  /** Compact chrome for inline editors (no hint row, tighter field). */
  dense?: boolean
}) {
  const { t } = useTranslation()
  const listboxId = useId()
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurCloseRef = useRef<number | null>(null)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [placement, setPlacement] = useState<SuggestionPlacement | null>(null)

  const catalog = useUsedTagsStore((state) => state.tags)
  const suggest = useUsedTagsStore((state) => state.suggest)
  const forgetTag = useUsedTagsStore((state) => state.forgetTag)

  const suggestions = useMemo(() => {
    const matches = suggest(draft, value)
    const normalizedDraft = draft.trim()
    const alreadySelected = value.some((tag) => tag.toLowerCase() === normalizedDraft.toLowerCase())
    const known =
      catalog.some((tag) => tag.label.toLowerCase() === normalizedDraft.toLowerCase()) ||
      isPredefinedFavouriteTag(normalizedDraft)
    if (normalizedDraft && !alreadySelected && !known && value.length < max) {
      return [`__create__:${normalizedDraft}`, ...matches]
    }
    return matches
  }, [catalog, draft, max, suggest, value])

  const forgetCustomSuggestion = (label: string) => {
    cancelBlurClose()
    forgetTag(label)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const showList = open && !disabled && suggestions.length > 0 && value.length < max
  const safeIndex = suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1)

  useLayoutEffect(() => {
    if (!showList) {
      setPlacement(null)
      return
    }

    const updatePlacement = () => {
      const field = fieldRef.current
      if (!field) return
      setPlacement(measureSuggestionPlacement(field.getBoundingClientRect(), window.innerHeight))
    }

    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [showList])

  useEffect(() => {
    if (!showList) return
    document
      .getElementById(`${listboxId}-option-${safeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [safeIndex, listboxId, showList])

  const cancelBlurClose = () => {
    if (blurCloseRef.current != null) {
      window.clearTimeout(blurCloseRef.current)
      blurCloseRef.current = null
    }
  }

  const addTag = (raw: string) => {
    if (disabled || value.length >= max) return
    const label = raw.startsWith('__create__:') ? raw.slice('__create__:'.length) : raw
    const next = commitDraft(label, [...value])
    if (!next) return
    cancelBlurClose()
    onChange(next)
    setDraft('')
    setActiveIndex(0)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const removeAt = (index: number) => {
    if (disabled) return
    onChange(value.filter((_, i) => i !== index))
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (showList && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return (current + 1) % suggestions.length
        return (current - 1 + suggestions.length) % suggestions.length
      })
      return
    }

    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      if (event.key === 'Tab' && !draft.trim() && !showList) return
      event.preventDefault()
      if (showList && suggestions[safeIndex]) {
        addTag(suggestions[safeIndex])
        return
      }
      if (draft.trim()) addTag(draft)
      return
    }

    if (event.key === 'Backspace' && !draft && value.length > 0) {
      event.preventDefault()
      removeAt(value.length - 1)
    }
  }

  const atLimit = value.length >= max

  const listbox =
    showList && placement
      ? createPortal(
          <div
            id={listboxId}
            role="listbox"
            style={{
              position: 'fixed',
              top: placement.side === 'bottom' ? placement.top : undefined,
              bottom: placement.side === 'top' ? window.innerHeight - placement.top : undefined,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
            className={cn(
              'z-50 overflow-y-auto overscroll-contain rounded-md border border-border/80 bg-popover p-1 text-popover-foreground shadow-md',
              dense && 'text-xs'
            )}
          >
            {suggestions.map((item, index) => {
              const isCreate = item.startsWith('__create__:')
              const label = isCreate ? item.slice('__create__:'.length) : item
              const active = index === safeIndex
              const isPreset = !isCreate && isPredefinedFavouriteTag(label)
              const canForget =
                !isCreate &&
                !isPreset &&
                catalog.some((tag) => tag.label.toLowerCase() === label.toLowerCase())
              return (
                <div
                  key={item}
                  className={cn(
                    'group/option flex items-center gap-1 rounded-sm',
                    active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
                  )}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    id={`${listboxId}-option-${index}`}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 px-2 text-left transition-colors',
                      dense ? 'py-1' : 'py-1.5 text-sm'
                    )}
                    onMouseDown={(event) => {
                      // Keep focus on the input; commit before blur closes the list.
                      event.preventDefault()
                      addTag(item)
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {isCreate ? (
                      <>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        <span>{t('tags.createTag', { tag: label })}</span>
                      </>
                    ) : (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            'font-medium text-xs',
                            isPreset
                              ? 'text-sky-600 dark:text-sky-300'
                              : 'text-amber-700 dark:text-amber-300'
                          )}
                        >
                          #
                        </span>
                        <span className="min-w-0 truncate">{label}</span>
                      </>
                    )}
                  </button>
                  {isCreate ? null : canForget ? (
                    <button
                      type="button"
                      className={cn(
                        'group/forget mr-1.5 inline-flex h-5 min-w-14 shrink-0 items-center justify-center gap-0.5 rounded-sm px-1.5',
                        'font-medium text-[9px] uppercase tracking-wide transition-colors duration-150',
                        'bg-amber-500/15 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
                        'hover:bg-destructive/15 hover:text-destructive',
                        'focus-visible:bg-destructive/15 focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'group-hover/option:bg-destructive/15 group-hover/option:text-destructive'
                      )}
                      aria-label={t('tags.forgetSuggestion', { tag: label })}
                      title={t('tags.forgetSuggestion', { tag: label })}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        forgetCustomSuggestion(label)
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="inline-flex items-center gap-0.5 group-hover/option:hidden group-focus-visible/forget:hidden">
                        {t('tags.customBadge')}
                      </span>
                      <span className="hidden items-center gap-0.5 group-hover/option:inline-flex group-focus-visible/forget:inline-flex">
                        <X className="h-3 w-3" aria-hidden />
                        {t('tags.forgetBadge')}
                      </span>
                    </button>
                  ) : (
                    <span
                      className={cn(
                        'mr-1.5 inline-flex h-5 min-w-14 shrink-0 items-center justify-center rounded-sm px-1.5',
                        'font-medium text-[9px] uppercase tracking-wide',
                        'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      )}
                    >
                      {t('tags.presetBadge')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>,
          document.body
        )
      : null

  return (
    <div className={cn(dense ? 'space-y-0' : 'space-y-1.5', className)}>
      <div className="relative">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: click empty chrome focuses the tag input */}
        <div
          ref={fieldRef}
          className={cn(
            'flex w-full flex-wrap items-center gap-1.5 rounded-sm border border-input bg-background px-2 transition-shadow',
            dense ? 'min-h-7 gap-1 px-1.5 py-1' : 'min-h-9 py-1.5',
            dense
              ? 'focus-within:ring-1 focus-within:ring-ring focus-within:ring-inset'
              : 'focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              event.preventDefault()
              inputRef.current?.focus()
            }
          }}
        >
          {value.length === 0 && !draft ? (
            <Tags
              className={cn('shrink-0 text-muted-foreground/70', dense ? 'h-3 w-3' : 'h-3.5 w-3.5')}
              aria-hidden
            />
          ) : null}
          {value.map((tag) => (
            <TagChip
              key={tag.toLowerCase()}
              tag={tag}
              tone={favouriteTagChipTone(tag)}
              onRemove={disabled ? undefined : () => removeAt(value.indexOf(tag))}
              removeLabel={t('tags.removeTag', { tag })}
            />
          ))}
          <input
            ref={inputRef}
            id={id}
            value={draft}
            disabled={disabled || atLimit}
            placeholder={value.length === 0 ? placeholder : undefined}
            className={cn(
              'flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
              dense ? 'min-w-20 text-xs' : 'min-w-28 text-sm'
            )}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listboxId}-option-${safeIndex}` : undefined}
            onChange={(event) => {
              setDraft(event.target.value.replace(/,/g, ''))
              setActiveIndex(0)
              setOpen(true)
            }}
            onFocus={() => {
              cancelBlurClose()
              setOpen(true)
            }}
            onBlur={() => {
              cancelBlurClose()
              blurCloseRef.current = window.setTimeout(() => setOpen(false), 150)
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {listbox}
      </div>

      {dense ? null : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">{t('tags.hint')}</p>
          <span className="font-mono text-[10px] text-muted-foreground/80 tabular-nums">
            {value.length}/{max}
          </span>
        </div>
      )}
    </div>
  )
}
