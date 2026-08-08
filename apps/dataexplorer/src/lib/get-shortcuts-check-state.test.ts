import { describe, expect, it } from 'bun:test'
import type { KeyboardShortcut } from '~/store/settings'
import { getShortcutsCheckState } from './get-shortcuts-check-state'

function shortcut(id: string, enabled: boolean): KeyboardShortcut {
  return {
    id,
    label: id,
    key: 'k',
    modifiers: {},
    enabled,
    category: 'General',
  }
}

describe('getShortcutsCheckState', () => {
  it('returns true when all shortcuts are enabled', () => {
    expect(getShortcutsCheckState([shortcut('a', true), shortcut('b', true)])).toBe(true)
  })

  it('returns false when no shortcuts are enabled', () => {
    expect(getShortcutsCheckState([])).toBe(false)
    expect(getShortcutsCheckState([shortcut('a', false), shortcut('b', false)])).toBe(false)
  })

  it('returns indeterminate when some shortcuts are enabled', () => {
    expect(getShortcutsCheckState([shortcut('a', true), shortcut('b', false)])).toBe(
      'indeterminate'
    )
  })
})
