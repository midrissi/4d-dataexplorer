import { describe, expect, test } from 'bun:test'
import { FunctionCallResult, unwrapFunctionBody } from './function-call-result'

describe('unwrapFunctionBody', () => {
  test('returns result when present', () => {
    expect(unwrapFunctionBody<number>({ result: 42 })).toBe(42)
  })

  test('returns entity-set payloads without a result wrapper', () => {
    const entitySet = { __ENTITYSET: '/rest/City/$entityset/ABC', __ENTITIES: [] }
    expect(unwrapFunctionBody<typeof entitySet>(entitySet)).toEqual(entitySet)
  })

  test('does not keep the __WEBFORM envelope as the value', () => {
    expect(
      unwrapFunctionBody<null>({ result: null, __WEBFORM: { __PRIVILEGES: { stamp: 1 } } })
    ).toBe(null)
  })
})

describe('FunctionCallResult', () => {
  test('exposes unwrap, time, status, headers, and notifications', () => {
    const res = new FunctionCallResult<number>({
      body: {
        result: 7,
        __WEBFORM: {
          __PRIVILEGES: { stamp: 2 },
          __NOTIFICATION: { message: 'Saved', type: 'success' },
        },
      },
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc' },
      durationMs: 12.4,
    })

    expect(res.unwrap()).toBe(7)
    expect(res.result()).toBe(7)
    expect(res.time()).toBe(12.4)
    expect(res.status()).toBe(200)
    expect(res.statusText()).toBe('OK')
    expect(res.header('X-Request-Id')).toBe('abc')
    expect(res.headers().get('Content-Type')).toBe('application/json')
    expect(res.notifications()).toEqual({ message: 'Saved', type: 'success' })
    expect(res.webform()).toEqual({
      __PRIVILEGES: { stamp: 2 },
      __NOTIFICATION: { message: 'Saved', type: 'success' },
    })
    expect(res.body).toMatchObject({ result: 7 })
  })

  test('passes through entity-set bodies', () => {
    const entitySet = {
      __ENTITYSET: '/rest/Agency/$entityset/ABC',
      __DATACLASS: 'Agency',
      __COUNT: 2,
      __ENTITIES: [{ __KEY: '1' }],
    }
    const res = new FunctionCallResult({ body: entitySet })
    expect(res.unwrap()).toEqual(entitySet)
    expect(res.notifications()).toBeUndefined()
  })
})
