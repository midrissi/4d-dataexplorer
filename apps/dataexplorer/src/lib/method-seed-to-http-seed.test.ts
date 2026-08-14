import { describe, expect, it } from 'bun:test'
import { createKeyValuePair } from '~/store/http-client-types'
import { methodSeedToHttpSeed } from './method-seed-to-http-seed'

describe('methodSeedToHttpSeed', () => {
  it('maps catalog POST with default $method and JSON body', () => {
    const seed = methodSeedToHttpSeed({
      scope: 'catalog',
      methodName: 'justATest',
      arguments: [{ id: '1', kind: 'string', value: 'hello' }],
    })

    expect(seed.method).toBe('POST')
    expect(seed.path).toBe('/rest/$catalog/justATest')
    expect(seed.params?.some((pair) => pair.key === '$method' && pair.value === 'entityset')).toBe(
      true
    )
    expect(seed.body?.mode).toBe('raw')
    expect(seed.body?.raw).toContain('"hello"')
  })

  it('maps GET with $params and respects disabled $method', () => {
    const seed = methodSeedToHttpSeed({
      scope: 'entity',
      methodName: 'fullName',
      dataClass: 'Person',
      key: 42,
      allowedOnHTTPGET: true,
      useGet: true,
      arguments: [{ id: '1', kind: 'boolean', value: true }],
      queryParams: [createKeyValuePair({ key: '$method', value: 'entityset', enabled: false })],
    })

    expect(seed.method).toBe('GET')
    expect(seed.path).toBe('/rest/Person(42)/fullName')
    expect(seed.params?.some((pair) => pair.key === '$method')).toBe(false)
    expect(seed.params?.find((pair) => pair.key === '$params')?.value).toBe('[true]')
    expect(seed.body?.mode).toBe('none')
  })
})
