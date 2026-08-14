import { describe, expect, it } from 'bun:test'
import { isModClick, isModShiftClick } from './mod-click'

describe('mod-click', () => {
  it('detects ⌘/Ctrl without requiring shift', () => {
    expect(isModClick({ metaKey: true, ctrlKey: false })).toBe(true)
    expect(isModClick({ metaKey: false, ctrlKey: true })).toBe(true)
    expect(isModClick({ metaKey: false, ctrlKey: false })).toBe(false)
  })

  it('detects ⌘/Ctrl+Shift for HTTP Client open', () => {
    expect(isModShiftClick({ metaKey: true, ctrlKey: false, shiftKey: true })).toBe(true)
    expect(isModShiftClick({ metaKey: false, ctrlKey: true, shiftKey: true })).toBe(true)
    expect(isModShiftClick({ metaKey: true, ctrlKey: false, shiftKey: false })).toBe(false)
    expect(isModShiftClick({ metaKey: false, ctrlKey: false, shiftKey: true })).toBe(false)
  })
})
