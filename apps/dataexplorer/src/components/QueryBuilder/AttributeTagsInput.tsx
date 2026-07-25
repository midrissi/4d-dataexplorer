import {
  type CompletionItem,
  CompletionItemKind,
  type LanguageService,
} from '@4d/orda-language-service'
import { cn } from '@4d/ui'
import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '~/i18n'
import { applyAttributeInsertText, measureSuggestionPlacement } from './AttributePathInput'

export function parseSelectAttributes(select: string): string[] {
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function serializeSelectAttributes(attributes: string[]): string {
  return attributes.join(', ')
}

function attributeCompletions(
  service: LanguageService | null,
  draft: string,
  cursor: number,
  selected: ReadonlySet<string>
): CompletionItem[] {
  if (!service) return []
  return service
    .complete(draft, cursor)
    .filter(
      (item) => item.kind === CompletionItemKind.Field || item.kind === CompletionItemKind.Relation
    )
    .filter((item) => {
      // Keep relation drill-down; hide attributes already selected as tags.
      if (item.insertText.endsWith('.')) return true
      const nextPath = applyAttributeInsertText(draft, cursor, item.insertText).value.trim()
      return nextPath.length > 0 && !selected.has(nextPath)
    })
}

export function AttributeTagsInput({
  value,
  onChange,
  service,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  service: LanguageService | null
  className?: string
  id?: string
  'aria-label'?: string
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const [draft, setDraft] = useState('')
  const [cursor, setCursor] = useState(0)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [placement, setPlacement] = useState<ReturnType<typeof measureSuggestionPlacement> | null>(
    null
  )
  const [focused, setFocused] = useState(false)

  const tags = useMemo(() => parseSelectAttributes(value), [value])
  const selectedSet = useMemo(() => new Set(tags), [tags])

  const suggestions = useMemo(
    () => attributeCompletions(service, draft, cursor, selectedSet),
    [service, draft, cursor, selectedSet]
  )

  const showSuggestions = open && focused && suggestions.length > 0
  const activeOptionId = showSuggestions ? `${listboxId}-option-${activeIndex}` : undefined

  useLayoutEffect(() => {
    if (!showSuggestions) {
      setPlacement(null)
      return
    }

    const updatePlacement = () => {
      const anchor = shellRef.current
      if (!anchor) return
      setPlacement(measureSuggestionPlacement(anchor.getBoundingClientRect(), window.innerHeight))
    }

    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [showSuggestions])

  useEffect(() => {
    if (!showSuggestions) return
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listboxId, showSuggestions])

  const commitTags = (next: string[]) => {
    onChange(serializeSelectAttributes(next))
  }

  const addTag = (raw: string) => {
    const path = raw.trim()
    if (!path || path.endsWith('.')) return false
    if (selectedSet.has(path)) {
      setDraft('')
      setCursor(0)
      setActiveIndex(0)
      return true
    }
    commitTags([...tags, path])
    setDraft('')
    setCursor(0)
    setActiveIndex(0)
    return true
  }

  const removeTag = (path: string) => {
    commitTags(tags.filter((tag) => tag !== path))
  }

  const syncCursor = () => {
    const input = inputRef.current
    if (!input) return
    setCursor(input.selectionStart ?? input.value.length)
  }

  const applySuggestion = (item: CompletionItem) => {
    const at = inputRef.current?.selectionStart ?? cursor
    const next = applyAttributeInsertText(draft, at, item.insertText)
    if (item.insertText.endsWith('.')) {
      setDraft(next.value)
      setCursor(next.cursor)
      setActiveIndex(0)
      setOpen(true)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(next.cursor, next.cursor)
      })
      return
    }
    addTag(next.value)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && draft.length === 0 && tags.length > 0) {
      event.preventDefault()
      const lastTag = tags[tags.length - 1]
      if (lastTag) removeTag(lastTag)
      return
    }

    if (showSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const selected = suggestions[activeIndex]
        if (selected) {
          event.preventDefault()
          applySuggestion(selected)
          return
        }
      }
    }

    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      if (!draft.trim()) return
      event.preventDefault()
      addTag(draft)
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        ref={shellRef}
        className={cn(
          'flex min-h-6 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5',
          'transition-[color,box-shadow,border-color]',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40'
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              'group inline-flex max-w-full items-center gap-1 rounded-md border border-border/70',
              'bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground'
            )}
          >
            <span className="min-w-0 truncate" title={tag}>
              {tag}
            </span>
            <button
              type="button"
              className={cn(
                'rounded p-0.5 text-muted-foreground/70 transition-colors',
                'hover:bg-background/80 hover:text-destructive',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              aria-label={t('query.removeAttribute', { name: tag })}
              onClick={() => {
                removeTag(tag)
                inputRef.current?.focus()
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setCursor(event.target.selectionStart ?? event.target.value.length)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => {
            setFocused(true)
            syncCursor()
            setOpen(true)
          }}
          onBlur={() => {
            setFocused(false)
            window.setTimeout(() => {
              setOpen(false)
              if (draft.trim() && !draft.trim().endsWith('.')) {
                addTag(draft)
              }
            }, 120)
          }}
          onClick={syncCursor}
          onKeyUp={syncCursor}
          onSelect={syncCursor}
          onKeyDown={handleKeyDown}
          placeholder={
            tags.length === 0 ? t('query.attributesPlaceholder') : t('query.addAttribute')
          }
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-label={ariaLabel}
          className={cn(
            'min-w-28 flex-1 bg-transparent py-0.5 font-mono text-xs outline-none',
            'placeholder:font-sans placeholder:text-muted-foreground'
          )}
        />
      </div>

      {showSuggestions && placement
        ? createPortal(
            <div
              id={listboxId}
              role="listbox"
              style={{
                position: 'fixed',
                top: placement.side === 'bottom' ? placement.top : undefined,
                bottom: placement.side === 'top' ? window.innerHeight - placement.top : undefined,
                left: placement.left,
                width: Math.max(placement.width, 220),
                maxHeight: placement.maxHeight,
              }}
              className="z-50 overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {suggestions.map((item, index) => (
                <button
                  key={`${item.kind}-${item.label}-${item.insertText}`}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    applySuggestion(item)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left',
                    'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                    index === activeIndex && 'bg-muted/70'
                  )}
                >
                  <span className="truncate font-mono text-xs">{item.label}</span>
                  {item.detail ? (
                    <span className="truncate text-[10px] text-muted-foreground">
                      {item.detail}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
