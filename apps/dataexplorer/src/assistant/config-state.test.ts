import { describe, expect, test } from 'bun:test'
import type { KeyboardShortcut } from '~/store/settings'
import { summarizeShortcuts } from './config-state'

const sampleShortcuts: KeyboardShortcut[] = [
  {
    id: 'open-structure',
    label: 'Display Structure',
    key: 's',
    modifiers: { meta: true, shift: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    key: 't',
    modifiers: { meta: true },
    enabled: true,
    category: 'General',
  },
]

describe('summarizeShortcuts', () => {
  test('returns all shortcuts when no filters', () => {
    const result = summarizeShortcuts(sampleShortcuts)
    expect(result).toHaveLength(2)
    expect(result[0]?.keys.length).toBeGreaterThan(0)
  })

  test('filters by id', () => {
    const result = summarizeShortcuts(sampleShortcuts, { id: 'open-structure' })
    expect(result).toHaveLength(1)
    expect(result[0]?.label).toBe('Display Structure')
  })

  test('filters by query on label', () => {
    const result = summarizeShortcuts(sampleShortcuts, { query: 'structure' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('open-structure')
  })

  test('filters by category', () => {
    const result = summarizeShortcuts(sampleShortcuts, { category: 'navigation' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('open-structure')
  })
})
