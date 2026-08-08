import { describe, expect, it } from 'bun:test'
import { extractEntitySetId } from './extract-entity-set-id'

describe('extractEntitySetId', () => {
  it('accepts a bare id', () => {
    expect(extractEntitySetId('ABC')).toBe('ABC')
  })

  it('extracts the id from a REST entity-set URI', () => {
    expect(extractEntitySetId('/rest/City/$entityset/ABC?x=1')).toBe('ABC')
    expect(extractEntitySetId('/rest/Reservation/$entityset/591C3B')).toBe('591C3B')
  })

  it('returns undefined for empty values', () => {
    expect(extractEntitySetId('')).toBeUndefined()
    expect(extractEntitySetId('   ')).toBeUndefined()
    expect(extractEntitySetId(null)).toBeUndefined()
  })
})
