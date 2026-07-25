import { describe, expect, it } from 'bun:test'
import { makeHttp } from '../mock-http.test-helper'
import type { Entity } from '../types'
import { EntityResource } from './entity.resource'

type EmployeeEntity = Entity & {
  firstName?: string
}

describe('EntityResource', () => {
  it('get() fetches the entity', async () => {
    const { http, calls } = makeHttp({ __KEY: '3', __STAMP: 2 })
    const entity = await new EntityResource<EmployeeEntity>(http, 'Employee', 3).get()
    expect(entity).toEqual({ __KEY: '3', __STAMP: 2 })
    expect(calls[0].path).toBe('/Employee(3)')
  })

  it('select() requests specific attributes', async () => {
    const { http, calls } = makeHttp({ __KEY: '3', __STAMP: 2 })
    await new EntityResource<EmployeeEntity>(http, 'Employee', 3).select('firstName', 'lastName')
    expect(calls[0].params.$attributes).toBe('firstName,lastName')
  })

  it('getAttribute() fetches a single attribute', async () => {
    const { http, calls } = makeHttp('John')
    const value = await new EntityResource(http, 'Employee', 3).getAttribute('firstName')
    expect(value).toBe('John')
    expect(calls[0].path).toBe('/Employee(3)/firstName')
  })

  it('update() merges the key into the body', async () => {
    const { http, calls } = makeHttp({ __KEY: '3', __STAMP: 2 })
    await new EntityResource<EmployeeEntity>(http, 'Employee', 3).update({
      firstName: 'Jo',
      __STAMP: 1,
    })
    expect(calls[0].body).toEqual({ __KEY: '3', firstName: 'Jo', __STAMP: 1 })
    expect(calls[0].params.$method).toBe('update')
  })

  it('delete() posts with the delete method', async () => {
    const { http, calls } = makeHttp({ ok: true })
    await new EntityResource(http, 'Employee', 3).delete()
    expect(calls[0].path).toBe('/Employee(3)')
    expect(calls[0].params.$method).toBe('delete')
  })

  it('call() posts params and unwraps the result', async () => {
    const { http, calls } = makeHttp({ result: 99 })
    const result = await new EntityResource(http, 'Employee', 3).call('raise', 10)
    expect(result).toBe(99)
    expect(calls[0].path).toBe('/Employee(3)/raise')
    expect(calls[0].body).toEqual([10])
  })

  it('lock() and unlock() toggle the $lock flag', async () => {
    const { http, calls } = makeHttp({ success: true })
    const entity = new EntityResource(http, 'Employee', 3)
    await entity.lock()
    await entity.unlock()
    expect(calls[0].params.$lock).toBe('true')
    expect(calls[1].params.$lock).toBe('false')
  })

  it('getRelated() expands the relation', async () => {
    const { http, calls } = makeHttp({ __KEY: '1', __STAMP: 1 })
    await new EntityResource(http, 'Employee', 3).getRelated('employer')
    expect(calls[0].path).toBe('/Employee(3)/employer')
    expect(calls[0].params.$expand).toBe('employer')
  })

  it('getRelatedMany() returns the __ENTITIES array', async () => {
    const { http } = makeHttp({
      __ENTITIES: [
        { __KEY: '1', __STAMP: 1 },
        { __KEY: '2', __STAMP: 2 },
      ],
    })
    const related = await new EntityResource(http, 'Company', 3).getRelatedMany('employees')
    expect(related).toHaveLength(2)
  })
})
