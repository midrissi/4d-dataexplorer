import { describe, expect, it } from 'bun:test'
import { RESTClient } from './client'
import { type FetchFunction, HttpClient } from './core/http-client'
import { DataClassResource } from './resources/dataclass.resource'
import { AuthService } from './services/auth.service'
import { CatalogService } from './services/catalog.service'
import { InfoService } from './services/info.service'
import { SingletonResource, SingletonService } from './services/singleton.service'

type Call = { method: string; path: string; params: Record<string, string>; body: unknown }

function makeClient(response: unknown = {}, config: Record<string, unknown> = {}) {
  const calls: Call[] = []
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const rawBody = request.method === 'GET' ? '' : await request.text()
    calls.push({
      method: request.method,
      path: url.pathname.replace(/^\/rest/, ''),
      params: Object.fromEntries(url.searchParams.entries()),
      body: rawBody ? JSON.parse(rawBody) : undefined,
    })
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const client = new RESTClient({
    baseUrl: 'http://127.0.0.1:8044',
    fetch: fetchFn as unknown as FetchFunction,
    ...config,
  })
  return { client, calls }
}

describe('RESTClient', () => {
  it('exposes the base URL', () => {
    const { client } = makeClient()
    expect(client.baseUrl).toBe('http://127.0.0.1:8044')
  })

  it('dataclass() returns a DataClassResource', () => {
    const { client } = makeClient()
    expect(client.dataclass('Employee')).toBeInstanceOf(DataClassResource)
  })

  it('exposes catalog, auth, info and singletons services', () => {
    const { client } = makeClient()
    expect(client.catalog).toBeInstanceOf(CatalogService)
    expect(client.auth).toBeInstanceOf(AuthService)
    expect(client.info).toBeInstanceOf(InfoService)
    expect(client.singletons).toBeInstanceOf(SingletonService)
  })

  it('singleton() returns a SingletonResource', () => {
    const { client } = makeClient()
    expect(client.singleton('App')).toBeInstanceOf(SingletonResource)
  })

  it('applies basic auth when configured', async () => {
    const calls: { auth: string | null }[] = []
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      calls.push({ auth: request.headers.get('Authorization') })
      return new Response(JSON.stringify({ __ENTITIES: [], __COUNT: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const client = new RESTClient({
      baseUrl: 'http://127.0.0.1:8044',
      fetch: fetchFn as unknown as FetchFunction,
      auth: { username: 'admin', password: 'pw' },
    })
    await client.dataclass('Employee').fetch()
    expect(calls[0].auth).toBe(`Basic ${btoa('admin:pw')}`)
  })

  it('accepts an injected HttpClient', () => {
    const http = new HttpClient({ baseUrl: 'http://localhost:1234' })
    const client = new RESTClient({ baseUrl: 'ignored', httpClient: http })
    expect(client.getHttpClient()).toBe(http)
    expect(client.baseUrl).toBe('http://localhost:1234')
  })

  it('releaseEntitySet() releases via the entity set resource', async () => {
    const { client, calls } = makeClient({ ok: true })
    const res = await client.releaseEntitySet('Employee', 'ABC')
    expect(res.ok).toBe(true)
    expect(calls[0].path).toBe('/Employee/$entityset/ABC')
    expect(calls[0].params.$method).toBe('release')
  })

  it('login() authenticates and logout() clears it', async () => {
    const { client } = makeClient({ result: true })
    expect(await client.login('a', 'b')).toBe(true)
    expect(client.isAuthenticated).toBe(true)
    client.logout()
    expect(client.isAuthenticated).toBe(false)
  })

  it('getHttpClient() returns the underlying client', () => {
    const { client } = makeClient()
    expect(client.getHttpClient()).toBeInstanceOf(HttpClient)
  })
})
