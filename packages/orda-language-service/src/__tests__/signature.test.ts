import { describe, expect, test } from 'bun:test'
import { signature } from '../services/signature-service.ts'

describe('signature', () => {
  test('returns null for query with no placeholders', () => {
    expect(signature("firstName = 'John'", 0)).toBeNull()
  })

  test('returns SignatureHelp for single placeholder', () => {
    const result = signature('age > :1', 8)
    expect(result).not.toBeNull()
    expect(result?.signatures).toHaveLength(1)
    expect(result?.signatures[0].parameters).toHaveLength(1)
  })

  test('returns correct parameter count for multiple placeholders', () => {
    const result = signature('age > :1 AND salary <= :2', 0)
    expect(result?.signatures[0].parameters).toHaveLength(2)
  })

  test('activeParameter is 0 when cursor is at :1', () => {
    const q = 'age > :1 AND salary <= :2'
    const result = signature(q, 6) // cursor at :1
    expect(result?.activeParameter).toBe(0)
  })

  test('activeParameter is 1 when cursor is at :2', () => {
    const q = 'age > :1 AND salary <= :2'
    const result = signature(q, q.length - 2) // cursor near :2
    expect(result?.activeParameter).toBe(1)
  })

  test('signature label includes placeholder labels', () => {
    const result = signature('a = :1 AND b = :2', 0)
    expect(result?.signatures[0].label).toContain(':1')
    expect(result?.signatures[0].label).toContain(':2')
  })
})
