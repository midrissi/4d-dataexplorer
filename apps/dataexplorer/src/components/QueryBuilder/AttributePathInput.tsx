import {
  type CompletionItem,
  CompletionItemKind,
  type LanguageService,
} from '@4d/orda-language-service'
import { cn, Input } from '@4d/ui'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SUGGESTION_MAX_HEIGHT_PX = 208 // max-h-52
const SUGGESTION_GAP_PX = 4
const SUGGESTION_COLLISION_PADDING_PX = 8

/** Replace the current path segment at `cursor` with `insertText`. */
export function applyAttributeInsertText(
  value: string,
  cursor: number,
  insertText: string
): { value: string; cursor: number } {
  const before = value.slice(0, cursor)
  const segStart = Math.max(before.lastIndexOf('.') + 1, 0)
  const rest = value.slice(segStart)
  const match = rest.match(/^[A-Za-z_][\w]*/)
  const segEnd = segStart + (match ? match[0].length : 0)
  return {
    value: value.slice(0, segStart) + insertText + value.slice(segEnd),
    cursor: segStart + insertText.length,
  }
}

function attributeCompletions(
  service: LanguageService | null,
  value: string,
  cursor: number
): CompletionItem[] {
  if (!service) return []
  return service
    .complete(value, cursor)
    .filter(
      (item) => item.kind === CompletionItemKind.Field || item.kind === CompletionItemKind.Relation
    )
}

type SuggestionPlacement = {
  top: number
  left: number
  width: number
  maxHeight: number
  side: 'top' | 'bottom'
}

/** Prefer opening above when the viewport below the input is too tight. */
export function measureSuggestionPlacement(
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>,
  viewportHeight: number,
  maxHeight = SUGGESTION_MAX_HEIGHT_PX
): SuggestionPlacement {
  const spaceBelow = viewportHeight - anchorRect.bottom - SUGGESTION_COLLISION_PADDING_PX
  const spaceAbove = anchorRect.top - SUGGESTION_COLLISION_PADDING_PX
  const preferTop = spaceBelow < maxHeight && spaceAbove > spaceBelow

  if (preferTop) {
    return {
      side: 'top',
      left: anchorRect.left,
      width: anchorRect.width,
      maxHeight: Math.max(0, Math.min(maxHeight, spaceAbove)),
      top: anchorRect.top - SUGGESTION_GAP_PX,
    }
  }

  return {
    side: 'bottom',
    left: anchorRect.left,
    width: anchorRect.width,
    maxHeight: Math.max(0, Math.min(maxHeight, spaceBelow)),
    top: anchorRect.bottom + SUGGESTION_GAP_PX,
  }
}

export function AttributePathInput({
  value,
  onChange,
  service,
  placeholder,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  service: LanguageService | null
  placeholder?: string
  className?: string
  id?: string
  'aria-label'?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [placement, setPlacement] = useState<SuggestionPlacement | null>(null)

  const suggestions = useMemo(
    () => attributeCompletions(service, value, cursor),
    [service, value, cursor]
  )

  const showSuggestions = open && suggestions.length > 0
  const activeOptionId = showSuggestions ? `${listboxId}-option-${activeIndex}` : undefined

  useLayoutEffect(() => {
    if (!showSuggestions) {
      setPlacement(null)
      return
    }

    const updatePlacement = () => {
      const input = inputRef.current
      if (!input) return
      setPlacement(measureSuggestionPlacement(input.getBoundingClientRect(), window.innerHeight))
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

  const syncCursor = () => {
    const input = inputRef.current
    if (!input) return
    setCursor(input.selectionStart ?? input.value.length)
  }

  const commitSuggestion = (item: CompletionItem) => {
    const input = inputRef.current
    const at = input?.selectionStart ?? cursor
    const next = applyAttributeInsertText(value, at, item.insertText)
    onChange(next.value)
    setCursor(next.cursor)
    setActiveIndex(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(next.cursor, next.cursor)
      setOpen(true)
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        event.preventDefault()
        setOpen(true)
        setActiveIndex(0)
      }
      return
    }

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
    if (event.key === 'Enter' || event.key === 'Tab') {
      const selected = suggestions[activeIndex]
      if (!selected) return
      event.preventDefault()
      commitSuggestion(selected)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setCursor(event.target.selectionStart ?? event.target.value.length)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => {
          syncCursor()
          setOpen(true)
        }}
        onBlur={() => {
          // Delay so option mousedown can commit before the list unmounts.
          window.setTimeout(() => setOpen(false), 120)
        }}
        onClick={syncCursor}
        onKeyUp={syncCursor}
        onSelect={syncCursor}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={ariaLabel}
        className={className}
      />
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
                width: placement.width,
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
                    commitSuggestion(item)
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
