import { describe, expect, it } from 'bun:test'
import {
  detectFieldType,
  isRelationshipType,
  mapCatalogTypeToFieldType,
  objectValueFormatter,
  objectValueParser,
} from './field-types'

describe('detectFieldType', () => {
  it('returns null for nullish values', () => {
    expect(detectFieldType(null)).toBe('null')
    expect(detectFieldType(undefined)).toBe('null')
  })

  it('detects booleans', () => {
    expect(detectFieldType(true)).toBe('boolean')
    expect(detectFieldType(false)).toBe('boolean')
  })

  it('detects numbers that are not durations', () => {
    expect(detectFieldType(0)).toBe('number')
    expect(detectFieldType(42)).toBe('number')
    expect(detectFieldType(500)).toBe('number')
  })

  it('detects millisecond durations in the plausible range', () => {
    expect(detectFieldType(1000)).toBe('duration')
    expect(detectFieldType(604800000)).toBe('duration')
  })

  it('detects deferred image values', () => {
    expect(detectFieldType({ __deferred: { uri: 'x', image: true } })).toBe('image')
  })

  it('detects 4D !!yyyy-mm-dd!! dates', () => {
    expect(detectFieldType('!!2020-01-01!!')).toBe('date')
  })

  it('detects dd!mm!yyyy dates', () => {
    expect(detectFieldType('01!02!2020')).toBe('date')
    expect(detectFieldType('1!2!2020')).toBe('date')
  })

  it('detects ISO date strings', () => {
    expect(detectFieldType('2020-01-01')).toBe('date')
    expect(detectFieldType('2020-01-01T12:00:00')).toBe('date')
  })

  it('detects plain text', () => {
    expect(detectFieldType('hello')).toBe('text')
  })
})

describe('mapCatalogTypeToFieldType', () => {
  it('maps catalog scalar types', () => {
    expect(mapCatalogTypeToFieldType('bool')).toBe('boolean')
    expect(mapCatalogTypeToFieldType('number')).toBe('number')
    expect(mapCatalogTypeToFieldType('date')).toBe('date')
    expect(mapCatalogTypeToFieldType('duration')).toBe('duration')
    expect(mapCatalogTypeToFieldType('image')).toBe('image')
    expect(mapCatalogTypeToFieldType('object')).toBe('object')
    expect(mapCatalogTypeToFieldType('string')).toBe('text')
    expect(mapCatalogTypeToFieldType('uuid')).toBe('text')
  })

  it('maps relatedEntity kind to object', () => {
    expect(mapCatalogTypeToFieldType('Company', 'relatedEntity')).toBe('object')
  })
})

describe('isRelationshipType', () => {
  it('detects relatedEntity from schema kind', () => {
    expect(isRelationshipType('company', [{ name: 'company', kind: 'relatedEntity' }])).toBe(true)
  })

  it('detects relatedEntities from schema behavior', () => {
    expect(
      isRelationshipType('employees', [{ name: 'employees', behavior: 'relatedEntities' }])
    ).toBe(true)
  })

  it('detects deferred relation values on entities (not images)', () => {
    expect(
      isRelationshipType('company', undefined, [
        { company: { __deferred: { uri: '/rest/Company(1)' } } },
      ])
    ).toBe(true)
    expect(
      isRelationshipType('photo', undefined, [{ photo: { __deferred: { uri: 'x', image: true } } }])
    ).toBe(false)
  })
})

describe('objectValueFormatter', () => {
  it('returns empty string for nullish values', () => {
    expect(objectValueFormatter({ value: null })).toBe('')
    expect(objectValueFormatter({ value: undefined })).toBe('')
  })

  it('stringifies short objects fully', () => {
    expect(objectValueFormatter({ value: { a: 1 } })).toBe('{"a":1}')
  })

  it('truncates long objects with an ellipsis', () => {
    const value = { text: 'a'.repeat(100) }
    const str = JSON.stringify(value)
    expect(objectValueFormatter({ value })).toBe(`${str.slice(0, 80)}…`)
  })
})

describe('objectValueParser', () => {
  it('returns null for null or empty strings', () => {
    expect(objectValueParser({ newValue: null })).toBeNull()
    expect(objectValueParser({ newValue: '' })).toBeNull()
  })

  it('parses valid JSON', () => {
    expect(objectValueParser({ newValue: '{"a":1}' })).toEqual({ a: 1 })
  })

  it('returns null for invalid JSON', () => {
    expect(objectValueParser({ newValue: 'not json' })).toBeNull()
  })
})
