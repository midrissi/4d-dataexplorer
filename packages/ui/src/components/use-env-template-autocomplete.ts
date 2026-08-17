import * as React from 'react'
import {
  applyEnvTemplateCompletion,
  type EnvTemplateSuggestion,
  filterEnvTemplateSuggestions,
  getEnvTemplateMatch,
} from './env-template-autocomplete'

const LIST_MAX_HEIGHT = 280
const LIST_GAP = 6
const LIST_PAD = 8

export type Placement = {
  side: 'top' | 'bottom'
  top: number
  left: number
  width: number
  maxHeight: number
}

export function measurePlacement(anchor: DOMRect, viewportHeight: number): Placement {
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
  listRef?: React.Ref<HTMLDivElement | null>
  /** Pointer is down on the list (scrollbar / chrome) — keep open despite input blur. */
  onListInteraction?: (active: boolean) => void
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
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const interactingWithListRef = React.useRef(false)

  // Close when the token is gone or has no suggestions — never force-reopen after
  // select / Escape / blur (cursor often stays inside `{{…}}` after a filter pick).
  React.useEffect(() => {
    if (!match || items.length === 0) setOpen(false)
  }, [items.length, match])

  const active = Boolean(match) && items.length > 0 && open
  const safeActiveIndex = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1)

  const syncCursor = React.useCallback(() => {
    const el = inputRef.current
    if (!el) return
    setCursor(el.selectionStart ?? el.value.length)
  }, [inputRef])

  const dismiss = React.useCallback(() => {
    setOpen(false)
  }, [])

  const markListInteraction = React.useCallback(
    (activeInteraction: boolean) => {
      interactingWithListRef.current = activeInteraction
      if (!activeInteraction) {
        // Scrollbar / list chrome can blur the input — restore so typing continues.
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [inputRef]
  )

  const commit = React.useCallback(
    (item: EnvTemplateSuggestion, options?: { keepFocus?: boolean }) => {
      const el = inputRef.current
      const at = el?.selectionStart ?? cursor
      const next = applyEnvTemplateCompletion(value, at, item.key)
      onChange(next.value)
      setOpen(false)
      setActiveIndex(0)
      setCursor(next.cursor)
      interactingWithListRef.current = false
      if (options?.keepFocus === false) return
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

  React.useEffect(() => {
    if (!active) interactingWithListRef.current = false
  }, [active])

  React.useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (inputRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [active, dismiss, inputRef])

  React.useLayoutEffect(() => {
    if (!active) {
      setPlacement(null)
      return
    }
    const update = (event?: Event) => {
      // Scrolling inside the portal list must not remeasure / reset scrollTop.
      if (event?.type === 'scroll') {
        const target = event.target
        if (target instanceof Node) {
          const list = document.getElementById(listboxId)
          if (list?.contains(target)) return
        }
      }
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
  }, [active, inputRef, listboxId])

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
      const nextMatch = getEnvTemplateMatch(next, nextCursor)
      const nextItems = nextMatch ? filterEnvTemplateSuggestions(suggestions, nextMatch.prefix) : []
      setOpen(Boolean(nextMatch && nextItems.length > 0))
    },
    [onChange, suggestions]
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
        dismiss()
        return
      }
      if (event.key === 'Enter') {
        const selected = items[safeActiveIndex]
        if (!selected) return
        event.preventDefault()
        event.stopPropagation()
        commit(selected)
        return
      }
      if (event.key === 'Tab') {
        const selected = items[safeActiveIndex]
        if (!selected) return
        // Apply the suggestion, then let the browser move focus to the next field.
        commit(selected, { keepFocus: false })
      }
    },
    [commit, dismiss, items, match, open, safeActiveIndex, syncCursor]
  )

  const onBlur = React.useCallback(() => {
    // Defer so list scrollbar / option clicks can run before we decide to close.
    window.setTimeout(() => {
      if (interactingWithListRef.current) return
      if (listRef.current?.contains(document.activeElement)) return
      dismiss()
    }, 120)
  }, [dismiss])

  return {
    listProps:
      active && placement
        ? {
            id: listboxId,
            items,
            activeIndex: safeActiveIndex,
            placement,
            groupLabels,
            listRef,
            onListInteraction: markListInteraction,
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
