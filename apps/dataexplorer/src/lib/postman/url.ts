import type { PostmanQueryParam, PostmanUrl } from './types'

const BASE_URL_HOST = '{{baseUrl}}'

function splitPathAndQuery(pathWithQuery: string): { pathname: string; search: string } {
  let pathname = pathWithQuery || '/'
  let search = ''
  const q = pathname.indexOf('?')
  if (q >= 0) {
    search = pathname.slice(q + 1)
    pathname = pathname.slice(0, q)
  }
  if (!pathname.startsWith('/')) pathname = `/${pathname}`
  return { pathname, search }
}

function queryFromSearch(search: string): PostmanQueryParam[] {
  if (!search) return []
  const params = new URLSearchParams(search)
  const result: PostmanQueryParam[] = []
  for (const [key, value] of params.entries()) {
    result.push({ key, value })
  }
  return result
}

function pathSegments(pathname: string): string[] {
  return pathname
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
}

function appendQueryString(query: PostmanQueryParam[]): string {
  if (query.length === 0) return ''
  const search = new URLSearchParams()
  for (const param of query) {
    if (param.disabled || !param.key.trim()) continue
    search.append(param.key, param.value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/**
 * Build a Postman URL object.
 * When `useBaseUrlVar` is true, the host is `{{baseUrl}}` and path is relative
 * to that variable (Postman resolves `{{baseUrl}}/rest/...`).
 */
export function buildPostmanUrl(options: {
  /** Absolute origin (e.g. https://api.example.com) when not using the variable. */
  origin?: string
  /** Path including optional query, e.g. `/rest/Car?$top=1`. */
  pathWithQuery: string
  /** Extra query params (merged after any in pathWithQuery). */
  query?: PostmanQueryParam[]
  useBaseUrlVar?: boolean
}): PostmanUrl {
  const { pathname, search } = splitPathAndQuery(options.pathWithQuery)
  const query = [...queryFromSearch(search), ...(options.query ?? [])]
  const segments = pathSegments(pathname)
  const queryString = appendQueryString(query)

  if (options.useBaseUrlVar) {
    return {
      raw: `${BASE_URL_HOST}${pathname}${queryString}`,
      host: [BASE_URL_HOST],
      path: segments,
      ...(query.length > 0 ? { query } : {}),
    }
  }

  const origin = (options.origin ?? '').replace(/\/$/, '')
  let host = [origin]
  try {
    const parsed = new URL(origin)
    host = [parsed.host]
  } catch {
    // keep origin as host token
  }

  return {
    raw: `${origin}${pathname}${queryString}`,
    host,
    path: segments,
    ...(query.length > 0 ? { query } : {}),
  }
}

export function baseUrlVariableHost(): string {
  return BASE_URL_HOST
}
