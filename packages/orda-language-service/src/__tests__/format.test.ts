import { describe, expect, test } from 'bun:test'
import { format } from '../services/format-service.ts'

describe('format', () => {
  test('normalises == to =', () => {
    expect(format("firstName=='John'")).toBe("firstName = 'John'")
  })

  test('normalises === to IS', () => {
    expect(format('active===true')).toBe('active IS true')
  })

  test('normalises && to AND', () => {
    expect(format('a = 1&&b = 2')).toBe('a = 1 AND b = 2')
  })

  test('normalises || to OR', () => {
    expect(format('a = 1||b = 2')).toBe('a = 1 OR b = 2')
  })

  test('uppercases keywords by default', () => {
    expect(format('a = 1 and b = 2')).toContain('AND')
  })

  test('lowercases keywords when configured', () => {
    expect(format('a = 1 AND b = 2', { keywordCase: 'lower' })).toContain('and')
  })

  test('preserves keyword case when configured', () => {
    const result = format('a = 1 And b = 2', { keywordCase: 'preserve' })
    expect(result).toContain('And')
  })

  test('adds space around operators', () => {
    const result = format('age>18')
    expect(result).toBe('age > 18')
  })

  test('adds space around less-than-or-equal', () => {
    expect(format('age<=65')).toBe('age <= 65')
  })

  test('preserves parentheses grouping', () => {
    const result = format('(a=1 OR b=2) AND c=3')
    expect(result).toContain('(')
    expect(result).toContain(')')
  })

  test('trims leading/trailing whitespace', () => {
    expect(format("  firstName = 'John'  ")).toBe("firstName = 'John'")
  })

  test('empty string returns empty string', () => {
    expect(format('')).toBe('')
  })

  test('no duplicate spaces around dot', () => {
    const result = format("user . lastName = 'Smith'")
    expect(result).not.toContain('  ')
  })

  test('disabling operator normalisation preserves ==', () => {
    const result = format("a=='b'", { normalizeOperators: false })
    expect(result).toContain('==')
  })
})
