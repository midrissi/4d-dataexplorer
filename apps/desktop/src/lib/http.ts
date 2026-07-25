import { invoke } from '@tauri-apps/api/core'
import {
  getCookies,
  getSkipSSL,
  getTimeout,
  ingestSetCookieHeaders,
  ingestSetCookieRawValues,
  isDesktop,
  type PlatformFetchInit,
} from '~/lib/platform'

/**
 * A `fetch`-compatible function that proxies requests through Tauri's HTTP
 * plugin (Rust backend) when running inside the desktop shell, which bypasses
 * browser CORS restrictions. Falls back to the global `fetch` in a plain
 * browser (e.g. `vite dev` without Tauri).
 *
 * Skip-SSL / self-signed local hosts use a dedicated Rust helper
 * (`desktop_http_request`) so certificate bypass is explicit and TLS errors
 * include the full cause chain (the HTTP plugin only returns
 * "error sending request for url").
 *
 * The Tauri plugin is imported lazily so the web build never bundles it.
 */

// Tauri's fetch accepts a `danger` option (requires the `dangerous-settings`
// Cargo feature) to bypass certificate validation for servers with an
// incomplete/self-signed chain.
type TauriFetchInit = RequestInit & {
  danger?: { acceptInvalidCerts?: boolean; acceptInvalidHostnames?: boolean }
  connectTimeout?: number
  maxRedirections?: number
}

type DesktopHttpResponsePayload = {
  status: number
  statusText: string
  headers: [string, string][]
  url: string
  body: number[]
}

let tauriFetchPromise: Promise<typeof fetch> | null = null

function loadTauriFetch(): Promise<typeof fetch> {
  if (!tauriFetchPromise) {
    tauriFetchPromise = import('@tauri-apps/plugin-http').then(
      (m) => m.fetch as unknown as typeof fetch
    )
  }
  return tauriFetchPromise
}

/** Loopback / local hosts almost always use self-signed 4D HTTPS certs. */
function isLocalDevHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '::1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    )
  } catch {
    return false
  }
}

function shouldSkipSsl(url: string, skipSsl?: boolean): boolean {
  return Boolean(skipSsl ?? getSkipSSL()) || isLocalDevHost(url)
}

/** Danger settings applied when the active connection or request opts to skip SSL. */
function sslDanger(skip: boolean): TauriFetchInit {
  if (!skip) return {}
  // Both flags are required by the plugin's serde schema (non-optional bools).
  return {
    danger: {
      acceptInvalidCerts: true,
      acceptInvalidHostnames: true,
    },
  }
}

function asError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string' && err.trim()) return new Error(err.trim())
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message: unknown }).message ?? '').trim()
    if (message) return new Error(message)
  }
  try {
    const serialized = JSON.stringify(err)
    if (serialized && serialized !== '{}' && serialized !== 'null') {
      return new Error(serialized)
    }
  } catch {
    // ignore
  }
  return new Error(fallback)
}

/** Convert any HeadersInit into a plain record. */
function toPlainHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value
    })
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = value
  } else {
    Object.assign(out, headers)
  }
  return out
}

/**
 * Inject the connection's cookies as a `Cookie` header. The browser
 * `Request`/`Headers` APIs strip the forbidden `Cookie` header, so it must be
 * added here (as a plain object) — Tauri's fetch preserves it and forwards it
 * to Rust (which requires the `unsafe-headers` feature to keep it).
 *
 * When `sendCookies` is false, an empty Cookie header is set so reqwest skips
 * its cookie-jar injection (jar only fills Cookie when the header is absent).
 */
function withCookies(headers: Record<string, string>, sendCookies = true): Record<string, string> {
  const alreadySet = Object.keys(headers).some((k) => k.toLowerCase() === 'cookie')
  if (!sendCookies) {
    if (alreadySet) return headers
    return { ...headers, Cookie: '' }
  }
  const cookies = getCookies()
  const names = Object.keys(cookies)
  if (names.length === 0) return headers
  if (alreadySet) return headers
  return {
    ...headers,
    Cookie: names.map((name) => `${name}=${cookies[name]}`).join('; '),
  }
}

