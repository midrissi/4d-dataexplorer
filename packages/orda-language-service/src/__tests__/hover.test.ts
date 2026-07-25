import { describe, expect, test } from 'bun:test'
import { buildCatalogIndex } from '../schema/catalog-index.ts'
import { hover } from '../services/hover-service.ts'
import { testCatalog } from './fixtures.ts'

const index = buildCatalogIndex(testCatalog)

describe('hover', () => {
  test('returns type info for a simple attribute', () => {
    // "firstName = 'John'"  — hover at position 0 (firstName)
    const result = hover("firstName = 'John'", 0, index, 'Users')
    expect(result).not.toBeNull()
    expect(result?.contents.value).toContain('firstName')
    expect(result?.contents.value).toContain('string')
  })

  test('returns indexed info', () => {
    const result = hover("firstName = 'John'", 0, index, 'Users')
    expect(result?.contents.value).toContain('Indexed')
  })

  test('returns relation info for relatedEntity attribute', () => {
    // "user.lastName" in Orders context — hover at 0 (user)
    const result = hover("user.lastName = 'Smith'", 0, index, 'Orders')
    expect(result).not.toBeNull()
    expect(result?.contents.value).toContain('relatedEntity')
  })

  test('hover on second segment of dotted path resolves correctly', () => {
    // "user.lastName" hover at position 5 (lastName)
    const result = hover("user.lastName = 'Smith'", 5, index, 'Orders')
    expect(result).not.toBeNull()
    expect(result?.contents.value).toContain('lastName')
  })

  test('returns null for non-identifier token', () => {
    // hover at position of '=' operator
    const result = hover('age = 18', 4, index, 'Users')
    expect(result).toBeNull()
  })

  test('returns primary key info', () => {
    const result = hover('ID = 1', 0, index, 'Users')
    expect(result?.contents.value).toContain('Primary key')
  })

  test('returns null for unknown attribute', () => {
    const result = hover("nonexistent = 'x'", 0, index, 'Users')
    expect(result).toBeNull()
  })
})
