import { Braces, Sparkles } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import {
  applyEnvTemplateCompletion,
  type EnvTemplateSuggestion,
  filterEnvTemplateSuggestions,
  getEnvTemplateMatch,
} from './env-template-autocomplete'

const LIST_MAX_HEIGHT = 280
const LIST_GAP = 6
const LIST_PAD = 8

type Placement = {
  side: 'top' | 'bottom'
  top: number
  left: number
  width: number
  maxHeight: number
}

function measurePlacement(anchor: DOMRect, viewportHeight: number): Placement {
  const spaceBelow = viewportHeight - anchor.bottom - LIST_PAD
  const spaceAbove = anchor.top - LIST_PAD
  const preferTop = spaceBelow < LIST_MAX_HEIGHT && spaceAbove > spaceBelow
  if (preferTop) {
    return {
      side: 'top',
      top: anchor.top - LIST_GAP,
      left: anchor.left,
      width: Math.max(anchor.width, 280),
      maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, spaceAbove)),
    }
  }
  return {
    side: 'bottom',
    top: anchor.bottom + LIST_GAP,
    left: anchor.left,
    width: Math.max(anchor.width, 280),
    maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, spaceBelow)),
  }
}

export type UseEnvTemplateAutocompleteOptions = {
  value: string
  onChange: (next: string) => void
  suggestions: readonly EnvTemplateSuggestion[]
  groupLabels?: Readonly<Record<string, string>>
  enabled?: boolean
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
}

export type EnvTemplateSuggestListProps = {
  id: string
  items: readonly EnvTemplateSuggestion[]
  activeIndex: number
  placement: Placement
  groupLabels?: Readonly<Record<string, string>>
  onHover: (index: number) => void
  onSelect: (item: EnvTemplateSuggestion) => void
}

export type UseEnvTemplateAutocompleteResult = {
  listProps: EnvTemplateSuggestListProps | null
  onValueChange: (next: string, cursor: number) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onBlur: () => void
  syncCursor: () => void
  /** True when an unfinished `{{` token is under the cursor. */
  active: boolean
}

