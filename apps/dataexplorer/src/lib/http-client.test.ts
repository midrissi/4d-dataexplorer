import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { createKeyValuePair, normalizeHttpBody } from '~/store/http-client-types'
import {
  analyzeHttpClientNetworkError,
  applyParamsToPath,
  buildHttpRequest,
  buildRestPathSuggestions,
  createEmptyHttpDraft,
  DESKTOP_HTTP_ACCEPT,
  executeHttpRequest,
  formatByteSize,
  formatHttpClientNetworkError,
  formatResponseBody,
  getDesktopHttpUserAgent,
  inferRawContentType,
  listHttpBuiltInHeaders,
  mergeRestPathSuggestions,
  paramsFromSearch,
  REST_QUERY_PARAMS,
  recentPathsFromHttpHistory,
  restParamValueSuggestions,
  setBuiltInHeaderEnabled,
  syncParamsFromPath,
  upsertBuiltInHeaderOverride,
} from './http-client'
import { getCookies, registerPlatformFetch, setConnectionConfig, setCookies } from './platform'

function withDesktop(run: () => void): void {
  const previous = (globalThis as { window?: Window & typeof globalThis }).window
  const fakeWindow = {
    ...(previous ?? (globalThis as object)),
    __TAURI_INTERNALS__: {},
  } as unknown as Window & typeof globalThis
  Object.defineProperty(globalThis, 'window', {
    value: fakeWindow,
    configurable: true,
    writable: true,
  })
  try {
    run()
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
    } else {
      Object.defineProperty(globalThis, 'window', {
        value: previous,
        configurable: true,
        writable: true,
      })
    }
  }
}

