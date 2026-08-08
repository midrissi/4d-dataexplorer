import { describe, expect, mock, test } from 'bun:test'
import { type FetchFunction, HttpClient } from '../core/http-client'
import { callEntitySelectionFunction } from './functions'

describe('callEntitySelectionFunction', () => {
  test('posts to entity set path with empty body when method has no args', async () => {
    const requests: Array<{ path: string; body: unknown; params?: Record<string, unknown> }> = []
    const mockFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url)
      requests.push({
        path: url.pathname.replace(/^\/rest/, ''),
        body: request.method === 'POST' ? JSON.parse(await request.text()) : undefined,
        params: Object.fromEntries(url.searchParams.entries()),
      })
      return new Response(JSON.stringify({ result: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const http = new HttpClient({
      baseUrl: 'http://127.0.0.1:8044',
      fetch: mockFetch as unknown as FetchFunction,
    })

    const result = await callEntitySelectionFunction(http, 'User', 'getCount', [], {
      entitySetId: 'BF9F511FA7C94980A0468FF52CDCD68B',
    })

    expect(result.unwrap()).toBe(42)
    expect(result.status()).toBe(200)
    expect(result.time()).toBeGreaterThanOrEqual(0)
    expect(requests).toEqual([
      {
        path: '/User/getCount/$entityset/BF9F511FA7C94980A0468FF52CDCD68B',
        body: [],
        params: { $method: 'entityset' },
      },
    ])
  })

  test('ignores filter and orderby when entitySetId is provided', async () => {
    const requests: Array<{ path: string; params?: Record<string, unknown> }> = []
    const mockFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url)
      requests.push({
        path: url.pathname.replace(/^\/rest/, ''),
        params: Object.fromEntries(url.searchParams.entries()),
      })
      return new Response(JSON.stringify({ result: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const http = new HttpClient({
      baseUrl: 'http://127.0.0.1:8044',
      fetch: mockFetch as unknown as FetchFunction,
    })

    await callEntitySelectionFunction(http, 'User', 'getCount', [], {
      entitySetId: 'ABC',
      filter: 'name = :1',
      orderby: 'name asc',
    })

    expect(requests).toEqual([
      {
        path: '/User/getCount/$entityset/ABC',
        params: { $method: 'entityset' },
      },
    ])
  })
})

import { makeHttp } from '../mock-http.test-helper'
import {
  callDataClassFunction,
  callDataStoreFunction,
  callEntityFunction,
  callSingletonFunction,
} from './functions'

describe('callDataStoreFunction', () => {
  test('POSTs to the catalog function by default with $method=entityset', async () => {
    const { http, calls } = makeHttp({ result: 'ok' })
    const result = await callDataStoreFunction(http, 'doThing', [1, 2])
    expect(result.unwrap()).toBe('ok')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].path).toBe('/$catalog/doThing')
    expect(calls[0].body).toEqual([1, 2])
    expect(calls[0].params.$method).toBe('entityset')
  })

  test('POSTs { params, ...wrapper } when a wrapper is provided', async () => {
    const { http, calls } = makeHttp({ result: 'ok' })
    await callDataStoreFunction(http, 'myMethod', [], {
      wrapper: { foo: 'test' },
    })
    expect(calls[0].body).toEqual({ params: [], foo: 'test' })
  })

  test('GET serializes params and applies filter/orderby', async () => {
    const { http, calls } = makeHttp({ result: 'ok' })
    await callDataStoreFunction(http, 'doThing', [1], {
      method: 'GET',
      filter: 'a = :1',
      orderby: 'name desc',
    })
    expect(calls[0].method).toBe('GET')
    expect(calls[0].params.$method).toBe('entityset')
    expect(calls[0].params.$params).toBe(JSON.stringify([1]))
    expect(calls[0].params.$filter).toBe('a = :1')
    expect(calls[0].params.$orderby).toBe('"name desc"')
  })

  test('omits $method=entityset when createEntitySet is false', async () => {
    const { http, calls } = makeHttp({ result: 'ok' })
    await callDataStoreFunction(http, 'doThing', [], { createEntitySet: false })
    expect(calls[0].params.$method).toBeUndefined()
  })

  test('returns a direct entity-set payload when 4D omits the result wrapper', async () => {
    const entitySet = {
      __ENTITYSET: '/rest/Agency/$entityset/ABC',
      __DATACLASS: 'Agency',
      __COUNT: 2,
      __ENTITIES: [{ __KEY: '1' }],
      __entityModel: 'Agency',
    }
    const { http } = makeHttp(entitySet)
    const result = await callDataStoreFunction(http, 'testFn', [])
    expect(result.unwrap()).toEqual(entitySet)
    expect(result.body).toEqual(entitySet)
  })
})

describe('callDataClassFunction', () => {
  test('POSTs to the dataclass function path', async () => {
    const { http, calls } = makeHttp({ result: 5 })
    const result = await callDataClassFunction(http, 'Employee', 'raise', [10])
    expect(result.unwrap()).toBe(5)
    expect(calls[0].path).toBe('/Employee/raise')
    expect(calls[0].body).toEqual([10])
    expect(calls[0].params.$method).toBe('entityset')
  })

  test('GET hits the dataclass function path', async () => {
    const { http, calls } = makeHttp({ result: 5 })
    await callDataClassFunction(http, 'Employee', 'raise', [10], { method: 'GET' })
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/Employee/raise')
    expect(calls[0].params.$method).toBe('entityset')
    expect(calls[0].params.$params).toBe(JSON.stringify([10]))
  })
})

describe('callEntityFunction', () => {
  test('POSTs to the entity function path', async () => {
    const { http, calls } = makeHttp({ result: true })
    const result = await callEntityFunction(http, 'Employee', 3, 'archive', ['x'])
    expect(result.unwrap()).toBe(true)
    expect(calls[0].path).toBe('/Employee(3)/archive')
    expect(calls[0].body).toEqual(['x'])
    expect(calls[0].params.$method).toBe('entityset')
  })

  test('GET hits the entity function path', async () => {
    const { http, calls } = makeHttp({ result: true })
    await callEntityFunction(http, 'Employee', 3, 'archive', [], { method: 'GET' })
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/Employee(3)/archive')
    expect(calls[0].params.$method).toBe('entityset')
  })
})

describe('callEntitySelectionFunction (POST without entity set)', () => {
  test('POSTs to the plain selection path', async () => {
    const { http, calls } = makeHttp({ result: 1 })
    await callEntitySelectionFunction(http, 'User', 'count', [])
    expect(calls[0].path).toBe('/User/count')
    expect(calls[0].params.$method).toBe('entityset')
  })

  test('GET hits the selection path', async () => {
    const { http, calls } = makeHttp({ result: 1 })
    await callEntitySelectionFunction(http, 'User', 'count', [], { method: 'GET' })
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/User/count')
    expect(calls[0].params.$method).toBe('entityset')
  })
})

describe('callSingletonFunction', () => {
  test('POSTs to the singleton function path', async () => {
    const { http, calls } = makeHttp({ result: 'pong' })
    const result = await callSingletonFunction(http, 'App', 'ping', [1])
    expect(result.unwrap()).toBe('pong')
    expect(calls[0].path).toBe('/$singleton/App/ping')
    expect(calls[0].body).toEqual([1])
    expect(calls[0].params.$method).toBe('entityset')
  })

  test('GET hits the singleton function path', async () => {
    const { http, calls } = makeHttp({ result: 'pong' })
    await callSingletonFunction(http, 'App', 'ping', [], { method: 'GET' })
    expect(calls[0].method).toBe('GET')
    expect(calls[0].path).toBe('/$singleton/App/ping')
    expect(calls[0].params.$method).toBe('entityset')
  })

  test('exposes __WEBFORM via notifications() while unwrap() returns result', async () => {
    const envelope = {
      result: null,
      __WEBFORM: {
        __PRIVILEGES: { stamp: 2 },
        __NOTIFICATION: {
          message: 'Cannot generate data, data process already running',
          type: 'warning',
        },
      },
    }
    const { http } = makeHttp(envelope)
    const result = await callSingletonFunction(http, 'dataInitSingleton', 'generate', ['test'])
    expect(result.unwrap()).toBe(null)
    expect(result.body).toEqual(envelope)
    expect(result.notifications()).toEqual({
      message: 'Cannot generate data, data process already running',
      type: 'warning',
    })
    expect(result.webform()?.__PRIVILEGES).toEqual({ stamp: 2 })
  })
})