/** Keyboard + portal list state for Postman-style `{{var}}` autocomplete. */
export function useEnvTemplateAutocomplete({
  value,
  onChange,
  suggestions,
  groupLabels,
  enabled = true,
  inputRef,
}: UseEnvTemplateAutocompleteOptions): UseEnvTemplateAutocompleteResult {
  const listboxId = React.useId()
  const [open, setOpen] = React.useState(false)
  const [cursor, setCursor] = React.useState(value.length)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [placement, setPlacement] = React.useState<Placement | null>(null)

  const match = enabled ? getEnvTemplateMatch(value, cursor) : null
  const items = React.useMemo(
    () => (match ? filterEnvTemplateSuggestions(suggestions, match.prefix) : []),
    [match, suggestions]
  )

  React.useEffect(() => {
    if (match && items.length > 0) setOpen(true)
    else if (!match) setOpen(false)
  }, [items.length, match])

  const active = Boolean(match) && items.length > 0 && open
  const safeActiveIndex = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1)

  const syncCursor = React.useCallback(() => {
    const el = inputRef.current
    if (!el) return
    setCursor(el.selectionStart ?? el.value.length)
  }, [inputRef])

  const commit = React.useCallback(
    (item: EnvTemplateSuggestion) => {
      const el = inputRef.current
      const at = el?.selectionStart ?? cursor
      const next = applyEnvTemplateCompletion(value, at, item.key)
      onChange(next.value)
      setOpen(false)
      setActiveIndex(0)
      requestAnimationFrame(() => {
        const node = inputRef.current
        if (!node) return
        node.focus()
        node.setSelectionRange(next.cursor, next.cursor)
        setCursor(next.cursor)
      })
    },
    [cursor, inputRef, onChange, value]
  )

  React.useLayoutEffect(() => {
    if (!active) {
      setPlacement(null)
      return
    }
    const update = () => {
      const el = inputRef.current
      if (!el) return
      setPlacement(measurePlacement(el.getBoundingClientRect(), window.innerHeight))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, inputRef])

  React.useEffect(() => {
    if (!active) return
    document
      .getElementById(`${listboxId}-option-${safeActiveIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, listboxId, safeActiveIndex])

  const onValueChange = React.useCallback(
    (next: string, nextCursor: number) => {
      onChange(next)
      setCursor(nextCursor)
      setActiveIndex(0)
      setOpen(Boolean(getEnvTemplateMatch(next, nextCursor)))
    },
    [onChange]
  )

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      syncCursor()
      if (!match || items.length === 0) {
        if (event.key === 'ArrowDown' && match && items.length > 0) {
          event.preventDefault()
          setOpen(true)
        }
        return
      }
      if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
        }
        return
      }
      if (!open) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, items.length - 1))
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
        const selected = items[safeActiveIndex]
        if (!selected) return
        event.preventDefault()
        commit(selected)
      }
    },
    [commit, items, match, open, safeActiveIndex, syncCursor]
  )

  const onBlur = React.useCallback(() => {
    window.setTimeout(() => setOpen(false), 120)
  }, [])

  return {
    listProps:
      active && placement
        ? {
            id: listboxId,
            items,
            activeIndex: safeActiveIndex,
            placement,
            groupLabels,
            onHover: setActiveIndex,
            onSelect: commit,
          }
        : null,
    onValueChange,
    onKeyDown,
    onBlur,
    syncCursor,
    active,
  }
}

export function EnvTemplateSuggestList({
  id,
  items,
  activeIndex,
  placement,
  groupLabels,
  onHover,
  onSelect,
}: EnvTemplateSuggestListProps) {
  const width = Math.min(Math.max(placement.width, 280), 420)

  return createPortal(
    <div
      id={id}
      role="listbox"
      aria-label="Environment variables"
      style={{
        position: 'fixed',
        top: placement.side === 'bottom' ? placement.top : undefined,
        bottom: placement.side === 'top' ? window.innerHeight - placement.top : undefined,
        left: placement.left,
        width,
        maxHeight: placement.maxHeight,
      }}
      className={cn(
        'z-50 flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-sm',
        'fade-in-0 zoom-in-95 animate-in duration-fast',
        placement.side === 'bottom' ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-0.5">
        {items.map((item, index) => {
          const prevGroup = index > 0 ? items[index - 1]?.group : undefined
          const showGroup =
            Boolean(item.group && groupLabels?.[item.group]) && item.group !== prevGroup
          const selected = index === activeIndex
          const isDynamic = item.group === 'dynamic'

          return (
            <div key={`${item.group ?? ''}:${item.key}`}>
              {showGroup && item.group ? (
                <div
                  className={cn(
                    'sticky top-0 z-10 flex items-center gap-1.5 bg-popover/95 px-2 pt-1.5 pb-1 backdrop-blur-sm',
                    index > 0 && 'mt-0.5 border-border/60 border-t'
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      isDynamic ? 'bg-sky-400' : 'bg-primary'
                    )}
                    aria-hidden
                  />
                  <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                    {groupLabels?.[item.group]}
                  </span>
                </div>
              ) : null}
              <button
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(item)
                }}
                onMouseEnter={() => onHover(index)}
                className={cn(
                  'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-left outline-none',
                  'transition-colors duration-fast',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring',
                  selected && 'bg-accent text-accent-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-fast',
                    isDynamic
                      ? 'border-sky-400/25 bg-sky-400/10 text-sky-500 dark:text-sky-400'
                      : 'border-primary/20 bg-primary/10 text-primary'
                  )}
                  aria-hidden
                >
                  {isDynamic ? <Sparkles className="size-3" /> : <Braces className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs leading-snug">{item.key}</span>
                  {item.detail ? (
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-[11px] leading-snug',
                        selected ? 'text-accent-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {item.detail}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          )
        })}
      </div>
      <div
        className="flex shrink-0 items-center justify-end gap-1.5 border-border/70 border-t bg-muted/30 px-2.5 py-1"
        aria-hidden
      >
        <kbd className="rounded-sm border border-border/80 bg-background px-1 py-px font-mono text-[9px] text-muted-foreground">
          ↑↓
        </kbd>
        <kbd className="rounded-sm border border-border/80 bg-background px-1 py-px font-mono text-[9px] text-muted-foreground">
          ↵
        </kbd>
      </div>
    </div>,
    document.body
  )
}
