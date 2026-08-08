import { describe, expect, it } from 'bun:test'
import { isDateStringPattern, isDurationFieldName, looksLikeDurationNumber } from './tree-value'

describe('isDurationFieldName', () => {
  it('matches duration/elapsed/time but not timestamp', () => {
    expect(isDurationFieldName('duration')).toBe(true)
    expect(isDurationFieldName('elapsedMs')).toBe(true)
    expect(isDurationFieldName('timeSpent')).toBe(true)
    expect(isDurationFieldName('timestamp')).toBe(false)
    expect(isDurationFieldName('name')).toBe(false)
  })
})

describe('looksLikeDurationNumber', () => {
  it('accepts millisecond durations in a plausible range', () => {
    expect(looksLikeDurationNumber(500)).toBe(false)
    expect(looksLikeDurationNumber(1500)).toBe(true)
    expect(looksLikeDurationNumber(604800000)).toBe(true)
    expect(looksLikeDurationNumber(604800001)).toBe(false)
  })
})

describe('isDateStringPattern', () => {
  it('recognizes ISO and 4D date formats', () => {
    expect(isDateStringPattern('2024-01-02')).toBe(true)
    expect(isDateStringPattern('!!2024-01-02!!')).toBe(true)
    expect(isDateStringPattern('1!2!2024')).toBe(true)
    expect(isDateStringPattern('0!0!0')).toBe(true)
    expect(isDateStringPattern('Paris')).toBe(false)
  })
})
