import { type FetchFunction, HttpClient } from './core/http-client'

export type RecordedCall = {
  method: string
  path: string
  search: string
  params: Record<string, string>
  body: unknown
}

export type ResponseFactory = (call: RecordedCall) => unknown

/**
 * Build an {@link HttpClient} backed by a recording mock fetch.
 * Pass a static response object or a factory that receives the recorded call.
 */
export function makeHttp(response: unknown = {}) {
  const calls: RecordedCall[] = []
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const rawBody = request.method === 'GET' ? '' : await request.text()
    const call: RecordedCall = {
      method: request.method,
      path: url.pathname.replace(/^\/rest/, ''),
      search: url.search,
      params: Object.fromEntries(url.searchParams.entries()),
      body: rawBody ? JSON.parse(rawBody) : undefined,
    }
    calls.push(call)
    const payload = typeof response === 'function' ? (response as ResponseFactory)(call) : response
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const http = new HttpClient({
    baseUrl: 'http://127.0.0.1:8044',
    fetch: fetchFn as unknown as FetchFunction,
  })
  return { http, calls }
}
