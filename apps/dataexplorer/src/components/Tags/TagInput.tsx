import { cn } from '@4d/ui'
import { Plus, Tags } from 'lucide-react'
import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { MAX_FAVOURITE_TAGS, normalizeFavouriteTags } from '~/store/favourite-meta'
import { useUsedTagsStore } from '~/store/used-tags'
import { TagChip } from './TagChip'

function commitDraft(draft: string, selected: string[]): string[] | null {
  const next = normalizeFavouriteTags([...selected, draft])
  if (next.length === selected.length) return null
  return next.slice(0, MAX_FAVOURITE_TAGS)
}

/**
 * Reusable tag assigner: chip field + autocomplete from the shared used-tags store.
 * Enter / comma / Tab commit; Backspace removes the last chip when the draft is empty.
 *
 * Suggestions render in-tree (not portaled) so clicks work inside Radix Dialogs.
 */
export function TagInput({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  className,
  max = MAX_FAVOURITE_TAGS,
}: {
  value: readonly string[]
  onChange: (tags: string[]) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  max?: number
}) {
  const { t } = useTranslation()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const blurCloseRef = useRef<number | null>(null)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const catalog = useUsedTagsStore((state) => state.tags)
  const suggest = useUsedTagsStore((state) => state.suggest)

  const suggestions = useMemo(() => {
    const matches = suggest(draft, value)
    const normalizedDraft = draft.trim()
    const alreadySelected = value.some((tag) => tag.toLowerCase() === normalizedDraft.toLowerCase())
    const exactInCatalog = catalog.some(
      (tag) => tag.label.toLowerCase() === normalizedDraft.toLowerCase()
    )
    if (normalizedDraft && !alreadySelected && !exactInCatalog && value.length < max) {
      return [`__create__:${normalizedDraft}`, ...matches]
    }
    return matches
  }, [catalog, draft, max, suggest, value])

  const showList = open && !disabled && suggestions.length > 0 && value.length < max
  const safeIndex = suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1)

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

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: click empty chrome focuses the tag input */}
        <div
          className={cn(
            'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-sm border border-input bg-background px-2 py-1.5 transition-shadow',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset',
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
            <Tags className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
          ) : null}
          {value.map((tag) => (
            <TagChip
              key={tag.toLowerCase()}
              tag={tag}
              tone="accent"
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
            className="min-w-[7rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
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

        {showList ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border/80 bg-popover p-1 text-popover-foreground shadow-md"
          >
            {suggestions.map((item, index) => {
              const isCreate = item.startsWith('__create__:')
              const label = isCreate ? item.slice('__create__:'.length) : item
              const active = index === safeIndex
              return (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={active}
                  id={`${listboxId}-option-${index}`}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                    active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
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
                      <span aria-hidden className="font-medium text-primary/80 text-xs">
                        #
                      </span>
                      <span className="min-w-0 truncate">{label}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t('tags.hint')}</p>
        <span className="font-mono text-[10px] text-muted-foreground/80 tabular-nums">
          {value.length}/{max}
        </span>
      </div>
    </div>
  )
}
