import { describe, expect, it } from 'bun:test'
import type { ShortcutDefinition } from './types'
import {
  formatKey,
  formatKeyCombination,
  getCategoryDisplayName,
  groupShortcutsByCategory,
  isInputElement,
  keyCombinationToString,
  matchesKeyCombination,
  parseShortcutString,
} from './utils'

function createMockKeyboardEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: 's',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides,
  } as KeyboardEvent
}

describe('shortcuts/utils', () => {
  describe('formatKey', () => {
    it('formats special keys with symbols', () => {
      expect(formatKey('ArrowUp')).toBe('↑')
      expect(formatKey('ArrowDown')).toBe('↓')
      expect(formatKey('Enter')).toBe('↵')
      expect(formatKey('Escape')).toBe('Esc')
      expect(formatKey(' ')).toBe('Space')
    })

    it('returns uppercase for letter keys', () => {
      expect(formatKey('s')).toBe('S')
      expect(formatKey('a')).toBe('A')
    })

    it('returns key as-is for unknown keys', () => {
      expect(formatKey('F1')).toBe('F1')
    })
  })

  describe('formatKeyCombination', () => {
    it('formats modifier + key', () => {
      expect(formatKeyCombination({ key: 's', modifiers: ['ctrl'] })).toContain('Ctrl')
      expect(formatKeyCombination({ key: 's', modifiers: ['ctrl'] })).toContain('S')
    })

    it('formats multiple modifiers in order', () => {
      const result = formatKeyCombination({ key: 's', modifiers: ['ctrl', 'shift'] })
      expect(result).toContain('Ctrl')
      expect(result).toContain('Shift')
      expect(result).toContain('S')
    })

    it('formats key only when no modifiers', () => {
      expect(formatKeyCombination({ key: 'Escape' })).toBe('Esc')
    })
  })

  describe('parseShortcutString', () => {
    it('parses ctrl+key', () => {
      const result = parseShortcutString('ctrl+s')
      expect(result.key).toBe('s')
      expect(result.modifiers).toContain('ctrl')
    })

    it('parses multiple modifiers', () => {
      const result = parseShortcutString('ctrl+shift+s')
      expect(result.key).toBe('s')
      expect(result.modifiers).toContain('ctrl')
      expect(result.modifiers).toContain('shift')
    })

    it('accepts option as alt', () => {
      const result = parseShortcutString('option+a')
      expect(result.modifiers).toContain('alt')
    })

    it('accepts cmd as meta', () => {
      const result = parseShortcutString('cmd+k')
      expect(result.modifiers).toContain('meta')
      expect(result.key).toBe('k')
    })

    it('trims and lowercases', () => {
      const result = parseShortcutString('  Ctrl + S  ')
      expect(result.key).toBe('s')
      expect(result.modifiers).toContain('ctrl')
    })
  })

  describe('keyCombinationToString', () => {
    it('joins modifiers and key with +', () => {
      expect(keyCombinationToString({ key: 's', modifiers: ['ctrl'] })).toBe('ctrl+s')
      expect(keyCombinationToString({ key: 'Escape' })).toContain('Escape')
    })
  })

  describe('groupShortcutsByCategory', () => {
    it('groups shortcuts by category', () => {
      const shortcuts: ShortcutDefinition[] = [
        {
          action: 'navigate.dataclasses',
          keys: { key: '1' },
          description: 'A',
          category: 'navigation',
        },
        {
          action: 'navigate.settings',
          keys: { key: '2' },
          description: 'B',
          category: 'navigation',
        },
        { action: 'editor.focus', keys: { key: '3' }, description: 'C', category: 'editor' },
      ]
      const grouped = groupShortcutsByCategory(shortcuts)
      expect(grouped.navigation).toHaveLength(2)
      expect(grouped.editor).toHaveLength(1)
    })

    it('returns empty object for empty array', () => {
      expect(groupShortcutsByCategory([])).toEqual({})
    })
  })

  describe('getCategoryDisplayName', () => {
    it('returns display name for known categories', () => {
      expect(getCategoryDisplayName('navigation')).toBe('Navigation')
      expect(getCategoryDisplayName('query')).toBe('Query')
      expect(getCategoryDisplayName('general')).toBe('General')
    })

    it('returns category as-is for unknown', () => {
      expect(getCategoryDisplayName('custom')).toBe('custom')
    })
  })

  describe('matchesKeyCombination', () => {
    it('matches key only', () => {
      const event = createMockKeyboardEvent({ key: 's' })
      expect(matchesKeyCombination(event, { key: 's' })).toBe(true)
      expect(matchesKeyCombination(event, { key: 'S' })).toBe(true)
      expect(matchesKeyCombination(event, { key: 'a' })).toBe(false)
    })

    it('matches key and modifiers', () => {
      const event = createMockKeyboardEvent({ key: 's', ctrlKey: true })
      expect(matchesKeyCombination(event, { key: 's', modifiers: ['ctrl'] })).toBe(true)
      expect(matchesKeyCombination(event, { key: 's' })).toBe(false)
      expect(matchesKeyCombination(event, { key: 's', modifiers: ['ctrl', 'shift'] })).toBe(false)
    })

    it('matches multiple modifiers', () => {
      const event = createMockKeyboardEvent({
        key: 's',
        ctrlKey: true,
        shiftKey: true,
      })
      expect(matchesKeyCombination(event, { key: 's', modifiers: ['ctrl', 'shift'] })).toBe(true)
    })
  })

  describe('isInputElement', () => {
    class MockElement {
      tagName: string
      isContentEditable: boolean
      constructor(tagName: string, isContentEditable = false) {
        this.tagName = tagName
        this.isContentEditable = isContentEditable
      }
    }
    if (typeof globalThis.HTMLElement === 'undefined') {
      ;(globalThis as { HTMLElement: typeof MockElement }).HTMLElement =
        MockElement as unknown as typeof HTMLElement
    }

    it('returns false for null', () => {
      expect(isInputElement(null)).toBe(false)
    })

    it('returns true for input, textarea, select elements', () => {
      expect(isInputElement(new MockElement('INPUT') as unknown as HTMLElement)).toBe(true)
      expect(isInputElement(new MockElement('TEXTAREA') as unknown as HTMLElement)).toBe(true)
      expect(isInputElement(new MockElement('SELECT') as unknown as HTMLElement)).toBe(true)
    })

    it('returns true for contenteditable elements', () => {
      expect(isInputElement(new MockElement('DIV', true) as unknown as HTMLElement)).toBe(true)
    })

    it('returns false for other elements', () => {
      expect(isInputElement(new MockElement('DIV') as unknown as HTMLElement)).toBe(false)
    })

    it('returns true for input, textarea, select when document exists', () => {
      if (typeof document === 'undefined') return
      const input = document.createElement('input')
      const textarea = document.createElement('textarea')
      const select = document.createElement('select')
      expect(isInputElement(input)).toBe(true)
      expect(isInputElement(textarea)).toBe(true)
      expect(isInputElement(select)).toBe(true)
    })

    it('returns true for contenteditable when document exists', () => {
      if (typeof document === 'undefined') return
      const div = document.createElement('div')
      div.contentEditable = 'true'
      expect(isInputElement(div)).toBe(true)
    })

    it('returns false for non-input element when document exists', () => {
      if (typeof document === 'undefined') return
      const div = document.createElement('div')
      expect(isInputElement(div)).toBe(false)
    })
  })
})
