import { describe, expect, it } from 'bun:test'
import { normalizeEntityMutationResults } from './entity-mutation'

describe('normalizeEntityMutationResults', () => {
  it('returns arrays unchanged', () => {
    const input = [{ __entityModel: 'User', __KEY: '1', __STAMP: 1 }]
    expect(normalizeEntityMutationResults(input)).toBe(input)
  })

  it('unwraps __ENTITIES collections', () => {
    const entities = [
      { __entityModel: 'User', __KEY: '1', __STAMP: 1 },
      { __entityModel: 'User', __KEY: '2', __STAMP: 1 },
    ]
    const result = normalizeEntityMutationResults({
      __entityModel: 'User',
      __COUNT: 2,
      __SENT: 2,
      __FIRST: 0,
      __ENTITIES: entities,
    })
    expect(result).toEqual(entities)
  })

  it('wraps a single entity object', () => {
    const entity = { __entityModel: 'User', __KEY: '1', __STAMP: 1, firstname: 'Emma' }
    expect(normalizeEntityMutationResults(entity)).toEqual([entity])
  })

  it('returns empty array for nullish values', () => {
    expect(normalizeEntityMutationResults(null)).toEqual([])
    expect(normalizeEntityMutationResults(undefined)).toEqual([])
  })

  it('returns empty array for objects that are neither collections nor entities', () => {
    expect(normalizeEntityMutationResults({ foo: 'bar' } as never)).toEqual([])
  })
})
