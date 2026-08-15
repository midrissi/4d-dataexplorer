/** Browser stand-in for Node `url.parse` / `url.format` (used by the snippet generator). */

export type ParsedUrlQuery = Record<string, string | string[]>

export type UrlObject = {
  protocol?: string | null
  slashes?: boolean | null
  auth?: string | null
  host?: string | null
  port?: string | null
  hostname?: string | null
  hash?: string | null
  search?: string | null
  query?: string | ParsedUrlQuery | null
  pathname?: string | null
  path?: string | null
  href?: string | null
}

function queryFromSearchParams(params: URLSearchParams): ParsedUrlQuery {
  const query: ParsedUrlQuery = {}
  params.forEach((value, key) => {
    const existing = query[key]
    if (existing === undefined) {
      query[key] = value
      return
    }
    if (Array.isArray(existing)) {
      existing.push(value)
      return
    }
    query[key] = [existing, value]
  })
  return query
}

export function parse(
  urlStr: string,
  parseQueryString?: boolean,
  _slashesDenoteHost?: boolean
): UrlObject {
  const parsed = new URL(urlStr)
  const search = parsed.search || null
  return {
    protocol: parsed.protocol,
    slashes: true,
    auth: parsed.username
      ? parsed.password
        ? `${parsed.username}:${parsed.password}`
        : parsed.username
      : null,
    host: parsed.host,
    port: parsed.port,
    hostname: parsed.hostname,
    hash: parsed.hash || null,
    search,
    query: parseQueryString
      ? queryFromSearchParams(parsed.searchParams)
      : parsed.search.slice(1) || null,
    pathname: parsed.pathname,
    path: `${parsed.pathname}${parsed.search}`,
    href: parsed.href,
  }
}

function stringifyQuery(query: ParsedUrlQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else {
      params.append(key, value)
    }
  }
  return params.toString()
}

export function format(urlObject: UrlObject | string): string {
  if (typeof urlObject === 'string') return urlObject

  const protocol = (urlObject.protocol || 'http:').replace(/:?$/, ':')
  const auth = urlObject.auth ? `${urlObject.auth}@` : ''
  const host =
    urlObject.host ||
    [urlObject.hostname, urlObject.port].filter((part) => part != null && part !== '').join(':')
  let pathname = urlObject.pathname || ''
  if (pathname && !pathname.startsWith('/')) pathname = `/${pathname}`

  let search = urlObject.search ?? ''
  if (!search && urlObject.query && typeof urlObject.query === 'object') {
    const encoded = stringifyQuery(urlObject.query)
    search = encoded ? `?${encoded}` : ''
  } else if (!search && typeof urlObject.query === 'string' && urlObject.query) {
    search = urlObject.query.startsWith('?') ? urlObject.query : `?${urlObject.query}`
  }
  if (search && !search.startsWith('?')) search = `?${search}`

  const hash = urlObject.hash || ''
  return `${protocol}//${auth}${host}${pathname}${search}${hash}`
}
