import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { shouldDeferShortcutsForEditableTarget } from '~/lib/shortcut-editable-target'
import {
  formatKeyCombo,
  type KeyboardShortcut,
  type KeyCombo,
  useShortcuts,
} from '~/store/settings'

/** Time in ms to wait for second key of a chord before clearing buffer (VSCode-style) */
const CHORD_TIMEOUT_MS = 5000

function eventToKeyCombo(e: KeyboardEvent): KeyCombo {
  let key = e.key
  if (key === ' ') key = 'Space'
  if (key.length === 1) key = key.toUpperCase()
  return {
    key,
    modifiers: {
      meta: e.metaKey,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    },
  }
}

function keyComboMatches(a: KeyCombo, b: KeyCombo): boolean {
  const keyMatch =
    a.key.toLowerCase() === b.key.toLowerCase() ||
    a.key === b.key ||
    (a.key === 'Space' && b.key === ' ')
  const modMatch =
    !!a.modifiers.meta === !!b.modifiers.meta &&
    !!a.modifiers.ctrl === !!b.modifiers.ctrl &&
    !!a.modifiers.shift === !!b.modifiers.shift &&
    !!a.modifiers.alt === !!b.modifiers.alt
  return keyMatch && modMatch
}

function matchesSingle(shortcut: KeyboardShortcut, e: KeyboardEvent): boolean {
  if (!shortcut.enabled || shortcut.chord) return false
  return keyComboMatches(eventToKeyCombo(e), { key: shortcut.key, modifiers: shortcut.modifiers })
}

function matchesChordFirst(shortcut: KeyboardShortcut, e: KeyboardEvent): boolean {
  if (!shortcut.enabled || !shortcut.chord || shortcut.chord.length !== 2) return false
  return keyComboMatches(eventToKeyCombo(e), shortcut.chord[0])
}

function matchesChordSecond(
  shortcut: KeyboardShortcut,
  buffer: KeyCombo,
  e: KeyboardEvent
): boolean {
  if (!shortcut.enabled || !shortcut.chord || shortcut.chord.length !== 2) return false
  if (!keyComboMatches(buffer, shortcut.chord[0])) return false
  const second = shortcut.chord[1]
  const eventCombo = eventToKeyCombo(e)
  const keyMatch =
    eventCombo.key.toLowerCase() === second.key.toLowerCase() ||
    eventCombo.key === second.key ||
    (eventCombo.key === 'Space' && second.key === ' ')
  if (!keyMatch) return false
  // If chord second part has no modifiers, accept key regardless of event modifiers
  // (so "Ctrl+R then t" works even if user still has Ctrl held when pressing T)
  const secondHasNoModifiers =
    !second.modifiers?.meta &&
    !second.modifiers?.ctrl &&
    !second.modifiers?.shift &&
    !second.modifiers?.alt
  if (secondHasNoModifiers) return true
  return keyComboMatches(eventCombo, second)
}

interface ShortcutControllerContextValue {
  registerShortcutHandler: (id: string, handler: () => void) => () => void
  /** When set, user has pressed the first key of a chord; waiting for second key (for UI hint) */
  chordBuffer: KeyCombo | null
  /** Format chord buffer for display */
  formatKeyCombo: (combo: KeyCombo) => string
}

const ShortcutControllerContext = createContext<ShortcutControllerContextValue | undefined>(
  undefined
)

export function ShortcutController({ children }: { children: ReactNode }) {
  const shortcuts = useShortcuts()
  const [chordBuffer, setChordBuffer] = useState<KeyCombo | null>(null)
  const chordBufferRef = useRef<KeyCombo | null>(null)
  const chordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlersRef = useRef<Map<string, () => void>>(new Map())

  const clearChordBuffer = useCallback(() => {
    chordBufferRef.current = null
    setChordBuffer(null)
    if (chordTimeoutRef.current) {
      clearTimeout(chordTimeoutRef.current)
      chordTimeoutRef.current = null
    }
  }, [])

  const registerShortcutHandler = useCallback((id: string, handler: () => void) => {
    handlersRef.current.set(id, handler)
    return () => {
      handlersRef.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier-only presses
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return

      // Don't steal plain typing in inputs/editors. Still allow Cmd/Ctrl shortcuts
      // so panel toggles (terminal, console, palette) work while editing.
      if (shouldDeferShortcutsForEditableTarget(e)) {
        if (chordBufferRef.current) clearChordBuffer()
        return
      }

      const bufferNow = chordBufferRef.current

      if (bufferNow) {
        // Waiting for second key of chord (use ref so handler sees current buffer before re-render)
        if (e.key === 'Escape') {
          e.preventDefault()
          clearChordBuffer()
          return
        }
        for (const shortcut of shortcuts) {
          if (shortcut.chord?.length !== 2) continue
          const m = matchesChordSecond(shortcut, bufferNow, e)
          if (m) {
            e.preventDefault()
            e.stopPropagation()
            const handler = handlersRef.current.get(shortcut.id)
            handler?.()
            clearChordBuffer()
            return
          }
        }
        // Second key didn't match any chord — clear buffer and don't consume key
        clearChordBuffer()
        return
      }

      // Try single-key shortcuts
      for (const shortcut of shortcuts) {
        if (matchesSingle(shortcut, e)) {
          e.preventDefault()
          e.stopPropagation()
          const handler = handlersRef.current.get(shortcut.id)
          handler?.()
          return
        }
      }

      // Try chord first part
      for (const shortcut of shortcuts) {
        if (matchesChordFirst(shortcut, e)) {
          e.preventDefault()
          e.stopPropagation()
          const combo = eventToKeyCombo(e)
          chordBufferRef.current = combo
          setChordBuffer(combo)
          chordTimeoutRef.current = setTimeout(clearChordBuffer, CHORD_TIMEOUT_MS)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      clearChordBuffer()
    }
  }, [shortcuts, clearChordBuffer])

  const value: ShortcutControllerContextValue = {
    registerShortcutHandler,
    chordBuffer,
    formatKeyCombo,
  }

  return (
    <ShortcutControllerContext.Provider value={value}>
      {children}
    </ShortcutControllerContext.Provider>
  )
}

export function useShortcutController() {
  const context = useContext(ShortcutControllerContext)
  if (context === undefined) {
    throw new Error('useShortcutController must be used within a ShortcutController')
  }
  return context
}
