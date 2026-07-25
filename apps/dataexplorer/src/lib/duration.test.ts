import { describe, expect, it } from 'bun:test'
import { durationValueToInputValue, parseDurationInput } from './duration'

describe('duration', () => {
  describe('parseDurationInput', () => {
    it('returns null for empty string', () => {
      expect(parseDurationInput('')).toBe(null)
      expect(parseDurationInput('   ')).toBe(null)
    })

    it('parses seconds', () => {
      expect(parseDurationInput('30s')).toBe(30_000)
      expect(parseDurationInput('90s')).toBe(90_000)
    })

    it('parses minutes', () => {
      expect(parseDurationInput('1m')).toBe(60_000)
      expect(parseDurationInput('90m')).toBe(90 * 60_000)
    })

    it('parses hours and minutes', () => {
      expect(parseDurationInput('1h 30m')).toBe(90 * 60_000)
      expect(parseDurationInput('1h')).toBe(3600_000)
    })

    it('parses compound formats', () => {
      expect(parseDurationInput('1m 30s')).toBe(90_000)
      expect(parseDurationInput('2h 15m')).toBe(2 * 3600_000 + 15 * 60_000)
    })

    it('trims input', () => {
      expect(parseDurationInput('  60s  ')).toBe(60_000)
    })

    it('returns null for unparseable input', () => {
      expect(parseDurationInput('not a duration')).toBe(null)
      expect(parseDurationInput('abc')).toBe(null)
    })
  })

  describe('durationValueToInputValue', () => {
    it('returns empty string for null and undefined', () => {
      expect(durationValueToInputValue(null)).toBe('')
      expect(durationValueToInputValue(undefined)).toBe('')
    })

    it('returns empty string for NaN and negative', () => {
      expect(durationValueToInputValue(Number.NaN)).toBe('')
      expect(durationValueToInputValue(-100)).toBe('')
    })

    it('formats zero as 00:00:00', () => {
      expect(durationValueToInputValue(0)).toBe('00:00:00')
    })

    it('formats milliseconds as HH:MM:SS', () => {
      expect(durationValueToInputValue(1000)).toBe('00:00:01')
      expect(durationValueToInputValue(65_000)).toBe('00:01:05')
      expect(durationValueToInputValue(3661_000)).toBe('01:01:01')
      expect(durationValueToInputValue(90 * 60_000)).toBe('01:30:00')
    })

    it('pads hours, minutes, seconds with leading zeros', () => {
      expect(durationValueToInputValue(5 * 60_000)).toBe('00:05:00')
      expect(durationValueToInputValue(9 * 3600_000)).toBe('09:00:00')
    })

    it('floors fractional seconds', () => {
      expect(durationValueToInputValue(1500)).toBe('00:00:01')
    })

    it('accepts number-like values', () => {
      expect(durationValueToInputValue('60000')).toBe('00:01:00')
    })
  })
})
