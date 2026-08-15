import { describe, expect, it, mock } from 'bun:test'
import { type FetchFunction, HttpClient } from '../core/http-client'
import type { Entity } from '../types'
import {
  normalizeFilterExpression,
  normalizeOrderByExpression,
  QueryBuilder,
} from './query-builder'

type Call = {
  method: string
  path: string
  search: string
  params: Record<string, string>
  body: unknown
}

type EmployeeEntity = Entity & {
  firstName?: string
}

function makeHttp(response: unknown = {}) {
  const calls: Call[] = []
  const mockFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const rawBody = request.method === 'GET' ? '' : await request.text()
    calls.push({
      method: request.method,
      path: url.pathname.replace(/^\/rest/, ''),
      search: url.search,
      params: Object.fromEntries(url.searchParams.entries()),
      body: rawBody ? JSON.parse(rawBody) : undefined,
    })
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  const http = new HttpClient({
    baseUrl: 'http://127.0.0.1:8044',
    fetch: mockFetch as unknown as FetchFunction,
  })
  return { http, calls }
}

describe('normalizeOrderByExpression', () => {
  it('wraps attribute and direction in double quotes', () => {
    expect(normalizeOrderByExpression('departureDate desc')).toBe('"departureDate desc"')
  })

  it('wraps a single attribute for default ascending order', () => {
    expect(normalizeOrderByExpression('lastName')).toBe('"lastName"')
  })

  it('supports comma-separated sort clauses', () => {
    expect(normalizeOrderByExpression('salary DESC, lastName ASC')).toBe(
      '"salary DESC, lastName ASC"'
    )
  })

  it('strips existing surrounding double quotes before re-wrapping', () => {
    expect(normalizeOrderByExpression('"departureDate desc"')).toBe('"departureDate desc"')
  })

  it('strips existing surrounding single quotes before re-wrapping', () => {
    expect(normalizeOrderByExpression("'departureDate desc'")).toBe('"departureDate desc"')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeOrderByExpression('   ')).toBe('')
  })

  it('escapes internal double quotes', () => {
    expect(normalizeOrderByExpression('name = "x"')).toBe('"name = \\u0022x\\u0022"')
  })
})

describe('normalizeFilterExpression', () => {
  it('wraps a plain expression in double quotes', () => {
    expect(normalizeFilterExpression('firstName = :1')).toBe('"firstName = :1"')
  })

  it('strips surrounding double quotes', () => {
    expect(normalizeFilterExpression('"firstName = :1"')).toBe('"firstName = :1"')
  })

  it('strips surrounding single quotes', () => {
    expect(normalizeFilterExpression("'firstName = :1'")).toBe('"firstName = :1"')
  })

  it('escapes internal double quotes', () => {
    expect(normalizeFilterExpression('name = "John"')).toBe('"name = \\u0022John\\u0022"')
  })

  it('returns wrapped empty string for blank input', () => {
    expect(normalizeFilterExpression('   ')).toBe('""')
  })
})

describe('QueryBuilder option building', () => {
  it('builds filter option immutably', () => {
    const { http } = makeHttp()
    const qb = new QueryBuilder(http, 'Employee')
    const filtered = qb.filter('salary > :1')
    expect(filtered.buildOptions().$filter).toBe('"salary > :1"')
    expect(qb.buildOptions().$filter).toBeUndefined()
  })

  it('sets params only when values are provided', () => {
    const { http } = makeHttp()
    const withParams = new QueryBuilder(http, 'Employee').params('Smith', 30)
    expect(withParams.buildOptions().$params).toBe(JSON.stringify(['Smith', 30]))

    const noParams = new QueryBuilder(http, 'Employee').params()
    expect(noParams.buildOptions().$params).toBeUndefined()
  })

  it('builds orderBy with and without direction', () => {
    const { http } = makeHttp()
    expect(new QueryBuilder(http, 'E').orderBy('lastName').buildOptions().$orderby).toBe(
      '"lastName"'
    )
    expect(new QueryBuilder(http, 'E').orderBy('lastName', 'desc').buildOptions().$orderby).toBe(
      '"lastName desc"'
    )
  })

  it('joins select attributes and expand relations', () => {
    const { http } = makeHttp()
    expect(new QueryBuilder(http, 'E').select('a', 'b').buildOptions().$attributes).toBe('a,b')
    expect(new QueryBuilder(http, 'E').expand('rel', 'rel.*').buildOptions().$expand).toBe(
      'rel,rel.*'
    )
  })

  it('supports top, limit alias, and skip', () => {
    const { http } = makeHttp()
    expect(new QueryBuilder(http, 'E').top(5).buildOptions().$top).toBe(5)
    expect(new QueryBuilder(http, 'E').limit(7).buildOptions().$top).toBe(7)
    expect(new QueryBuilder(http, 'E').skip(10).buildOptions().$skip).toBe(10)
  })

  it('supports timeout, saveFilter, saveOrderBy, distinct, query path/plan', () => {
    const { http } = makeHttp()
    expect(new QueryBuilder(http, 'E').timeout(60).buildOptions().$timeout).toBe(60)
    expect(new QueryBuilder(http, 'E').saveFilter().buildOptions().$savedfilter).toBe(true)
    expect(new QueryBuilder(http, 'E').saveFilter(false).buildOptions().$savedfilter).toBe(false)
    expect(new QueryBuilder(http, 'E').saveOrderBy().buildOptions().$savedorderby).toBe(true)
    expect(new QueryBuilder(http, 'E').distinct().buildOptions().$distinct).toBe(true)
    expect(new QueryBuilder(http, 'E').withQueryPath().buildOptions().$querypath).toBe(true)
    expect(new QueryBuilder(http, 'E').withQueryPlan().buildOptions().$queryplan).toBe(true)
  })

  it('builds the request path from the dataclass name', () => {
    const { http } = makeHttp()
    expect(new QueryBuilder(http, 'Employee').buildPath()).toBe('/Employee')
  })

  it('preserves prior params when cloning', () => {
    const { http } = makeHttp()
    const qb = new QueryBuilder(http, 'E').params('a').filter('x = :1')
    expect(qb.buildOptions().$params).toBe(JSON.stringify(['a']))
    expect(qb.buildOptions().$filter).toBe('"x = :1"')
  })
})