describe('http-client helpers', () => {
  beforeEach(() => {
    setConnectionConfig({
      baseUrl: 'https://server.example',
      headers: { 'X-App': 'dataexplorer' },
      cookies: { session: 'abc' },
      timeout: 15_000,
    })
    registerPlatformFetch(undefined as never)
  })

  afterEach(() => {
    registerPlatformFetch(undefined as never)
  })

  it('composes params into the path and syncs them back', () => {
    const params = [
      createKeyValuePair({ key: '$top', value: '10', enabled: true }),
      createKeyValuePair({ key: 'filter', value: 'active', enabled: false }),
      createKeyValuePair({ key: 'q', value: 'a b', enabled: true }),
    ]
    const path = applyParamsToPath('/rest/Car?old=1', params)
    expect(path).toBe('/rest/Car?%24top=10&q=a+b')
    expect(syncParamsFromPath(path).map((p) => [p.key, p.value])).toEqual([
      ['$top', '10'],
      ['q', 'a b'],
    ])
    expect(paramsFromSearch('?a=1&a=2').map((p) => p.value)).toEqual(['1', '2'])
  })

  it('infers content types for raw languages', () => {
    expect(inferRawContentType('json', '')).toBe('application/json')
    expect(inferRawContentType('xml', '')).toBe('application/xml')
    expect(inferRawContentType('custom', 'application/vnd.api+json')).toBe(
      'application/vnd.api+json'
    )
  })

  it('proposes progressive REST path chunks', () => {
    expect(buildRestPathSuggestions('', ['Color', 'Employee'])).toEqual(['/rest'])
    expect(buildRestPathSuggestions('/re', ['Color'])).toEqual(['/rest'])

    const afterRest = buildRestPathSuggestions('/rest', ['Color', 'Employee'])
    expect(afterRest).toEqual([
      '/rest/$catalog',
      '/rest/$info',
      '/rest/$singleton',
      '/rest/$upload',
      '/rest/Color',
      '/rest/Employee',
    ])
    expect(afterRest).not.toContain('/rest/Color[1]')

    const afterCatalog = buildRestPathSuggestions('/rest/$catalog', ['Color'])
    expect(afterCatalog).toContain('/rest/$catalog/$all')
    expect(afterCatalog).toContain('/rest/$catalog/Color')
    expect(afterCatalog.every((path) => path.startsWith('/rest/$catalog/'))).toBe(true)

    const afterColor = buildRestPathSuggestions('/rest/Color', ['Color'])
    expect(afterColor).toContain('/rest/Color[1]')
    expect(afterColor).toContain('/rest/Color/')
    expect(afterColor).toContain('/rest/Color/$entityset/')
    expect(afterColor.every((path) => !path.includes('?'))).toBe(true)
    expect(afterColor.every((path) => path.startsWith('/rest/Color'))).toBe(true)
  })

  it('matches REST path suggestions case-insensitively', () => {
    expect(buildRestPathSuggestions('/rest/c', ['Color', 'Employee'])).toEqual(['/rest/Color'])
    expect(buildRestPathSuggestions('/rest/COLOR', ['Color'])).toContain('/rest/Color[1]')
    expect(buildRestPathSuggestions('/REST', ['Color'])).toContain('/rest/Color')
    expect(buildRestPathSuggestions('/rest/$CAT', ['Color'])).toContain('/rest/$catalog')
  })

  it('surfaces unique recent history paths for the active target', () => {
    const requests = [
      { seed: { path: '/rest/Car', targetMode: 'current' as const } },
      { seed: { path: '/rest/Car?$top=1', targetMode: 'current' as const } },
      { seed: { path: '/rest/Car', targetMode: 'current' as const } },
      {
        seed: {
          path: '/v1/items',
          targetMode: 'custom' as const,
          customOrigin: 'https://api.example.com',
        },
      },
    ]
    expect(recentPathsFromHttpHistory(requests, { targetMode: 'current' })).toEqual([
      '/rest/Car',
      '/rest/Car?$top=1',
    ])
    expect(
      recentPathsFromHttpHistory(requests, {
        targetMode: 'custom',
        customOrigin: 'https://api.example.com',
      })
    ).toEqual(['/v1/items'])
  })

  it('merges recent history ahead of catalog suggestions', () => {
    expect(
      mergeRestPathSuggestions(['/rest', '/rest/Car'], ['/rest/Employee', '/rest/Car'])
    ).toEqual(['/rest/Employee', '/rest/Car', '/rest'])
  })

  it('proposes catalog attributes and entity methods instead of placeholders', () => {
    const catalog = {
      Color: {
        attributes: ['ID', 'name', 'photo'],
        entityMethods: ['getHex'],
        dataClassMethods: ['allActive'],
      },
    }
    expect(buildRestPathSuggestions('/rest/Color/', ['Color'], catalog)).toEqual([
      '/rest/Color/$entityset/',
      '/rest/Color/allActive',
    ])
    const entityMembers = buildRestPathSuggestions('/rest/Color[6]/', ['Color'], catalog)
    expect(entityMembers).toContain('/rest/Color[6]/ID')
    expect(entityMembers).toContain('/rest/Color[6]/name')
    expect(entityMembers).toContain('/rest/Color[6]/photo')
    expect(entityMembers).toContain('/rest/Color[6]/getHex')
    expect(entityMembers).not.toContain('/rest/Color[6]/attr')
    expect(entityMembers).not.toContain('/rest/Color[6]/functionName')
    expect(buildRestPathSuggestions('/rest/Color[6]/ph', ['Color'], catalog)).toEqual([
      '/rest/Color[6]/photo',
    ])
    expect(buildRestPathSuggestions('/rest/Color', ['Color'], catalog)).toContain(
      '/rest/Color:ID(value)'
    )
    expect(buildRestPathSuggestions('/rest/Color/', ['Color'], catalog)).not.toContain(
      '/rest/Color/attr'
    )
  })

  it('falls back to an example dataclass when the catalog is empty', () => {
    expect(buildRestPathSuggestions('/rest', [])).toContain('/rest/Employee')
    expect(buildRestPathSuggestions('/rest/$catalog', [])).toContain('/rest/$catalog/Employee')
  })

  it('exposes REST query param autocomplete keys and values', () => {
    expect(REST_QUERY_PARAMS).toContain('$filter')
    expect(REST_QUERY_PARAMS).toContain('$method')
    expect(REST_QUERY_PARAMS).toContain('$top')
    expect(restParamValueSuggestions('$method')).toContain('entityset')
    expect(restParamValueSuggestions('$compute')).toContain('sum')
    expect(restParamValueSuggestions('$asArray')).toEqual(['true', 'false'])
    expect(restParamValueSuggestions('unknown')).toEqual([])
  })

  it('builds urlencoded bodies and respects explicit Content-Type', () => {
    const draft = createEmptyHttpDraft({
      method: 'POST',
      path: '/rest/$catalog',
      body: normalizeHttpBody({
        mode: 'urlencoded',
        urlencoded: [createKeyValuePair({ key: 'name', value: 'Ada', enabled: true })],
      }),
      headers: [
        createKeyValuePair({
          key: 'Content-Type',
          value: 'application/x-www-form-urlencoded; charset=UTF-8',
          enabled: true,
        }),
      ],
    })
    const built = buildHttpRequest(draft)
    expect(built.body).toBe('name=Ada')
    expect(built.headers['Content-Type']).toBe('application/x-www-form-urlencoded; charset=UTF-8')
  })

  it('scopes connection headers and cookies to the current server only', () => {
    const current = buildHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/',
        settings: { sendCookies: true },
      })
    )
    expect(current.isCurrentServer).toBe(true)
    expect(current.headers['X-App']).toBe('dataexplorer')
    expect(current.headers.Cookie).toBe('session=abc')

    const custom = buildHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        targetMode: 'custom',
        customOrigin: 'https://other.example',
        path: '/api',
        settings: { sendCookies: true },
      })
    )
    expect(custom.isCurrentServer).toBe(false)
    expect(custom.headers['X-App']).toBeUndefined()
    expect(custom.headers.Cookie).toBeUndefined()
  })

  it('suppresses jar cookies when sendCookies is false on desktop', () => {
    withDesktop(() => {
      const built = buildHttpRequest(
        createEmptyHttpDraft({
          method: 'GET',
          path: '/rest/',
          settings: { sendCookies: false },
        })
      )
      expect(built.headers.Cookie).toBe('')
    })
  })

  it('lists desktop built-in headers with connection cookie and custom headers', () => {
    withDesktop(() => {
      const draft = createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/',
        settings: { sendCookies: true },
      })
      const builtIns = listHttpBuiltInHeaders(draft)
      const byKey = Object.fromEntries(builtIns.map((row) => [row.key.toLowerCase(), row]))
      expect(byKey['x-app']?.value).toBe('dataexplorer')
      expect(byKey['x-app']?.source).toBe('connection')
      expect(byKey.cookie?.value).toBe('session=abc')
      expect(byKey['user-agent']?.value).toBe(getDesktopHttpUserAgent())
      expect(byKey.origin?.value).toBe('https://server.example')
      expect(byKey.accept?.value).toBe(DESKTOP_HTTP_ACCEPT)
      expect(byKey.host?.value).toBe('server.example')
      expect(byKey['content-length']?.value).toBe('(auto)')
    })
  })

  it('applies desktop transport defaults when building a request', () => {
    withDesktop(() => {
      const built = buildHttpRequest(
        createEmptyHttpDraft({
          method: 'GET',
          path: '/rest/',
        })
      )
      expect(built.headers['User-Agent']).toBe(getDesktopHttpUserAgent())
      expect(built.headers.Origin).toBe('https://server.example')
      expect(built.headers.Accept).toBe(DESKTOP_HTTP_ACCEPT)
      expect(built.headers.Host).toBe('server.example')
    })
  })

  it('disables Origin and User-Agent with empty sentinels so plugin defaults do not win', () => {
    withDesktop(() => {
      const draft = createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/',
        disabledBuiltInHeaders: ['origin', 'user-agent'],
      })
      const built = buildHttpRequest(draft)
      expect(built.headers.Origin).toBe('')
      expect(built.headers['User-Agent']).toBe('')
      expect(listHttpBuiltInHeaders(draft).find((h) => h.key === 'Origin')?.enabled).toBe(false)
    })
  })

  it('lets a user override win over a built-in default', () => {
    withDesktop(() => {
      const draft = createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/',
        headers: [
          createKeyValuePair({
            key: 'User-Agent',
            value: 'DataExplorer/test',
            enabled: true,
          }),
        ],
      })
      const built = buildHttpRequest(draft)
      expect(built.headers['User-Agent']).toBe('DataExplorer/test')
      expect(listHttpBuiltInHeaders(draft).find((h) => h.key === 'User-Agent')?.overridden).toBe(
        true
      )
    })
  })

  it('skips a disabled connection header when merging', () => {
    const built = buildHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/',
        disabledBuiltInHeaders: ['x-app'],
      })
    )
    expect(built.headers['X-App']).toBeUndefined()
  })

  it('syncs Cookie enablement with sendCookies via setBuiltInHeaderEnabled', () => {
    const draft = createEmptyHttpDraft({
      method: 'GET',
      path: '/rest/',
      settings: { sendCookies: true },
    })
    const disabled = setBuiltInHeaderEnabled(draft, 'Cookie', false)
    expect(disabled.settings.sendCookies).toBe(false)
    expect(disabled.disabledBuiltInHeaders).toContain('cookie')

    const enabled = setBuiltInHeaderEnabled({ ...draft, ...disabled }, 'Cookie', true)
    expect(enabled.settings.sendCookies).toBe(true)
    expect(enabled.disabledBuiltInHeaders).not.toContain('cookie')
  })

  it('promotes a built-in edit into an enabled user header override', () => {
    const draft = createEmptyHttpDraft({ method: 'GET', path: '/rest/' })
    const next = upsertBuiltInHeaderOverride(draft, 'Accept', 'application/json')
    expect(next.headers.some((h) => h.key === 'Accept' && h.value === 'application/json')).toBe(
      true
    )
    expect(next.disabledBuiltInHeaders).not.toContain('accept')
  })

  it('uses the request target origin as the default Origin header', () => {
    withDesktop(() => {
      const built = buildHttpRequest(
        createEmptyHttpDraft({
          method: 'GET',
          targetMode: 'custom',
          customOrigin: 'http://localhost:8080',
          path: '/text.txt',
        })
      )
      expect(built.headers.Origin).toBe('http://localhost:8080')
      expect(built.headers.Host).toBe('localhost:8080')
    })
  })

  it('updates the connection cookie jar used when building Cookie', () => {
    setCookies({ a: '1', b: '2' })
    expect(getCookies()).toEqual({ a: '1', b: '2' })
    const built = buildHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/',
        settings: { sendCookies: true },
      })
    )
    expect(built.headers.Cookie).toBe('a=1; b=2')
    setCookies({ session: 'abc' })
  })

  it('formats response size and body', () => {
    expect(formatByteSize(512)).toBe('512 B')
    expect(formatByteSize(1536)).toBe('1.5 KB')
    expect(
      formatResponseBody({
        status: 200,
        statusText: 'OK',
        durationMs: 12,
        sizeBytes: 2,
        url: 'https://server.example/rest/',
        headers: {},
        cookies: [],
        contentType: 'application/json',
        bodyText: '{"a":1}',
        bodyJson: { a: 1 },
        bodyBinary: false,
      })
    ).toContain('"a": 1')
  })

  it('executes requests and reports metrics', async () => {
    const fetchMock = mock((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 201,
          statusText: 'Created',
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'token=xyz; Path=/',
          },
        })
      )
    )
    registerPlatformFetch(fetchMock as never)

    const result = await executeHttpRequest(
      createEmptyHttpDraft({
        method: 'POST',
        path: '/rest/Item',
        body: normalizeHttpBody({
          mode: 'raw',
          raw: '{"name":"Item"}',
          rawLanguage: 'json',
          rawContentType: 'application/json',
        }),
      })
    )

    expect(result.status).toBe(201)
    expect(result.sizeBytes).toBe(JSON.stringify({ ok: true }).length)
    expect(result.bodyJson).toEqual({ ok: true })
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('keeps binary response bytes for preview and download', async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
    const fetchMock = mock((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(jpegHeader, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'image/jpeg' },
        })
      )
    )
    registerPlatformFetch(fetchMock as never)

    const result = await executeHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        path: '/rest/Employee(1)/photo',
      })
    )

    expect(result.bodyBinary).toBe(true)
    expect(result.bodyBytes).toEqual(jpegHeader)
    expect(result.bodyPreview).toContain('image/jpeg')
    expect(result.bodyText).toBeNull()
    expect(result.bodySkipped).toBeFalsy()
  })

  it('does not buffer video/audio response bodies into memory', async () => {
    const videoBytes = new Uint8Array(2048).fill(1)
    const fetchMock = mock((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(videoBytes, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(videoBytes.length),
          },
        })
      )
    )
    registerPlatformFetch(fetchMock as never)

    const result = await executeHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        path: '/api/video.mp4',
      })
    )

    expect(result.bodyBinary).toBe(true)
    expect(result.bodySkipped).toBe(true)
    expect(result.bodyBytes).toBeUndefined()
    expect(result.sizeBytes).toBe(videoBytes.length)
    expect(result.bodyPreview).toContain('not buffered')
  })

  it('surfaces detailed network error messages instead of a bare Failed to fetch', async () => {
    const fetchMock = mock((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.reject(new TypeError('Failed to fetch'))
    )
    registerPlatformFetch(fetchMock as never)

    const result = await executeHttpRequest(
      createEmptyHttpDraft({
        method: 'GET',
        path: '/text.txt',
        targetMode: 'custom',
        customOrigin: 'http://localhost',
      })
    )

    expect(result.status).toBe(0)
    expect(result.error).toContain('TypeError: Failed to fetch')
    expect(result.error).toContain('URL:')
    expect(result.errorInfo?.name).toBe('TypeError')
    // With a document origin (jsdom / browser preload), custom origins are classified as CORS.
    expect(result.errorInfo?.kind === 'network' || result.errorInfo?.kind === 'cors').toBe(true)
    expect(result.error).not.toBe('Failed to fetch')
  })
})

