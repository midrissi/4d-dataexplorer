import { describe, expect, it } from 'bun:test'
import { triState, triStateSelectsAll } from './tri-state'

describe('triState', () => {
  it('returns none, mixed, or all', () => {
    expect(triState(0, 5)).toBe(false)
    expect(triState(2, 5)).toBe('indeterminate')
    expect(triState(5, 5)).toBe(true)
    expect(triState(0, 0)).toBe(false)
  })

  it('selects all unless already all', () => {
    expect(triStateSelectsAll(false)).toBe(true)
    expect(triStateSelectsAll('indeterminate')).toBe(true)
    expect(triStateSelectsAll(true)).toBe(false)
  })
})
