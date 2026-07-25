import { describe, expect, test } from 'bun:test'
import { findSqlInQueryParts, looksLikeSql } from './reject-sql-in-query'

describe('looksLikeSql', () => {
  test('detects SELECT subqueries', () => {
    expect(looksLikeSql("(SELECT ID FROM Color WHERE name = 'Red')")).toBe(true)
    expect(looksLikeSql("SELECT ID FROM Color WHERE name = 'Red'")).toBe(true)
  })

  test('allows normal 4D filter values', () => {
    expect(looksLikeSql('12')).toBe(false)
    expect(looksLikeSql('A@')).toBe(false)
    expect(looksLikeSql('Red')).toBe(false)
    expect(looksLikeSql('ID_color = :1')).toBe(false)
  })
})

describe('findSqlInQueryParts', () => {
  test('flags SQL in filterParams values', () => {
    expect(
      findSqlInQueryParts({
        filter: 'ID_color = :1',
        filterParams: [{ type: 'number', value: "(SELECT ID FROM Color WHERE name = 'Red')" }],
      })
    ).toContain('filterParams[:1]')
  })

  test('returns null for valid parts', () => {
    expect(
      findSqlInQueryParts({
        filter: 'ID_color = :1',
        filterParams: [{ type: 'number', value: '12' }],
      })
    ).toBeNull()
  })
})
