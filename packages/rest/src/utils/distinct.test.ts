import { describe, expect, it } from 'bun:test'
import { parseDistinctResponse } from './distinct'

describe('parseDistinctResponse', () => {
  it('returns a raw JSON array', () => {
    expect(parseDistinctResponse([1, 2, 3], 'ID')).toEqual([1, 2, 3])
    expect(parseDistinctResponse(['Adobe', 'Apple'], 'name')).toEqual(['Adobe', 'Apple'])
  })

  it('unwraps __ENTITIES collections and entity-shaped rows', () => {
    expect(parseDistinctResponse({ __ENTITIES: [1, 2] }, 'ID')).toEqual([1, 2])
    expect(
      parseDistinctResponse(
        {
          __ENTITIES: [
            { __KEY: '1', ID: 1 },
            { __KEY: '2', ID: 2 },
          ],
        },
        'ID'
      )
    ).toEqual([1, 2])
  })

  it('reads values keyed by the attribute name', () => {
    expect(parseDistinctResponse({ ID: [10, 20] }, 'ID')).toEqual([10, 20])
  })

  it('ignores 4D __ERROR payloads', () => {
    expect(parseDistinctResponse({ __ERROR: [{ message: 'nope' }] }, 'ID')).toEqual([])
  })

  it('falls back to __KEY when the attribute is missing on a row', () => {
    expect(parseDistinctResponse([{ __KEY: '9' }], 'ID')).toEqual(['9'])
  })
})
