import { describe, expect, it } from 'bun:test'
import { formatBytes, formatCount, formatTime, generateId } from './utils'

describe('utils', () => {
  describe('formatBytes', () => {
    it('formats bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(500)).toBe('500 B')
    })

    it('formats KB', () => {
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })

    it('formats MB', () => {
      expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
      expect(formatBytes(2.5 * 1024 ** 2)).toBe('2.5 MB')
    })

    it('formats GB', () => {
      expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
      expect(formatBytes(3.2 * 1024 ** 3)).toBe('3.2 GB')
    })
  })

  describe('formatCount', () => {
    it('formats small numbers as-is', () => {
      expect(formatCount(0)).toBe('0')
      expect(formatCount(999)).toBe('999')
    })

    it('formats thousands with K', () => {
      expect(formatCount(1000)).toBe('1.0K')
      expect(formatCount(1500)).toBe('1.5K')
    })

    it('formats millions with M', () => {
      expect(formatCount(1_000_000)).toBe('1.0M')
      expect(formatCount(2_500_000)).toBe('2.5M')
    })
  })

  describe('formatTime', () => {
    it('returns "just now" for recent timestamps', () => {
      const now = Date.now()
      expect(formatTime(now)).toBe('just now')
    })

    it('returns "Xm ago" for minutes', () => {
      const now = Date.now()
      expect(formatTime(now - 2 * 60_000)).toBe('2m ago')
      expect(formatTime(now - 59 * 60_000)).toBe('59m ago')
    })

    it('returns "Xh ago" for hours', () => {
      const now = Date.now()
      expect(formatTime(now - 1 * 3600_000)).toBe('1h ago')
      expect(formatTime(now - 23 * 3600_000)).toBe('23h ago')
    })

    it('returns "Xd ago" for days under a week', () => {
      const now = Date.now()
      expect(formatTime(now - 1 * 86400_000)).toBe('1d ago')
      expect(formatTime(now - 6 * 86400_000)).toBe('6d ago')
    })

    it('returns locale date string for older timestamps', () => {
      const oldDate = new Date('2020-01-15')
      expect(formatTime(oldDate.getTime())).toBe(oldDate.toLocaleDateString())
    })
  })

  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('returns unique ids', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(100)
    })

    it('contains timestamp and random segment', () => {
      const id = generateId()
      expect(id).toMatch(/^\d+-[a-z0-9]+$/)
    })
  })
})
