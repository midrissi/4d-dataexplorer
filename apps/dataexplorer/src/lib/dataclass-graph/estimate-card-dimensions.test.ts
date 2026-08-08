import { describe, expect, test } from 'bun:test'
import type { DataClass, DataClassAttribute } from '@4d/rest'
import { estimateCardDimensions } from './estimate-card-dimensions'

function dataclass(name: string, attributes: DataClassAttribute[] = []): DataClass {
  return {
    name,
    collectionName: `${name}Collection`,
    dataURI: `/rest/${name}`,
    key: [{ name: 'ID' }],
    attributes,
  }
}

describe('estimateCardDimensions', () => {
  test('uses width 320 for an empty dataclass', () => {
    const empty = estimateCardDimensions(dataclass('Empty'))
    expect(empty.width).toBe(320)
    expect(empty.height).toBe(92)
  })

  test('keeps width 320 and grows height when storage attributes are present', () => {
    const empty = estimateCardDimensions(dataclass('Empty'))
    const withStorage = estimateCardDimensions(
      dataclass('Employee', [
        { name: 'ID', kind: 'storage', type: 'long' },
        { name: 'name', kind: 'storage', type: 'string' },
      ])
    )

    expect(withStorage.width).toBe(320)
    expect(withStorage.height).toBeGreaterThan(empty.height)
  })
})
