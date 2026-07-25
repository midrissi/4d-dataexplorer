import { describe, expect, it } from 'bun:test'
import { makeHttp } from '../mock-http.test-helper'
import { EntitySetResource } from './entityset.resource'

const SET_PATH = '/Employee/$entityset/ABC'

describe('EntitySetResource', () => {
  it('exposes its id', () => {
    const { http } = makeHttp()
    expect(new EntitySetResource(http, 'Employee', 'ABC').id).toBe('ABC')
  })

  it('fetch() reads the entity set', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [], __COUNT: 0 })
    await new EntitySetResource(http, 'Employee', 'ABC').fetch()
    expect(calls[0].path).toBe(SET_PATH)
  })

  it('fetchPage() applies skip and top', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [], __COUNT: 0 })
    await new EntitySetResource(http, 'Employee', 'ABC').fetchPage(20, 10)
    expect(calls[0].params.$skip).toBe('20')
    expect(calls[0].params.$top).toBe('10')
  })

  it('release() uses the release method', async () => {
    const { http, calls } = makeHttp({ ok: true })
    const res = await new EntitySetResource(http, 'Employee', 'ABC').release()
    expect(res.ok).toBe(true)
    expect(calls[0].params.$method).toBe('release')
  })

  it('delete() posts the delete method', async () => {
    const { http, calls } = makeHttp({ ok: true })
    await new EntitySetResource(http, 'Employee', 'ABC').delete()
    expect(calls[0].method).toBe('POST')
    expect(calls[0].params.$method).toBe('delete')
  })

  it('clean() sets the clean flag', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [], __COUNT: 0 })
    await new EntitySetResource(http, 'Employee', 'ABC').clean()
    expect(calls[0].params.$clean).toBe('true')
  })

  it('combine() passes the operator and other collection', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [], __COUNT: 0 })
    await new EntitySetResource(http, 'Employee', 'ABC').combine('AND', 'DEF')
    expect(calls[0].params.$logicOperator).toBe('AND')
    expect(calls[0].params.$otherCollection).toBe('DEF')
  })

  it('combineToEntitySet() returns a new resource for the created set', async () => {
    const { http, calls } = makeHttp({
      __ENTITIES: [],
      __COUNT: 0,
      __ENTITYSET: '/rest/Employee/$entityset/NEW',
    })
    const result = await new EntitySetResource(http, 'Employee', 'ABC').combineToEntitySet(
      'OR',
      'DEF',
      60
    )
    expect(result).toBeInstanceOf(EntitySetResource)
    expect(result.id).toBe('NEW')
    expect(calls[0].params.$method).toBe('entityset')
    expect(calls[0].params.$timeout).toBe('60')
  })

  it('combineToEntitySet() omits timeout when not provided', async () => {
    const { http, calls } = makeHttp({
      __ENTITIES: [],
      __COUNT: 0,
      __ENTITYSET: '/rest/Employee/$entityset/NEW',
    })
    await new EntitySetResource(http, 'Employee', 'ABC').combineToEntitySet('OR', 'DEF')
    expect(calls[0].params.$timeout).toBeUndefined()
  })

  it('intersects() returns the boolean result', async () => {
    const { http, calls } = makeHttp(true)
    const result = await new EntitySetResource(http, 'Employee', 'ABC').intersects('DEF')
    expect(result).toBe(true)
    expect(calls[0].params.$logicOperator).toBe('INTERSECT')
  })

  it('and/or/except delegate to combine', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [], __COUNT: 0 })
    const set = new EntitySetResource(http, 'Employee', 'ABC')
    await set.and('D')
    await set.or('D')
    await set.except('D')
    expect(calls.map((c) => c.params.$logicOperator)).toEqual(['AND', 'OR', 'EXCEPT'])
  })
})
