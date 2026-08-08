import type { KeyboardShortcut, KeyCombo } from '~/store/settings'

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

function comboMatches(left: KeyCombo, right: KeyCombo): boolean {
  return (
    left.key.toLocaleLowerCase() === right.key.toLocaleLowerCase() &&
    Boolean(left.modifiers.meta) === Boolean(right.modifiers.meta) &&
    Boolean(left.modifiers.ctrl) === Boolean(right.modifiers.ctrl) &&
    Boolean(left.modifiers.shift) === Boolean(right.modifiers.shift) &&
    Boolean(left.modifiers.alt) === Boolean(right.modifiers.alt)
  )
}

function comboSearchWords(combo: KeyCombo): string {
  const words: string[] = []
  if (combo.modifiers.meta) words.push('cmd command')
  if (combo.modifiers.ctrl) words.push('ctrl control')
  if (combo.modifiers.alt) words.push('alt option')
  if (combo.modifiers.shift) words.push('shift')
  words.push(combo.key)
  return words.join(' ')
}

/**
 * Resolve the shortcut key from a keyboard event.
 *
 * Prefer physical `code` for digits and (when modifiers are held) letters.
 * Option/Alt on macOS remaps `event.key` to layout characters (e.g. Option+2 → "É"
 * on AZERTY), which would otherwise break Ctrl+Option+N tab shortcuts.
 */
export function resolveShortcutEventKey(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey'>
): string {
  const { key, code } = event
  if (key === ' ') return 'Space'

  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]

  const numpad = /^Numpad([0-9])$/.exec(code)
  if (numpad) return numpad[1]

  if (event.altKey || event.ctrlKey || event.metaKey) {
    const letter = /^Key([A-Z])$/.exec(code)
    if (letter) return letter[1]
  }

  if (key.length === 1) return key.toUpperCase()
  return key
}

export function eventToKeyCombo(event: KeyboardEvent): KeyCombo {
  return {
    key: resolveShortcutEventKey(event),
    modifiers: {
      meta: event.metaKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    },
  }
}

export function eventToShortcutSearchCombo(event: KeyboardEvent): KeyCombo | null {
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return null
  return eventToKeyCombo(event)
}

export function shortcutMatchesRecordedCombo(shortcut: KeyboardShortcut, combo: KeyCombo): boolean {
  if (shortcut.chord?.length === 2) {
    return shortcut.chord.some((part) => comboMatches(part, combo))
  }
  return comboMatches({ key: shortcut.key, modifiers: shortcut.modifiers }, combo)
}

export function shortcutMatchesText(
  shortcut: KeyboardShortcut,
  localizedLabel: string,
  formattedShortcut: string,
  query: string
): boolean {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return true

  const idWords = shortcut.id.replaceAll('-', ' ')
  const actionWords = shortcut.id.startsWith('toggle-')
    ? `open close show hide ${idWords.slice('toggle-'.length)}`
    : ''
  const keyWords = shortcut.chord
    ? shortcut.chord.map(comboSearchWords).join(' then ')
    : comboSearchWords({ key: shortcut.key, modifiers: shortcut.modifiers })
  const searchable = normalize(
    [
      shortcut.id,
      idWords,
      shortcut.label,
      localizedLabel,
      shortcut.category,
      formattedShortcut,
      keyWords,
      actionWords,
    ].join(' ')
  )

  return normalizedQuery.split(' ').every((term) => searchable.includes(term))
}
