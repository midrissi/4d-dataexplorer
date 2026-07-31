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

export function eventToShortcutSearchCombo(event: KeyboardEvent): KeyCombo | null {
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return null

  let key = event.key
  if (key === ' ') key = 'Space'
  if (key.length === 1) key = key.toUpperCase()

  return {
    key,
    modifiers: {
      meta: event.metaKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    },
  }
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
