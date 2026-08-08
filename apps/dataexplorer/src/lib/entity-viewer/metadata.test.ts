import { describe, expect, it } from 'bun:test'
import { EMPTY_VALUE } from '@4d/rest'
import { formatMetadataValue, prettyMetadataLabel } from './metadata'

describe('prettyMetadataLabel', () => {
  it('strips leading underscores', () => {
    expect(prettyMetadataLabel('__KEY')).toBe('KEY')
    expect(prettyMetadataLabel('name')).toBe('name')
  })
})

describe('formatMetadataValue', () => {
  it('renders nulls and objects', () => {
    expect(formatMetadataValue(null, 'en')).toBe(EMPTY_VALUE)
    expect(formatMetadataValue({ a: 1 }, 'en')).toBe('{"a":1}')
    expect(formatMetadataValue(12, 'en')).toBe('12')
  })
})
