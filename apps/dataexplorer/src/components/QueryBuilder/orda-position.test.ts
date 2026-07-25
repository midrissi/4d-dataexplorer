import { describe, expect, it } from 'bun:test'
import { offsetToEditorPosition } from './orda-position'

describe('offsetToEditorPosition', () => {
  it('maps an offset on the first line', () => {
    expect(offsetToEditorPosition('abc def', 4)).toEqual({ row: 0, column: 4 })
  })

  it('maps an offset to the start of the text', () => {
    expect(offsetToEditorPosition('abc', 0)).toEqual({ row: 0, column: 0 })
  })

  it('counts rows across newlines', () => {
    const text = 'line0\nline1\nline2'
    expect(offsetToEditorPosition(text, text.indexOf('line1'))).toEqual({ row: 1, column: 0 })
    expect(offsetToEditorPosition(text, text.indexOf('line2') + 2)).toEqual({ row: 2, column: 2 })
  })

  it('clamps offsets below zero to the start', () => {
    expect(offsetToEditorPosition('abc', -10)).toEqual({ row: 0, column: 0 })
  })

  it('clamps offsets beyond the end to the last position', () => {
    const text = 'ab\ncd'
    expect(offsetToEditorPosition(text, 999)).toEqual({ row: 1, column: 2 })
  })
})
