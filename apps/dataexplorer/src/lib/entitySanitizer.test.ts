import { describe, expect, it } from 'bun:test'
import { removeStatusField, sanitizeForDuplication, sanitizeForEditing } from './entitySanitizer'

describe('entitySanitizer', () => {
  describe('removeStatusField', () => {
    it('removes __STATUS from entity', () => {
      const entity = { name: 'Test', __STATUS: 'updated', __KEY: 1 }
      const result = removeStatusField(entity)
      expect(result).not.toHaveProperty('__STATUS')
      expect(result).toEqual({ name: 'Test', __KEY: 1 })
    })

    it('returns copy without mutating input', () => {
      const entity = { a: 1, __STATUS: 'x' }
      const result = removeStatusField(entity)
      expect(result).not.toBe(entity)
      expect(entity).toHaveProperty('__STATUS')
    })

    it('returns entity unchanged when __STATUS is absent', () => {
      const entity = { name: 'Test' }
      const result = removeStatusField(entity)
      expect(result).toEqual(entity)
    })
  })

  describe('sanitizeForEditing', () => {
    it('returns entity as-is when dataclassName is null', async () => {
      const entity = { name: 'Test', __KEY: 1 }
      const result = await sanitizeForEditing(entity, null)
      expect(result).toBe(entity)
    })
  })

  describe('sanitizeForDuplication', () => {
    it('removes system fields when dataclassName is null', async () => {
      const entity = { name: 'Test', __KEY: 1, __STAMP: 2, __TIMESTAMP: 1, id: 3 }
      const result = await sanitizeForDuplication(entity, null)
      expect(result).not.toHaveProperty('__KEY')
      expect(result).not.toHaveProperty('__STAMP')
      expect(result).not.toHaveProperty('__TIMESTAMP')
      expect(result).not.toHaveProperty('id')
      expect(result).toHaveProperty('name', 'Test')
    })
  })
})
