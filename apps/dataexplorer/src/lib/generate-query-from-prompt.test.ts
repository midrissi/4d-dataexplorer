import { describe, expect, test } from 'bun:test'
import {
  normalizeWildcardFilterSyntax,
  parseGeneratedQueryOptions,
} from './generate-query-from-prompt'

describe('parseGeneratedQueryOptions', () => {
  test('parses typed filter params and order', () => {
    const options = parseGeneratedQueryOptions(
      JSON.stringify({
        filter: 'firstname = :1 OR lastname = :1',
        filterParams: [{ type: 'string', value: 'L@' }],
        sort: 'lastname',
        order: 'desc',
        select: 'firstname, lastname',
      })
    )

    expect(options.filter).toBe('firstname = :1 OR lastname = :1')
    expect(options.filterParams).toEqual([{ type: 'string', value: 'L@' }])
    expect(options.sort).toBe('lastname')
    expect(options.order).toBe('desc')
    expect(options.select).toBe('firstname, lastname')
  })

  test('coerces bare param values and strips markdown fences', () => {
    const options = parseGeneratedQueryOptions(`\`\`\`json
{"filter":"age > :1","filterParams":[30],"sort":"","order":"asc","select":""}
\`\`\``)

    expect(options.filter).toBe('age > :1')
    expect(options.filterParams).toEqual([{ type: 'number', value: '30' }])
    expect(options.order).toBe('asc')
  })

  test('rewrites invalid "@" operator into equals + wildcard param', () => {
    const options = parseGeneratedQueryOptions(
      JSON.stringify({
        filter: 'registration @ :1',
        filterParams: [{ type: 'string', value: 'A' }],
        sort: '',
        order: 'asc',
        select: '',
      })
    )

    expect(options.filter).toBe('registration = :1')
    expect(options.filterParams).toEqual([{ type: 'string', value: 'A@' }])
  })
})

describe('normalizeWildcardFilterSyntax', () => {
  test('leaves correct starts-with queries unchanged', () => {
    const input = {
      filter: 'registration = :1',
      filterParams: [{ type: 'string' as const, value: 'A@' }],
      sort: '',
      order: 'asc' as const,
      select: '',
      top: 100,
    }
    expect(normalizeWildcardFilterSyntax(input)).toEqual(input)
  })
})
