import { describe, expect, it } from 'bun:test'
import { terminalHistoryDirectionFromSwipe } from './terminal-history-gesture'

describe('terminalHistoryDirectionFromSwipe', () => {
  it('maps an upward swipe to older history', () => {
    expect(terminalHistoryDirectionFromSwipe(100, 60)).toBe('previous')
  })

  it('maps a downward swipe to newer history', () => {
    expect(terminalHistoryDirectionFromSwipe(60, 100)).toBe('next')
  })

  it('ignores small movements and taps', () => {
    expect(terminalHistoryDirectionFromSwipe(100, 85)).toBeNull()
    expect(terminalHistoryDirectionFromSwipe(100, 100)).toBeNull()
  })
})
