import { describe, expect, it } from 'bun:test'
import type { KeyboardShortcut } from '~/store/settings'
import {
  eventToKeyCombo,
  eventToShortcutSearchCombo,
  resolveShortcutEventKey,
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

const tab2Shortcut: KeyboardShortcut = {
  id: 'tab-2',
  label: 'Switch to Tab 2',
  key: '2',
  modifiers: { ctrl: true, alt: true },
  enabled: true,
  category: 'Tabs',
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
        code: 'KeyJ',
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

  it('maps Option+digit physical keys despite layout-transformed event.key', () => {
    // macOS AZERTY: Ctrl+Option+2 reports key "É" but code "Digit2"
    expect(
      resolveShortcutEventKey({
        key: 'É',
        code: 'Digit2',
        altKey: true,
        ctrlKey: true,
        metaKey: false,
      })
    ).toBe('2')

    expect(
      eventToKeyCombo({
        key: 'É',
        code: 'Digit2',
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: true,
      } as KeyboardEvent)
    ).toEqual({
      key: '2',
      modifiers: { meta: false, ctrl: true, shift: false, alt: true },
    })

    expect(
      shortcutMatchesRecordedCombo(
        tab2Shortcut,
        eventToKeyCombo({
          key: 'É',
          code: 'Digit2',
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: true,
        } as KeyboardEvent)
      )
    ).toBe(true)
  })
})
