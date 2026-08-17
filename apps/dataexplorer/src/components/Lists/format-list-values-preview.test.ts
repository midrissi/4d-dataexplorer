import { describe, expect, it } from 'bun:test'
import { formatListValuesPreview } from './format-list-values-preview'

describe('formatListValuesPreview', () => {
  it('returns null unless values are ready', () => {
    expect(formatListValuesPreview({ status: 'idle' })).toBeNull()
    expect(formatListValuesPreview({ status: 'loading' })).toBeNull()
    expect(formatListValuesPreview({ status: 'empty' })).toBeNull()
    expect(formatListValuesPreview({ status: 'error', message: 'nope' })).toBeNull()
  })

  it('joins up to four values and shows a remainder', () => {
    expect(formatListValuesPreview({ status: 'ready', values: ['a', 'b'], truncated: false })).toBe(
      'a, b'
    )
    expect(
      formatListValuesPreview({
        status: 'ready',
        values: ['a', 'b', 'c', 'd', 'e'],
        truncated: false,
      })
    ).toBe('a, b, c, d, …(+1)')
  })
})
