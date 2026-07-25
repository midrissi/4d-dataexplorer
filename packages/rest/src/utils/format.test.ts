import { describe, expect, it } from 'bun:test'
import {
  dateValueToInputValue,
  EMPTY_VALUE,
  formatCurrency,
  formatDate,
  formatDateShort,
  formatDuration,
  formatDurationHuman,
  formatInteger,
  formatNumber,
  formatPercent,
  formatValue,
} from './format'

describe('format', () => {
  describe('EMPTY_VALUE', () => {
    it('is the empty placeholder string', () => {
      expect(EMPTY_VALUE).toBe('—')
    })
  })

  describe('formatDate', () => {
    it('returns EMPTY_VALUE for null, undefined, empty string', () => {
      expect(formatDate(null)).toBe(EMPTY_VALUE)
      expect(formatDate(undefined)).toBe(EMPTY_VALUE)
      expect(formatDate('')).toBe(EMPTY_VALUE)
    })

    it('returns EMPTY_VALUE for 4D null date !!0000-00-00!!', () => {
      expect(formatDate('!!0000-00-00!!')).toBe(EMPTY_VALUE)
    })

    it('returns EMPTY_VALUE for 4D null date 0!0!0', () => {
      expect(formatDate('0!0!0')).toBe(EMPTY_VALUE)
    })

    it('formats 4D !!yyyy-mm-dd!! format', () => {
      const result = formatDate('!!2024-06-15!!')
      expect(result).not.toBe(EMPTY_VALUE)
      expect(result).toContain('2024')
      expect(result).toContain('15')
    })

    it('formats !!yyyy-mm-dd!! with explicit locale', () => {
      const result = formatDate('!!2024-06-15!!', undefined, 'en-US')
      expect(result).toContain('2024')
    })

    it('formats 4D !!yyyy-mm-dd!! format with locale options', () => {
      const result = formatDate('!!2024-06-15!!', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      expect(result).toContain('2024')
    })

    it('formats dd!mm!yyyy without locale using zero-padded fallback', () => {
      expect(formatDate('5!3!2024', undefined, undefined)).toBe('05/03/2024')
    })

    it('formats ISO date string', () => {
      const result = formatDate('2024-06-15')
      expect(result).not.toBe(EMPTY_VALUE)
      expect(result).toContain('2024')
    })

    it('formats Date instance', () => {
      const result = formatDate(new Date('2024-06-15T12:00:00'))
      expect(result).not.toBe(EMPTY_VALUE)
    })
  })

  describe('dateValueToInputValue', () => {
    it('returns empty string for null, undefined, empty', () => {
      expect(dateValueToInputValue(null)).toBe('')
      expect(dateValueToInputValue(undefined)).toBe('')
      expect(dateValueToInputValue('')).toBe('')
    })

    it('returns empty for 4D null date !!0000-00-00!!', () => {
      expect(dateValueToInputValue('!!0000-00-00!!')).toBe('')
    })

    it('returns empty for 4D null date 0!0!0', () => {
      expect(dateValueToInputValue('0!0!0')).toBe('')
    })

    it('converts 4D !!yyyy-mm-dd!! to yyyy-mm-dd', () => {
      expect(dateValueToInputValue('!!2024-06-15!!')).toBe('2024-06-15')
    })

    it('converts 4D dd!mm!yyyy to yyyy-mm-dd', () => {
      expect(dateValueToInputValue('15!6!2024')).toBe('2024-06-15')
      expect(dateValueToInputValue('5!12!2023')).toBe('2023-12-05')
    })

    it('converts ISO date to yyyy-mm-dd', () => {
      expect(dateValueToInputValue('2024-06-15')).toBe('2024-06-15')
    })
  })

  describe('formatDateShort', () => {
    it('formats date without time', () => {
      const result = formatDateShort('!!2024-06-15!!')
      expect(result).not.toBe(EMPTY_VALUE)
    })
  })

  describe('formatDuration', () => {
    it('returns EMPTY_VALUE for null and undefined', () => {
      expect(formatDuration(null)).toBe(EMPTY_VALUE)
      expect(formatDuration(undefined)).toBe(EMPTY_VALUE)
    })

    it('returns "Xms" for duration under 1 second', () => {
      expect(formatDuration(0)).toBe('0ms')
      expect(formatDuration(100)).toBe('100ms')
      expect(formatDuration(999)).toBe('999ms')
    })

    it('returns hh:mm:ss.mmm for duration >= 1 second', () => {
      expect(formatDuration(1000)).toBe('00:00:01.000')
      expect(formatDuration(65_500)).toBe('00:01:05.500')
      expect(formatDuration(3661_500)).toBe('01:01:01.500')
    })

    it('returns String(value) for NaN or negative', () => {
      expect(formatDuration(Number.NaN)).toBe('NaN')
      expect(formatDuration(-100)).toBe('-100')
    })
  })

  describe('formatDurationHuman', () => {
    it('returns EMPTY_VALUE for null and undefined', () => {
      expect(formatDurationHuman(null)).toBe(EMPTY_VALUE)
      expect(formatDurationHuman(undefined)).toBe(EMPTY_VALUE)
    })

    it('formats with human-readable units', () => {
      expect(formatDurationHuman(0)).toBe('0s')
      expect(formatDurationHuman(5000)).toBe('5s')
      expect(formatDurationHuman(65_000)).toBe('1m 5s')
      expect(formatDurationHuman(3665_000)).toBe('1h 1m 5s')
    })
  })

  describe('formatNumber', () => {
    it('returns EMPTY_VALUE for null and undefined', () => {
      expect(formatNumber(null)).toBe(EMPTY_VALUE)
      expect(formatNumber(undefined)).toBe(EMPTY_VALUE)
    })

    it('formats numbers with locale', () => {
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(1234.5)).toMatch(/1[,.]?234[,.]?5/)
    })
  })

  describe('formatInteger', () => {
    it('formats as integer (no decimals)', () => {
      expect(formatInteger(42)).toBe('42')
      expect(formatInteger(42.7)).toMatch(/43/) // or 42 depending on rounding
    })
  })

  describe('formatCurrency', () => {
    it('returns EMPTY_VALUE for null and undefined', () => {
      expect(formatCurrency(null)).toBe(EMPTY_VALUE)
      expect(formatCurrency(undefined)).toBe(EMPTY_VALUE)
    })

    it('formats as currency', () => {
      const result = formatCurrency(99.99)
      expect(result).toContain('99')
      expect(result).toContain('99')
    })

    it('accepts currency code', () => {
      const result = formatCurrency(100, 'EUR')
      expect(result).not.toBe(EMPTY_VALUE)
    })
  })

  describe('formatPercent', () => {
    it('returns EMPTY_VALUE for null and undefined', () => {
      expect(formatPercent(null)).toBe(EMPTY_VALUE)
      expect(formatPercent(undefined)).toBe(EMPTY_VALUE)
    })

    it('formats as percentage', () => {
      const result = formatPercent(0.5)
      expect(result).toContain('50')
    })

    it('accepts decimals option', () => {
      const result = formatPercent(0.5555, 2)
      expect(result).not.toBe(EMPTY_VALUE)
    })
  })

  describe('formatValue', () => {
    it('returns EMPTY_VALUE for null and undefined', () => {
      expect(formatValue(null)).toBe(EMPTY_VALUE)
      expect(formatValue(undefined)).toBe(EMPTY_VALUE)
    })

    it('formats boolean as Yes/No', () => {
      expect(formatValue(true)).toBe('Yes')
      expect(formatValue(false)).toBe('No')
    })

    it('formats number via formatNumber', () => {
      expect(formatValue(42)).not.toBe(EMPTY_VALUE)
      expect(formatValue(42)).toContain('42')
    })

    it('formats array as item count', () => {
      expect(formatValue([1, 2, 3])).toBe('[3 items]')
      expect(formatValue([])).toBe('[0 items]')
    })

    it('formats object as {...}', () => {
      expect(formatValue({ a: 1 })).toBe('{...}')
    })

    it('formats 4D date strings !!yyyy-mm-dd!!', () => {
      const result = formatValue('!!2024-06-15!!')
      expect(result).not.toBe(EMPTY_VALUE)
      expect(result).toContain('2024')
    })

    it('formats 4D date strings dd!mm!yyyy', () => {
      const result = formatValue('15!6!2024')
      expect(result).not.toBe(EMPTY_VALUE)
      expect(result).toBe('15/06/2024')
    })

    it('formats ISO date string via formatValue', () => {
      const result = formatValue('2024-06-15')
      expect(result).not.toBe(EMPTY_VALUE)
      expect(result).toContain('2024')
    })

    it('formats ISO date with locale via formatValue', () => {
      const result = formatValue('2024-06-15', 'en-US')
      expect(result).toContain('2024')
    })

    it('returns String(value) for unhandled string', () => {
      expect(formatValue('plain')).toBe('plain')
    })
  })

  describe('formatDate with locale', () => {
    it('formats 4D date with locale', () => {
      const result = formatDate('!!2024-06-15!!', undefined, 'en-US')
      expect(result).toContain('2024')
    })

    it('formats dd!mm!yyyy with locale', () => {
      const result = formatDate('15!6!2024', undefined, 'en-US')
      expect(result).not.toBe(EMPTY_VALUE)
    })
  })

  describe('error fallbacks', () => {
    it('formatDate returns string on invalid date object', () => {
      expect(formatDate({ valueOf: () => Number.NaN })).toBe('[object Object]')
    })

    it('dateValueToInputValue catch returns empty string', () => {
      expect(
        dateValueToInputValue({
          valueOf: () => {
            throw new Error()
          },
        })
      ).toBe('')
    })

    it('formatNumber catch returns string', () => {
      expect(
        formatNumber({
          valueOf: () => {
            throw new Error()
          },
        })
      ).toBe('[object Object]')
    })

    it('formatCurrency catch returns string', () => {
      expect(
        formatCurrency({
          valueOf: () => {
            throw new Error()
          },
        })
      ).toBe('[object Object]')
    })

    it('formatPercent catch returns string', () => {
      expect(
        formatPercent({
          valueOf: () => {
            throw new Error()
          },
        })
      ).toBe('[object Object]')
    })

    it('formatDurationHuman catch returns string', () => {
      expect(
        formatDurationHuman({
          valueOf: () => {
            throw new Error()
          },
        })
      ).toBe('[object Object]')
    })

    it('formatValue formats ISO datetime', () => {
      const result = formatValue('2024-06-15T10:30:00', 'en-US')
      expect(result).toContain('2024')
    })
  })

  describe('formatDate with options', () => {
    it('uses custom options when provided', () => {
      const result = formatDate('2024-06-15', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      expect(result).not.toBe(EMPTY_VALUE)
      expect(result).toContain('2024')
    })
  })

  describe('formatNumber with options', () => {
    it('uses custom options when provided', () => {
      const result = formatNumber(1234.5678, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      expect(result).toMatch(/\d+[.,]\d{2}/)
    })
  })

  describe('formatDuration catch', () => {
    it('returns String(value) when conversion throws', () => {
      const bad = {
        valueOf: () => {
          throw new Error()
        },
      }
      expect(formatDuration(bad)).toBe('[object Object]')
    })
  })

  describe('formatDurationHuman edge cases', () => {
    it('returns String(value) for NaN', () => {
      expect(formatDurationHuman(Number.NaN)).toBe('NaN')
    })
    it('returns String(value) for negative', () => {
      expect(formatDurationHuman(-1)).toBe('-1')
    })
  })

  describe('formatPercent with decimals', () => {
    it('formats with 2 decimals', () => {
      const result = formatPercent(0.5555, 2)
      expect(result).toMatch(/\d+[.,]\d{2}\s?%/)
    })
  })
})
