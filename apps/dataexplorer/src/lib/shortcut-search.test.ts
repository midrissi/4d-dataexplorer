import { describe, expect, it } from 'bun:test'
import type { KeyboardShortcut } from '~/store/settings'
import {
  eventToShortcutSearchCombo,
  shortcutMatchesRecordedCombo,
  shortcutMatchesText,
} from './shortcut-search'

const terminalShortcut: KeyboardShortcut = {
  id: 'toggle-terminal',
  label: 'Toggle Terminal',
  key: 'j',
  modifiers: { meta: true },
  enabled: true,
  category: 'View',
}

describe('shortcut search', () => {
  it('finds a toggle by feature and open/close intent', () => {
    expect(shortcutMatchesText(terminalShortcut, 'Toggle Terminal', '⌘J', 'terminal')).toBe(true)
    expect(shortcutMatchesText(terminalShortcut, 'Toggle Terminal', '⌘J', 'open terminal')).toBe(
      true
    )
    expect(shortcutMatchesText(terminalShortcut, 'Toggle Terminal', '⌘J', 'close terminal')).toBe(
      true
    )
  })

  it('finds a shortcut by its formatted keys', () => {
    expect(shortcutMatchesText(terminalShortcut, 'Toggle Terminal', '⌘J', '⌘J')).toBe(true)
    expect(shortcutMatchesText(terminalShortcut, 'Toggle Terminal', '⌘J', 'cmd j')).toBe(true)
  })

  it('matches a recorded key combination', () => {
    expect(
      shortcutMatchesRecordedCombo(terminalShortcut, {
        key: 'J',
        modifiers: { meta: true },
      })
    ).toBe(true)
    expect(
      shortcutMatchesRecordedCombo(terminalShortcut, {
        key: 'J',
        modifiers: { ctrl: true },
      })
    ).toBe(false)
  })

  it('normalizes a keyboard event for the recorder', () => {
    expect(
      eventToShortcutSearchCombo({
        key: 'j',
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      } as KeyboardEvent)
    ).toEqual({
      key: 'J',
      modifiers: {
        meta: true,
        ctrl: false,
        shift: false,
        alt: false,
      },
    })
  })
})