/** Redact sensitive header values so logs are useful but not leaking secrets. */
function describeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  const entries: [string, string][] =
    headers instanceof Headers
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? (headers as [string, string][])
        : Object.entries(headers as Record<string, string>)
  for (const [key, value] of entries) {
    const lower = key.toLowerCase()
    if (lower === 'authorization') {
      out[key] = `${value.split(' ')[0] ?? ''} ***`
    } else if (lower === 'cookie') {
      // Show cookie names + value length so we can confirm they are present
      out[key] = value
        .split(';')
        .map((c) => {
          const [name, val = ''] = c.trim().split('=')
          return `${name}=<${val.trim().length} chars>`
        })
        .join('; ')
    } else {
      out[key] = value
    }
  }
  return out
}

function resolveConnectTimeout(init?: PlatformFetchInit): number | undefined {
  if (typeof init?.connectTimeout === 'number') return init.connectTimeout
  const connectionTimeout = getTimeout()
  if (typeof connectionTimeout === 'number' && connectionTimeout > 0) return connectionTimeout
  return undefined
}

async function readRequestParts(
  input: RequestInfo | URL,
  init?: PlatformFetchInit
): Promise<{
  url: string
  method: string
  headers: Record<string, string>
  body: ArrayBuffer | undefined
  signal: AbortSignal | undefined
}> {
  const sendCookies = init?.sendCookies !== false

  if (input instanceof Request) {
    const req = input
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    return {
      url: req.url,
      method: req.method,
      headers: withCookies(toPlainHeaders(req.headers), sendCookies),
      body: hasBody ? await req.arrayBuffer() : undefined,
      signal: init?.signal ?? req.signal,
    }
  }

  const url = typeof input === 'string' ? input : input.toString()
  const method = (init?.method ?? 'GET').toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD'
  let body: ArrayBuffer | undefined
  if (hasBody && init?.body != null) {
    if (typeof init.body === 'string') {
      body = new TextEncoder().encode(init.body).buffer as ArrayBuffer
    } else if (init.body instanceof ArrayBuffer) {
      body = init.body
    } else if (ArrayBuffer.isView(init.body)) {
      const view = init.body
      body = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
    } else if (init.body instanceof Blob) {
      body = await init.body.arrayBuffer()
    } else if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
      // Build a Request so the multipart boundary is generated correctly.
      const temp = new Request(url, { method, body: init.body })
      body = await temp.arrayBuffer()
      const contentType = temp.headers.get('content-type')
      const headers = withCookies(toPlainHeaders(init.headers), sendCookies)
      if (contentType && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = contentType
      }
      return {
        url,
        method,
        headers,
        body,
        signal: init?.signal ?? undefined,
      }
    } else if (typeof URLSearchParams !== 'undefined' && init.body instanceof URLSearchParams) {
      body = new TextEncoder().encode(init.body.toString()).buffer as ArrayBuffer
    } else if (typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream) {
      body = await new Response(init.body).arrayBuffer()
    }
  }

  return {
    url,
    method,
    headers: withCookies(toPlainHeaders(init?.headers), sendCookies),
    body,
    signal: init?.signal ?? undefined,
  }
}

