import { describe, expect, it } from 'bun:test'
import { detectMethodResult, extractEntitySetId } from './detect-method-result'

describe('detectMethodResult', () => {
  it('unwraps and detects an entity', () => {
    expect(detectMethodResult({ result: { __KEY: '1', __DATACLASS: 'City' } })).toMatchObject({
      kind: 'entity',
      value: { __KEY: '1' },
    })
  })

  it('detects an entity without __KEY (e.g. new booking)', () => {
    expect(
      detectMethodResult({
        result: {
          __entityModel: 'Reservation',
          __DATACLASS: 'Reservation',
          departureDate: '!!2026-01-01!!',
        },
      })
    ).toMatchObject({
      kind: 'entity',
      value: { __DATACLASS: 'Reservation' },
    })
  })

  it('detects an entity from __entityModel alone', () => {
    expect(detectMethodResult({ __entityModel: 'Reservation', ID: 1 })).toMatchObject({
      kind: 'entity',
    })
  })

  it('detects an entity selection and its metadata', () => {
    expect(
      detectMethodResult({
        result: {
          __entityModel: 'City',
          __COUNT: 30,
          __ENTITYSET: '/rest/City/$entityset/ABC',
          __ENTITIES: [{ __KEY: '1' }],
        },
      })
    ).toMatchObject({
      kind: 'entitysel',
      dataClass: 'City',
      entitySetId: 'ABC',
      count: 30,
    })
  })

  it('detects a direct entity-set payload (no result wrapper)', () => {
    expect(
      detectMethodResult({
        __ENTITYSET: '/rest/Agency/$entityset/ABC',
        __DATACLASS: 'Agency',
        __COUNT: 490,
        __ENTITIES: [{ __KEY: '1', ID: 1 }],
        __entityModel: 'Agency',
      })
    ).toMatchObject({
      kind: 'entitysel',
      dataClass: 'Agency',
      entitySetId: 'ABC',
      count: 490,
    })
  })

  it('keeps ordinary results as-is', () => {
    expect(detectMethodResult({ result: 42 })).toEqual({ kind: 'other', value: 42 })
  })

  it('unwraps a private binary object under result', () => {
    const payload = { __PRIVATE_BINARY_OBJECT: 'Bf3/abc' }
    expect(detectMethodResult({ result: payload })).toEqual({
      kind: 'other',
      value: payload,
    })
  })
})

describe('extractEntitySetId', () => {
  it('accepts an id or an entity-set URI', () => {
    expect(extractEntitySetId('ABC')).toBe('ABC')
    expect(extractEntitySetId('/rest/City/$entityset/ABC?x=1')).toBe('ABC')
  })
})
