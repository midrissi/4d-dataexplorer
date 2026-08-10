import { describe, expect, it } from 'bun:test'
import { getEnvTemplateBaseKey, parseTemplateExpression } from './env-template-expression'

describe('parseTemplateExpression', () => {
  it('parses a bare key', () => {
    expect(parseTemplateExpression('baseUrl')).toEqual({ key: 'baseUrl', filters: [] })
  })

  it('trims the key', () => {
    expect(parseTemplateExpression('  $timestamp  ')).toEqual({
      key: '$timestamp',
      filters: [],
    })
  })

  it('parses filters without args', () => {
    expect(parseTemplateExpression('$faker.person.firstName | female | upper')).toEqual({
      key: '$faker.person.firstName',
      filters: [
        { name: 'female', args: [] },
        { name: 'upper', args: [] },
      ],
    })
  })

  it('parses filters with comma args', () => {
    expect(parseTemplateExpression('$faker.number.int | between:10, 100')).toEqual({
      key: '$faker.number.int',
      filters: [{ name: 'between', args: ['10', '100'] }],
    })
  })

  it('parses date bounds', () => {
    expect(
      parseTemplateExpression('$faker.date.between | after:2020-01-01 | before:2025-12-31')
    ).toEqual({
      key: '$faker.date.between',
      filters: [
        { name: 'after', args: ['2020-01-01'] },
        { name: 'before', args: ['2025-12-31'] },
      ],
    })
  })

  it('returns null for empty interior', () => {
    expect(parseTemplateExpression('')).toBeNull()
    expect(parseTemplateExpression('   ')).toBeNull()
  })

  it('skips empty filter segments', () => {
    expect(parseTemplateExpression('name |  | upper')).toEqual({
      key: 'name',
      filters: [{ name: 'upper', args: [] }],
    })
  })
})

describe('getEnvTemplateBaseKey', () => {
  it('strips filters', () => {
    expect(getEnvTemplateBaseKey('$faker.number.int | between:1,5')).toBe('$faker.number.int')
  })

  it('returns trimmed key when no filters', () => {
    expect(getEnvTemplateBaseKey('  token  ')).toBe('token')
  })
})
