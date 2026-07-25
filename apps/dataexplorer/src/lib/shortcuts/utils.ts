import type { KeyCombination, Modifier, ShortcutDefinition } from './types'

/**
 * Check if a keyboard event matches a key combination
 */
export function matchesKeyCombination(event: KeyboardEvent, combination: KeyCombination): boolean {
  const { key, modifiers = [] } = combination

  // Check the key
  if (event.key.toLowerCase() !== key.toLowerCase() && event.key !== key) {
    return false
  }

  // Check modifiers
  const hasCtrl = modifiers.includes('ctrl')
  const hasAlt = modifiers.includes('alt')
  const hasShift = modifiers.includes('shift')
  const hasMeta = modifiers.includes('meta')

  if (event.ctrlKey !== hasCtrl) return false
  if (event.altKey !== hasAlt) return false
  if (event.shiftKey !== hasShift) return false
  if (event.metaKey !== hasMeta) return false

  return true
}

/**
 * Check if the event target is an input element
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  // Check for contenteditable
  if (target.isContentEditable) {
    return true
  }

  return false
}

/**
 * Format a key combination for display
 */
export function formatKeyCombination(combination: KeyCombination): string {
  const { key, modifiers = [] } = combination
  const parts: string[] = []

  // Add modifiers in consistent order
  if (modifiers.includes('ctrl')) parts.push('Ctrl')
  if (modifiers.includes('meta')) parts.push('⌘')
  if (modifiers.includes('alt')) parts.push('Alt')
  if (modifiers.includes('shift')) parts.push('Shift')

  // Format the key
  const formattedKey = formatKey(key)
  parts.push(formattedKey)

  return parts.join(' + ')
}

/**
 * Format a single key for display
 */
export function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '↵',
    Escape: 'Esc',
    Backspace: '⌫',
    Delete: 'Del',
    Tab: '⇥',
    ' ': 'Space',
  }

  return keyMap[key] ?? key.toUpperCase()
}

/**
 * Parse a shortcut string into a KeyCombination
 * @example "ctrl+shift+s" => { key: 's', modifiers: ['ctrl', 'shift'] }
 */
export function parseShortcutString(shortcut: string): KeyCombination {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
  const modifiers: Modifier[] = []
  let key = ''

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      modifiers.push('ctrl')
    } else if (part === 'alt' || part === 'option') {
      modifiers.push('alt')
    } else if (part === 'shift') {
      modifiers.push('shift')
    } else if (part === 'meta' || part === 'cmd' || part === 'command') {
      modifiers.push('meta')
    } else {
      key = part
    }
  }

  return { key, modifiers: modifiers.length > 0 ? modifiers : undefined }
}

/**
 * Convert a KeyCombination to a string
 */
export function keyCombinationToString(combination: KeyCombination): string {
  const { key, modifiers = [] } = combination
  const parts = [...modifiers, key]
  return parts.join('+')
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(
  shortcuts: ShortcutDefinition[]
): Record<string, ShortcutDefinition[]> {
  return shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(shortcut)
      return acc
    },
    {} as Record<string, ShortcutDefinition[]>
  )
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    navigation: 'Navigation',
    query: 'Query',
    editor: 'Editor',
    results: 'Results',
    general: 'General',
  }
  return names[category] ?? category
}
