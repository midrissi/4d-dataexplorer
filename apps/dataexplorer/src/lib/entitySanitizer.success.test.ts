import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { api } from './api'
import { sanitizeForDuplication, sanitizeForEditing } from './entitySanitizer'

const mockSchema = {
  dataclass: 'TestClass',
  key: 'id',
  attributes: [
    { name: 'id', kind: 'scalar', type: 'long', readOnly: true },
    { name: 'name', kind: 'scalar', type: 'string', readOnly: false },
    { name: 'relation', kind: 'relatedEntity', type: 'entity', readOnly: false },
    { name: 'items', kind: 'relatedEntities', type: 'entity', readOnly: false },
    { name: 'photo', type: 'image', kind: 'scalar', readOnly: false },
    { name: 'readonlyField', kind: 'scalar', type: 'string', readOnly: true },
  ],
} as Awaited<ReturnType<typeof api.getDataclassSchema>>

describe('entitySanitizer success path', () => {
  let getDataclassSchemaSpy: ReturnType<typeof spyOn<typeof api, 'getDataclassSchema'>>

  afterEach(() => {
    getDataclassSchemaSpy?.mockRestore()
  })

  it('sanitizeForEditing filters by schema when fetch succeeds', async () => {
    getDataclassSchemaSpy = spyOn(api, 'getDataclassSchema').mockResolvedValue(mockSchema)
    const entity = {
      __KEY: 1,
      __TIMESTAMP: 2,
      id: 10,
      name: 'Test',
      relation: 5,
      items: [1, 2],
      photo: 'blob://x',
      readonlyField: 'x',
    }
    const result = await sanitizeForEditing(entity, 'TestClass')
    expect(result).not.toHaveProperty('__KEY')
    expect(result).not.toHaveProperty('__TIMESTAMP')
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('relation')
    expect(result).not.toHaveProperty('items')
    expect(result).not.toHaveProperty('photo')
    expect(result).not.toHaveProperty('readonlyField')
    expect(result).toHaveProperty('name', 'Test')
  })

  it('sanitizeForDuplication filters by schema when fetch succeeds', async () => {
    getDataclassSchemaSpy = spyOn(api, 'getDataclassSchema').mockResolvedValue(mockSchema)
    const entity = {
      __KEY: 1,
      __STAMP: 2,
      __TIMESTAMP: 3,
      id: 10,
      name: 'Copy',
      relation: 5,
    }
    const result = await sanitizeForDuplication(entity, 'TestClass')
    expect(result).not.toHaveProperty('__KEY')
    expect(result).not.toHaveProperty('__STAMP')
    expect(result).not.toHaveProperty('__TIMESTAMP')
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('relation')
    expect(result).toHaveProperty('name', 'Copy')
  })
})