async function insecureDesktopFetch(
  input: RequestInfo | URL,
  init?: PlatformFetchInit
): Promise<Response> {
  const parts = await readRequestParts(input, init)
  const connectTimeout = resolveConnectTimeout(init)

  if (parts.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  console.debug('[tauri-fetch:insecure] →', parts.method, parts.url, {
    headers: describeHeaders(parts.headers),
    bodyBytes: parts.body?.byteLength ?? 0,
    connectTimeout,
  })

  const abort = () => {
    // invoke cannot be cancelled mid-flight; best-effort signal mapping below.
  }
  parts.signal?.addEventListener('abort', abort, { once: true })

  try {
    // Always send a body for non-GET/HEAD so Content-Length is set.
    // Prefer `{}` over a zero-length body — 4D returns 411 when Content-Length
    // is missing, and some HTTP stacks omit Content-Length: 0.
    const methodUpper = parts.method.toUpperCase()
    const allowBody = methodUpper !== 'GET' && methodUpper !== 'HEAD'
    const emptyJson = Array.from(new TextEncoder().encode('{}'))
    const bodyBytes =
      parts.body && parts.body.byteLength > 0
        ? Array.from(new Uint8Array(parts.body))
        : allowBody
          ? emptyJson
          : null

    const headers = { ...parts.headers }
    if (bodyBytes) {
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase()
        if (lower === 'content-length' || lower === 'transfer-encoding') {
          delete headers[key]
        }
      }
      headers['Content-Length'] = String(bodyBytes.length)
    }

    const payload = await invoke<DesktopHttpResponsePayload>('desktop_http_request', {
      request: {
        method: parts.method,
        url: parts.url,
        headers: Object.entries(headers),
        body: bodyBytes,
        connectTimeout: connectTimeout ?? null,
        skipSsl: true,
      },
    })

    if (parts.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    const response = new Response(new Uint8Array(payload.body), {
      status: payload.status,
      statusText: payload.statusText,
      headers: payload.headers,
    })
    Object.defineProperty(response, 'url', { value: payload.url, writable: false })

    console.debug('[tauri-fetch:insecure] ←', response.status, response.statusText, payload.url)
    // Ingest from raw payload: `new Response()` strips Set-Cookie (forbidden header).
    const rawSetCookie = payload.headers
      .filter(([n]) => n.toLowerCase() === 'set-cookie')
      .map(([, value]) => value)
    void ingestSetCookieRawValues(rawSetCookie)
    return response
  } catch (err) {
    const error = asError(err, 'Network request failed')
    console.error('[tauri-fetch:insecure] ✗', parts.url, error.message)
    throw error
  } finally {
    parts.signal?.removeEventListener('abort', abort)
  }
}

async function normalizedTauriFetch(
  input: RequestInfo | URL,
  init?: PlatformFetchInit
): Promise<Response> {
  const previewUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const skipSsl = shouldSkipSsl(previewUrl, init?.skipSsl)

  // Self-signed / skip-SSL: dedicated Rust client with full error chains.
  if (skipSsl) {
    return insecureDesktopFetch(input, init)
  }

  const tauriFetch = await loadTauriFetch()
  const danger = sslDanger(false)
  const sendCookies = init?.sendCookies !== false

  let url: string
  let options: TauriFetchInit

  if (input instanceof Request) {
    const req = input
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const body = hasBody ? await req.arrayBuffer() : undefined
    url = req.url
    options = {
      method: req.method,
      headers: withCookies(toPlainHeaders(req.headers), sendCookies),
      body,
      signal: init?.signal ?? req.signal,
      ...danger,
    }
  } else {
    url = typeof input === 'string' ? input : input.toString()
    const {
      sendCookies: _sc,
      skipSsl: _ss,
      ...requestInit
    } = (init ?? {}) as PlatformFetchInit & Record<string, unknown>
    options = {
      ...(requestInit as RequestInit),
      headers: withCookies(toPlainHeaders(init?.headers), sendCookies),
      ...danger,
    }
  }

  const connectTimeout = resolveConnectTimeout(init)
  if (typeof connectTimeout === 'number') {
    options.connectTimeout = connectTimeout
  }
  if (typeof init?.maxRedirections === 'number') {
    options.maxRedirections = init.maxRedirections
  }

  delete (options as PlatformFetchInit).sendCookies
  delete (options as PlatformFetchInit).skipSsl

  console.debug('[tauri-fetch] →', options.method ?? 'GET', url, {
    headers: describeHeaders(options.headers),
    skipSSL: false,
    connectTimeout: options.connectTimeout,
    maxRedirections: options.maxRedirections,
  })

  try {
    const response = await tauriFetch(url, options)
    console.debug('[tauri-fetch] ←', response.status, response.statusText, url)
    void ingestSetCookieHeaders(response.headers)
    return response
  } catch (err) {
    const error = asError(err, 'Network request failed')
    console.error('[tauri-fetch] ✗', url, {
      skipSSL: false,
      error: error.message,
    })
    throw error
  }
}

export const desktopFetch: (
  input: RequestInfo | URL,
  init?: PlatformFetchInit
) => Promise<Response> = (input, init) => {
  if (isDesktop()) {
    return normalizedTauriFetch(input, init)
  }
  return globalThis.fetch(input, init)
}
