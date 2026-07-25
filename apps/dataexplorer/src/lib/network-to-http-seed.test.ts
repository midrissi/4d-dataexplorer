import { beforeEach, describe, expect, it } from 'bun:test'
import type { NetworkDetails } from '~/store/console'
import { mapNetworkDetailsToSeed } from './network-to-http-seed'
import { setConnectionConfig } from './platform'

function details(partial: Partial<NetworkDetails>): NetworkDetails {
  return {
    method: 'GET',
    url: 'https://server.example/rest/Car?$top=1',
    requestHeaders: {},
    durationMs: 12,
    ...partial,
  }
}

describe('mapNetworkDetailsToSeed', () => {
  beforeEach(() => {
    setConnectionConfig({ baseUrl: 'https://server.example' })
  })

  it('copies method, path, params, and safe headers for the current server', () => {
    const seed = mapNetworkDetailsToSeed(
      details({
        method: 'POST',
        url: 'https://server.example/rest/Car?$top=5&filter=active',
        requestHeaders: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret',
          Cookie: 'session=abc',
          'X-Custom': '1',
        },
        requestBody: { name: 'Car' },
      })
    )

    expect(seed.method).toBe('POST')
    expect(seed.targetMode).toBe('current')
    expect(seed.path).toBe('/rest/Car')
    expect(seed.params?.map((p) => [p.key, p.value])).toEqual([
      ['$top', '5'],
      ['filter', 'active'],
    ])
    expect(seed.headers?.map((h) => h.key)).toEqual(['Content-Type', 'X-Custom'])
    expect(seed.body?.mode).toBe('raw')
    expect(seed.body?.rawLanguage).toBe('json')
    expect(seed.warnings?.some((w) => w.includes('Authorization'))).toBe(true)
    expect(seed.warnings?.some((w) => w.includes('Cookie'))).toBe(true)
  })

  it('marks custom origins and non-replayable bodies', () => {
    const custom = mapNetworkDetailsToSeed(
      details({
        url: 'https://api.other.test/v1/items',
        requestBody: '[multipart form data]',
      })
    )
    expect(custom.targetMode).toBe('custom')
    expect(custom.customOrigin).toBe('https://api.other.test')
    expect(custom.body?.mode).toBe('none')
    expect(custom.warnings?.some((w) => w.includes('Multipart'))).toBe(true)

    const binary = mapNetworkDetailsToSeed(
      details({
        requestBody: '[application/octet-stream body]',
      })
    )
    expect(binary.body?.mode).toBe('none')
    expect(binary.warnings?.some((w) => w.includes('Binary'))).toBe(true)

    const truncated = mapNetworkDetailsToSeed(
      details({
        requestHeaders: { 'content-type': 'text/plain' },
        requestBody: 'hello\n… [truncated]',
      })
    )
    expect(truncated.body?.mode).toBe('raw')
    expect(truncated.body?.raw).toBe('hello')
    expect(truncated.warnings?.some((w) => w.includes('truncated'))).toBe(true)
  })
})