describe('formatHttpClientNetworkError', () => {
  it('maps AbortError to Request cancelled', () => {
    const error = new DOMException('The operation was aborted.', 'AbortError')
    expect(formatHttpClientNetworkError(error, { url: 'http://example.com' })).toBe(
      'Request cancelled'
    )
    expect(analyzeHttpClientNetworkError(error, { url: 'http://example.com' }).kind).toBe(
      'cancelled'
    )
  })

  it('includes error name, cause chain, and URL', () => {
    const error = new TypeError('Failed to fetch', {
      cause: new Error('net::ERR_FAILED'),
    })
    const message = formatHttpClientNetworkError(error, {
      url: 'http://localhost/text.txt',
    })
    expect(message).toContain('TypeError: Failed to fetch')
    expect(message).toContain('Caused by: net::ERR_FAILED')
    expect(message).toContain('URL: http://localhost/text.txt')
    expect(
      analyzeHttpClientNetworkError(error, { url: 'http://localhost/text.txt' }).causes
    ).toEqual(['net::ERR_FAILED'])
  })

  it('adds a CORS hint for cross-origin Failed to fetch', () => {
    const previousWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          href: 'http://localhost:3002/',
          origin: 'http://localhost:3002',
          protocol: 'http:',
        },
      },
    })
    try {
      const info = analyzeHttpClientNetworkError(new TypeError('Failed to fetch'), {
        url: 'http://localhost/text.txt',
      })
      expect(info.kind).toBe('cors')
      expect(info.pageOrigin).toBe('http://localhost:3002')
      expect(info.targetOrigin).toBe('http://localhost')
      expect(info.hints.some((hint) => hint.id === 'cors')).toBe(true)

      const message = formatHttpClientNetworkError(new TypeError('Failed to fetch'), {
        url: 'http://localhost/text.txt',
      })
      expect(message).toContain('Cross-origin request')
      expect(message).toContain('http://localhost:3002 → http://localhost')
      expect(message).toContain('CORS')
    } finally {
      if (previousWindow === undefined) {
        // @ts-expect-error cleanup test window stub
        delete globalThis.window
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: previousWindow,
        })
      }
    }
  })
})