describe('QueryBuilder terminal operations', () => {
  it('fetch issues a GET with options', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [{ __KEY: '1', __STAMP: 1 }], __COUNT: 1 })
    const result = await new QueryBuilder<EmployeeEntity>(http, 'Employee').top(2).fetch()
    expect(result.__ENTITIES).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/Employee')
    expect(calls[0].params.$top).toBe('2')
  })

  it('fetchOne returns the first entity', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [{ __KEY: '1', __STAMP: 1 }], __COUNT: 1 })
    const entity = await new QueryBuilder<EmployeeEntity>(http, 'Employee').fetchOne()
    expect(entity).toEqual({ __KEY: '1', __STAMP: 1 })
    expect(calls[0].params.$top).toBe('1')
  })

  it('fetchOne returns null when empty', async () => {
    const { http } = makeHttp({ __ENTITIES: [], __COUNT: 0 })
    const entity = await new QueryBuilder<EmployeeEntity>(http, 'Employee').fetchOne()
    expect(entity).toBeNull()
  })

  it('fetchAll returns the entities array', async () => {
    const { http } = makeHttp({
      __ENTITIES: [
        { __KEY: '1', __STAMP: 1 },
        { __KEY: '2', __STAMP: 2 },
      ],
      __COUNT: 2,
    })
    const entities = await new QueryBuilder<EmployeeEntity>(http, 'Employee').fetchAll()
    expect(entities).toHaveLength(2)
  })

  it('toEntitySet parses the entity set id', async () => {
    const { http, calls } = makeHttp({
      __ENTITIES: [],
      __COUNT: 3,
      __ENTITYSET: '/rest/Employee/$entityset/ABC123',
    })
    const ref = await new QueryBuilder(http, 'Employee').filter('x = :1').toEntitySet()
    expect(ref.id).toBe('ABC123')
    expect(ref.uri).toBe('/rest/Employee/$entityset/ABC123')
    expect(ref.dataClass).toBe('Employee')
    expect(ref.count).toBe(3)
    expect(calls[0].params.$method).toBe('entityset')
  })

  it('toEntitySet applies an explicit timeout', async () => {
    const { http, calls } = makeHttp({
      __ENTITIES: [],
      __COUNT: 0,
      __ENTITYSET: '/rest/Employee/$entityset/XYZ',
    })
    await new QueryBuilder(http, 'Employee').toEntitySet(120)
    expect(calls[0].params.$timeout).toBe('120')
  })

  it('delete posts with the delete method', async () => {
    const { http, calls } = makeHttp({ ok: true })
    await new QueryBuilder(http, 'Employee').filter('x = :1').delete()
    expect(calls[0].method).toBe('POST')
    expect(calls[0].params.$method).toBe('delete')
  })

  it('compute targets the attribute path', async () => {
    const { http, calls } = makeHttp({ sum: 100 })
    await new QueryBuilder(http, 'Employee').compute('sum', 'salary')
    expect(calls[0].path).toBe('/Employee/salary')
    expect(calls[0].params.$compute).toBe('sum')
  })

  it('distinctValues targets the attribute path with $distinct', async () => {
    const { http, calls } = makeHttp(['Adobe', 'Apple'])
    const values = await new QueryBuilder(http, 'Company')
      .filter('name = a*')
      .top(50)
      .distinctValues('name')
    expect(values).toEqual(['Adobe', 'Apple'])
    expect(calls[0].path).toBe('/Company/name')
    expect(calls[0].params.$distinct).toBe('true')
    expect(calls[0].params.$filter).toBe('"name = a*"')
    expect(calls[0].params.$top).toBe('50')
  })

  it('count returns the COUNT field', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [], __COUNT: 42 })
    const total = await new QueryBuilder(http, 'Employee').count()
    expect(total).toBe(42)
    expect(calls[0].params.$top).toBe('0')
  })
})
