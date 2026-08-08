import { describe, expect, it, mock } from 'bun:test'
import {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  RESTAPIError,
  SessionLimitError,
} from './errors'
import { type FetchFunction, HttpClient } from './http-client'

describe('HttpClient', () => {
  describe('constructor', () => {
    it('should initialize with baseUrl', () => {
      const client = new HttpClient({ baseUrl: 'http://localhost:8080' })
      expect(client.getBaseUrl()).toBe('http://localhost:8080')
    })

    it('should remove trailing slash from baseUrl', () => {
      const client = new HttpClient({ baseUrl: 'http://localhost:8080/' })
      expect(client.getBaseUrl()).toBe('http://localhost:8080')
    })

    it('should use custom fetch function', () => {
      const customFetch = mock(() => Promise.resolve(new Response())) as unknown as FetchFunction
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: customFetch,
      })
      expect(client).toBeDefined()
    })
  })

  describe('buildUrl', () => {
    it('should build URL with query parameters', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await client.get('/test', { param1: 'value1', param2: 123 })

      expect(mockFetch).toHaveBeenCalled()
      const calls = mockFetch.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const call = calls[0] as unknown as [Request, RequestInit?]
      expect(call).toBeDefined()
      const request = call[0]
      expect(request).toBeDefined()
      expect(request.url).toContain('/rest/test')
      expect(request.url).toContain('param1=value1')
      expect(request.url).toContain('param2=123')
    })
  })

  describe('get', () => {
    it('should make GET request', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      const result = await client.get('/test')

      expect(mockFetch).toHaveBeenCalled()
      expect(result).toEqual({ data: 'test' })
    })
  })

  describe('getWithMeta', () => {
    it('returns body, status, headers, and duration', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json', 'X-Trace': '1' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      const result = await client.getWithMeta('/test')

      expect(result.data).toEqual({ data: 'test' })
      expect(result.status).toBe(200)
      expect(result.statusText).toBe('OK')
      expect(result.headers.get('X-Trace')).toBe('1')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('post', () => {
    it('should make POST request with body', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      const result = await client.post('/test', { name: 'test' })

      expect(mockFetch).toHaveBeenCalled()
      const calls = mockFetch.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const call = calls[0] as unknown as [Request, RequestInit?]
      expect(call).toBeDefined()
      const request = call[0]
      expect(request).toBeDefined()
      expect(request.method).toBe('POST')
      expect(await request.text()).toBe('{"name":"test"}')
      expect(result).toEqual({ success: true })
    })

    it('should send an empty body for POST without payload', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await client.post('/Employee(1)', undefined, { $method: 'delete' })

      const call = mockFetch.mock.calls[0] as unknown as [Request, RequestInit?]
      const request = call[0]
      expect(request.method).toBe('POST')
      expect(await request.text()).toBe('{}')
      expect(request.headers.get('Content-Type')).toBe('application/json')
    })
  })

  describe('put', () => {
    it('should make PUT request with body', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ updated: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      const result = await client.put('/test/1', { name: 'updated' })

      expect(mockFetch).toHaveBeenCalled()
      const calls = mockFetch.mock.calls
      const request = (calls[0] as unknown as [Request, RequestInit?])[0]
      expect(request.method).toBe('PUT')
      expect(await request.text()).toBe('{"name":"updated"}')
      expect(result).toEqual({ updated: true })
    })
  })

  describe('delete', () => {
    it('should make DELETE request', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ deleted: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      const result = await client.delete('/test/1')

      expect(mockFetch).toHaveBeenCalled()
      const calls = mockFetch.mock.calls
      const request = (calls[0] as unknown as [Request, RequestInit?])[0]
      expect(request.method).toBe('DELETE')
      expect(result).toEqual({ deleted: true })
    })
  })

  describe('error handling', () => {
    it('should throw AuthenticationError for 401', async () => {
      const mockFetch = mock(() => {
        return Promise.resolve(
          new Response('Unauthorized', {
            status: 401,
            statusText: 'Unauthorized',
          })
        )
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await expect(client.get('/test')).rejects.toThrow(AuthenticationError)
    })

    it('should throw SessionLimitError for 402', async () => {
      const mockFetch = mock(() => {
        return Promise.resolve(
          new Response('Session limit', {
            status: 402,
            statusText: 'Payment Required',
          })
        )
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await expect(client.get('/test')).rejects.toThrow(SessionLimitError)
    })

    it('should throw NotFoundError for 404', async () => {
      const mockFetch = mock(() => {
        return Promise.resolve(
          new Response('Not Found', {
            status: 404,
            statusText: 'Not Found',
          })
        )
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await expect(client.get('/test')).rejects.toThrow(NotFoundError)
    })

    it('should throw NetworkError on network failure', async () => {
      const mockFetch = mock(() => Promise.reject(new Error('Network error')))
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await expect(client.get('/test')).rejects.toThrow(NetworkError)
    })

    it('should throw RESTAPIError for error response', async () => {
      const mockFetch = mock(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              __ERROR: [
                {
                  message: 'Test error',
                  errCode: 500,
                  componentSignature: 'TEST',
                },
              ],
            }),
            {
              status: 500,
              statusText: 'Internal Server Error',
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await expect(client.get('/test')).rejects.toThrow(RESTAPIError)
    })
  })

  describe('buildUrl with $filter', () => {
    it('minimal-encodes raw $filter query values', async () => {
      const mockFetch = mock((_request: Request) =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await client.get('/Employee', { $filter: 'name eq "a&b=c"' })

      const request = (mockFetch.mock.calls[0] as unknown as [Request])[0]
      expect(request.url).toContain('$filter=')
      expect(request.url).toContain('a%26b%3Dc')
    })

    it('keeps spaces in raw $orderby values instead of encoding as plus', async () => {
      const mockFetch = mock((_request: Request) =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      await client.get('/Reservation', { $orderby: '"departureDate desc"' })

      const request = (mockFetch.mock.calls[0] as unknown as [Request])[0]
      expect(request.url).not.toContain('departureDate+desc')
      expect(decodeURIComponent(request.url)).toContain('$orderby="departureDate desc"')
    })
  })

  describe('response handling', () => {
    it('returns non-JSON text responses as strings', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response('plain-text', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })
      const result = await client.get<string>('/text')
      expect(result).toBe('plain-text')
    })

    it('post accepts query params', async () => {
      const mockFetch = mock((request: Request) => {
        expect(request.url).toContain('q=1')
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })
      await client.post('/items', { name: 'x' }, { q: 1 })
    })

    it('put and delete accept query params with object values', async () => {
      const mockFetch = mock((request: Request) => {
        expect(request.url).toContain('meta=%7B%22x%22%3A1%7D')
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })
      await client.put('/items/1', { name: 'x' }, { meta: { x: 1 } })
      await client.delete('/items/1', { meta: { x: 1 } })
      expect(mockFetch.mock.calls.length).toBe(2)
    })

    it('throws NetworkError for non-Error fetch failures', async () => {
      const mockFetch = mock(() => {
        throw 'network down'
      })
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })
      await expect(client.get('/fail')).rejects.toThrow('Unknown network error')
    })
  })

  describe('authorization', () => {
    it('should set Bearer auth', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })
      client.setAuthorization('Bearer', 'token-abc')
      await client.get('/test')
      const request = (mockFetch.mock.calls[0] as unknown as [Request])[0]
      expect(request.headers.get('Authorization')).toBe('Bearer token-abc')
    })

    it('should return undefined for empty JSON response body', async () => {
      const mockFetch = mock(() => Promise.resolve(new Response('', { status: 200 })))
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })
      const result = await client.get('/empty')
      expect(result).toBeUndefined()
    })

    it('should apply request and response middleware', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
        requestMiddleware: [
          (req) =>
            new Request(req, { headers: { ...Object.fromEntries(req.headers), 'X-Test': '1' } }),
          (req) =>
            new Request(req, { headers: { ...Object.fromEntries(req.headers), 'X-Test-2': '2' } }),
        ],
        responseMiddleware: [
          (res) => res,
          (res) => new Response(res.body, { status: res.status, headers: res.headers }),
        ],
      })
      await client.get('/mw')
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should set Basic auth', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      client.setBasicAuth('user', 'pass')
      await client.get('/test')

      const request = (mockFetch.mock.calls[0] as unknown as [Request])[0]
      expect(request.headers.get('Authorization')).toBe('Basic dXNlcjpwYXNz')
    })

    it('should expose base URL', () => {
      const client = new HttpClient({ baseUrl: 'http://localhost:8080' })
      expect(client.getBaseUrl()).toBe('http://localhost:8080')
    })

    it('should clear authorization', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
      const client = new HttpClient({
        baseUrl: 'http://localhost:8080',
        fetch: mockFetch as unknown as FetchFunction,
      })

      client.setBasicAuth('user', 'pass')
      client.clearAuthorization()
      await client.get('/test')

      const request = (mockFetch.mock.calls[0] as unknown as [Request])[0]
      expect(request.headers.get('Authorization')).toBeNull()
    })
  })
})
