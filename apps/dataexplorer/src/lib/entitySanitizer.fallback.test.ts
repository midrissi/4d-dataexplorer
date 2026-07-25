import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { api } from './api'
import { sanitizeForDuplication, sanitizeForEditing } from './entitySanitizer'

describe('entitySanitizer fallback', () => {
  let getDataclassSchemaSpy: ReturnType<typeof spyOn<typeof api, 'getDataclassSchema'>>

  afterEach(() => {
    getDataclassSchemaSpy?.mockRestore()
  })

  it('sanitizeForEditing returns removeSystemFields when schema fetch fails', async () => {
    getDataclassSchemaSpy = spyOn(api, 'getDataclassSchema').mockRejectedValue(
      new Error('mock schema failure')
    )
    const entity = {
      __KEY: 1,
      __TIMESTAMP: 2,
      __STAMP: 3,
      id: 10,
      name: 'Test',
    }
    const result = await sanitizeForEditing(entity, 'AnyClass')
    expect(result).not.toHaveProperty('__KEY')
    expect(result).not.toHaveProperty('__TIMESTAMP')
    expect(result).not.toHaveProperty('__STAMP')
    expect(result).toHaveProperty('id', 10)
    expect(result).toHaveProperty('name', 'Test')
  })

  it('sanitizeForDuplication returns removeSystemFields when schema fetch fails', async () => {
    getDataclassSchemaSpy = spyOn(api, 'getDataclassSchema').mockRejectedValue(
      new Error('mock schema failure')
    )
    const entity = {
      __KEY: 1,
      __STAMP: 2,
      id: 5,
      name: 'Copy',
    }
    const result = await sanitizeForDuplication(entity, 'AnyClass')
    expect(result).not.toHaveProperty('__KEY')
    expect(result).not.toHaveProperty('__STAMP')
    expect(result).not.toHaveProperty('id')
    expect(result).toHaveProperty('name', 'Copy')
  })
})
