import { describe, expect, it } from 'bun:test'
import { previewSelectionColumns } from './preview-selection-columns'

describe('previewSelectionColumns', () => {
  it('keeps scalar fields and drops __* keys', () => {
    expect(
      previewSelectionColumns([{ __KEY: '1', __DATACLASS: 'City', name: 'Paris', pop: 2 }])
    ).toEqual(['name', 'pop'])
  })

  it('drops deferred relation columns', () => {
    expect(
      previewSelectionColumns([
        {
          __KEY: '1',
          name: 'Paris',
          country: { __deferred: { uri: '/rest/Country(1)' } },
        },
      ])
    ).toEqual(['name'])
  })

  it('limits to five columns', () => {
    const entity = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, i]))
    expect(previewSelectionColumns([entity])).toHaveLength(5)
  })
})
