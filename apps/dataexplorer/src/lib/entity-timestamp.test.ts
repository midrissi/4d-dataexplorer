import { describe, expect, it } from 'bun:test'
import { formatTimestamp, getEntityTimestamp, TIMESTAMP_FIELDS } from './entity-timestamp'

const baseEntity = { id: '1', __KEY: '1', __STAMP: 0 }

describe('formatTimestamp', () => {
  it('returns null for falsy values', () => {
    expect(formatTimestamp(null)).toBeNull()
    expect(formatTimestamp(undefined)).toBeNull()
    expect(formatTimestamp('')).toBeNull()
    expect(formatTimestamp(0)).toBeNull()
  })

  it('formats a valid ISO date string', () => {
    const formatted = formatTimestamp('2024-06-15T12:00:00Z', 'en')
    expect(formatted).toBeTruthy()
    expect(formatted).toContain('2024')
  })

  it('formats a 4D dd!mm!yyyy date without a locale', () => {
    expect(formatTimestamp('15!6!2024')).toBe('15/06/2024')
  })

  it('returns null for 4D empty dates', () => {
    expect(formatTimestamp('0!0!0')).toBeNull()
    expect(formatTimestamp('!!0000-00-00!!')).toBeNull()
  })
})

describe('getEntityTimestamp', () => {
  it('picks the first matching TIMESTAMP_FIELDS entry', () => {
    expect(TIMESTAMP_FIELDS[0]).toBe('__TIMESTAMP')
    const result = getEntityTimestamp(
      {
        ...baseEntity,
        createdAt: '2024-06-15T12:00:00Z',
        updatedAt: '2024-07-01T12:00:00Z',
      },
      'en'
    )
    const formatted = formatTimestamp('2024-06-15T12:00:00Z', 'en')
    expect(formatted).toBeTruthy()
    expect(result).toEqual({ field: 'createdAt', value: formatted as string })
  })

  it('prefers __TIMESTAMP when present', () => {
    const result = getEntityTimestamp(
      {
        ...baseEntity,
        __TIMESTAMP: '2024-01-01T00:00:00Z',
        createdAt: '2024-06-15T12:00:00Z',
      },
      'en'
    )
    expect(result?.field).toBe('__TIMESTAMP')
  })

  it('returns null when no timestamp field matches', () => {
    expect(getEntityTimestamp(baseEntity)).toBeNull()
  })
})
