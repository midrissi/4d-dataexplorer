import { describe, expect, it } from 'bun:test'
import { makeHttp } from '../mock-http.test-helper'
import type { Entity } from '../types'
import { DataClassResource } from './dataclass.resource'
import { EntityResource } from './entity.resource'
import { EntitySetResource } from './entityset.resource'

type EmployeeEntity = Entity & {
  firstName?: string
  email?: string
}

describe('DataClassResource', () => {
  it('exposes the dataclass name', () => {
    const { http } = makeHttp()
    expect(new DataClassResource(http, 'Employee').dataClassName).toBe('Employee')
  })

  it('all() returns a query builder targeting the dataclass', () => {
    const { http } = makeHttp()
    expect(new DataClassResource(http, 'Employee').all().buildPath()).toBe('/Employee')
  })

  it('filter() pre-applies a filter expression', () => {
    const { http } = makeHttp()
    const qb = new DataClassResource(http, 'Employee').filter('age > :1')
    expect(qb.buildOptions().$filter).toBe('"age > :1"')
  })

  it('orderBy() pre-applies an order expression', () => {
    const { http } = makeHttp()
    const qb = new DataClassResource(http, 'Employee').orderBy('lastName', 'desc')
    expect(qb.buildOptions().$orderby).toBe('"lastName desc"')
  })

  it('select() pre-applies attribute selection', () => {
    const { http } = makeHttp()
    const qb = new DataClassResource(http, 'Employee').select('a', 'b')
    expect(qb.buildOptions().$attributes).toBe('a,b')
  })

  it('get() fetches an entity by key', async () => {
    const { http, calls } = makeHttp({ __KEY: '7', __STAMP: 1 })
    const entity = await new DataClassResource<EmployeeEntity>(http, 'Employee').get(7)
    expect(entity).toEqual({ __KEY: '7', __STAMP: 1 })
    expect(calls[0].path).toBe('/Employee(7)')
  })

  it('entity() returns an EntityResource', () => {
    const { http } = makeHttp()
    expect(new DataClassResource(http, 'Employee').entity(1)).toBeInstanceOf(EntityResource)
  })

  it('getBy() fetches by attribute value', async () => {
    const { http, calls } = makeHttp({ __KEY: '1', __STAMP: 1 })
    await new DataClassResource<EmployeeEntity>(http, 'Employee').getBy('email', 'a@b.com')
    expect(calls[0].path).toBe('/Employee:email(a@b.com)')
  })

  it('create() posts data with the update method', async () => {
    const { http, calls } = makeHttp({ __KEY: '1', __STAMP: 1 })
    await new DataClassResource<EmployeeEntity>(http, 'Employee').create({ firstName: 'Jo' })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].path).toBe('/Employee')
    expect(calls[0].params.$method).toBe('update')
    expect(calls[0].body).toEqual({ firstName: 'Jo' })
  })

  it('update() posts the key with the payload', async () => {
    const { http, calls } = makeHttp({ __KEY: '5', __STAMP: 2 })
    await new DataClassResource<EmployeeEntity>(http, 'Employee').update(5, {
      firstName: 'Jo',
      __STAMP: 1,
    })
    expect(calls[0].body).toEqual({ __KEY: '5', firstName: 'Jo', __STAMP: 1 })
  })

  it('updateMany() sends asArray for multiple entities and normalizes the result', async () => {
    const { http, calls } = makeHttp([
      { __KEY: '1', __STAMP: 1 },
      { __KEY: '2', __STAMP: 2 },
    ])
    const result = await new DataClassResource<EmployeeEntity>(http, 'Employee').updateMany([
      { firstName: 'A' },
      { firstName: 'B' },
    ])
    expect(result).toHaveLength(2)
    expect(calls[0].params.$asArray).toBe('true')
  })

  it('updateMany() does not set asArray for a single entity', async () => {
    const { http, calls } = makeHttp({ __KEY: '1', __STAMP: 1 })
    const result = await new DataClassResource<EmployeeEntity>(http, 'Employee').updateMany([
      { firstName: 'A' },
    ])
    expect(result).toHaveLength(1)
    expect(calls[0].params.$asArray).toBe('false')
  })

  it('delete() posts with the delete method', async () => {
    const { http, calls } = makeHttp({ ok: true })
    const res = await new DataClassResource(http, 'Employee').delete(9)
    expect(res.ok).toBe(true)
    expect(calls[0].path).toBe('/Employee(9)')
    expect(calls[0].params.$method).toBe('delete')
  })

  it('entitySet() returns an EntitySetResource', () => {
    const { http } = makeHttp()
    expect(new DataClassResource(http, 'Employee').entitySet('X')).toBeInstanceOf(EntitySetResource)
  })

  it('call() posts params and unwraps the result', async () => {
    const { http, calls } = makeHttp({ result: 'done' })
    const result = await new DataClassResource(http, 'Employee').call('doThing', 1, 2)
    expect(result.unwrap()).toBe('done')
    expect(calls[0].path).toBe('/Employee/doThing')
    expect(calls[0].body).toEqual([1, 2])
    expect(calls[0].params.$method).toBeUndefined()
  })

  it('compute() defaults to $all', async () => {
    const { http, calls } = makeHttp({ count: 1 })
    await new DataClassResource(http, 'Employee').compute('salary')
    expect(calls[0].params.$compute).toBe('$all')
  })

  it('sum/average/min/max issue compute requests', async () => {
    const { http, calls } = makeHttp(10)
    const dc = new DataClassResource(http, 'Employee')
    await dc.sum('salary')
    await dc.average('salary')
    await dc.min('salary')
    await dc.max('salary')
    expect(calls.map((c) => c.params.$compute)).toEqual(['sum', 'average', 'min', 'max'])
  })

  it('count() reads __COUNT', async () => {
    const { http } = makeHttp({ __ENTITIES: [], __COUNT: 3 })
    expect(await new DataClassResource(http, 'Employee').count()).toBe(3)
  })

  it('fetch() returns the collection', async () => {
    const { http } = makeHttp({ __ENTITIES: [{ __KEY: '1', __STAMP: 1 }], __COUNT: 1 })
    const res = await new DataClassResource<EmployeeEntity>(http, 'Employee').fetch()
    expect(res.__ENTITIES).toHaveLength(1)
  })

  it('fetchFirst() returns the first n entities', async () => {
    const { http, calls } = makeHttp({ __ENTITIES: [{ __KEY: '1', __STAMP: 1 }], __COUNT: 1 })
    const res = await new DataClassResource<EmployeeEntity>(http, 'Employee').fetchFirst(3)
    expect(res).toHaveLength(1)
    expect(calls[0].params.$top).toBe('3')
  })

  it('findOne() filters and returns one entity', async () => {
    const { http } = makeHttp({ __ENTITIES: [{ __KEY: '1', __STAMP: 1 }], __COUNT: 1 })
    expect(await new DataClassResource<EmployeeEntity>(http, 'Employee').findOne('x = :1')).toEqual(
      { __KEY: '1', __STAMP: 1 }
    )
  })

  it('findAll() filters and returns all entities', async () => {
    const { http } = makeHttp({
      __ENTITIES: [
        { __KEY: '1', __STAMP: 1 },
        { __KEY: '2', __STAMP: 2 },
      ],
      __COUNT: 2,
    })
    expect(
      await new DataClassResource<EmployeeEntity>(http, 'Employee').findAll('x = :1')
    ).toHaveLength(2)
  })
})
