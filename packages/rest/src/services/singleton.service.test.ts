import { describe, expect, it } from 'bun:test'
import { makeHttp } from '../mock-http.test-helper'
import { SingletonResource, SingletonService } from './singleton.service'

describe('SingletonService', () => {
  it('call() posts to the singleton function and unwraps the result', async () => {
    const { http, calls } = makeHttp({ result: 'pong' })
    const result = await new SingletonService(http).call('App', 'ping', 1, 2)
    expect(result).toBe('pong')
    expect(calls[0].path).toBe('/$singleton/App/ping')
    expect(calls[0].body).toEqual([1, 2])
  })

  it('singleton() returns a SingletonResource', () => {
    const { http } = makeHttp()
    expect(new SingletonService(http).singleton('App')).toBeInstanceOf(SingletonResource)
  })
})

describe('SingletonResource', () => {
  it('call() posts to the singleton function path', async () => {
    const { http, calls } = makeHttp({ result: 42 })
    const result = await new SingletonResource(http, 'App').call('answer')
    expect(result).toBe(42)
    expect(calls[0].path).toBe('/$singleton/App/answer')
    expect(calls[0].body).toEqual([])
  })
})
