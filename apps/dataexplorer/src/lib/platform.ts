import { createLoggingFetch } from './logging-fetch'

/**
 * Platform detection and base URL management for desktop/web modes.
 *
 * In web mode: the app runs behind a Vite proxy, so baseUrl = window.location.origin.
 * In desktop mode (Tauri): the app connects to a user-configured remote server.
 */

/**
 * Detect if running inside a Tauri desktop app
 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Detect if running as a regular web application
 */
export function isWeb(): boolean {
  return !isDesktop()
}

// ─── Dynamic Base URL Management ────────────────────────────────────────────────

let _baseUrl: string = typeof window !== 'undefined' ? window.location.origin : ''
let _customHeaders: Record<string, string> = {}
let _cookies: Record<string, string> = {}
let _timeout: number | undefined
let _skipSSL = false

const _listeners: Array<() => void> = []

/**
 * Get the current base URL for REST API requests
 */
export function getBaseUrl(): string {
  return _baseUrl
}

/**
 * Get custom headers configured for the connection
 */
export function getCustomHeaders(): Record<string, string> {
  return { ..._customHeaders }
}

/**
 * Get cookies configured for the connection. These are injected as a `Cookie`
 * header at request time by the desktop fetch (the browser `Request`/`Headers`
 * APIs strip forbidden headers like `Cookie`, so they can't be set upstream).
 */
export function getCookies(): Record<string, string> {
  return { ..._cookies }
}

/**
 * Replace the in-memory connection cookie jar and notify listeners.
 */
export function setCookies(cookies: Record<string, string>): void {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(cookies)) {
    const name = key.trim()
    if (!name) continue
    next[name] = value
  }
  _cookies = next
  for (const listener of _listeners) {
    listener()
  }
}

/**
 * Persist cookies onto the active desktop connection profile (no-op on web).
 * Empty jars are stored as `{}` so we do not re-import the HTTP plugin jar later.
 */
export async function persistConnectionCookies(cookies: Record<string, string>): Promise<void> {
  const api = getConnectionStoreAPI()
  if (!api) return
  const active = await api.getActiveConnection()
  if (!active) return
  const cleaned: Record<string, string> = {}
  for (const [key, value] of Object.entries(cookies)) {
    const name = key.trim()
    if (!name) continue
    cleaned[name] = value
  }
  await api.saveConnection({
    ...active,
    cookies: cleaned,
  })
}

/**
 * Update runtime cookies and persist them to the active connection when possible.
 */
export async function updateConnectionCookies(cookies: Record<string, string>): Promise<void> {
  setCookies(cookies)
  await persistConnectionCookies(cookies)
}

/** Parse raw Set-Cookie header value strings into a name → value map. */
export function parseSetCookieRawValues(rawList: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of rawList) {
    const [pair] = raw.split(';')
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const name = pair.slice(0, eq).trim()
    if (!name) continue
    out[name] = pair.slice(eq + 1).trim()
  }
  return out
}

/** Parse Set-Cookie header values into a name → value map. */
export function parseSetCookieNameValues(headers: Headers): Record<string, string> {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const rawList =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : (() => {
          const single = headers.get('set-cookie')
          return single ? [single] : []
        })()
  return parseSetCookieRawValues(rawList)
}

/**
 * Merge Set-Cookie response headers into the connection jar and persist.
 */
export async function ingestSetCookieHeaders(headers: Headers): Promise<void> {
  await ingestSetCookieRawValues(
    (() => {
      const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
      if (typeof getSetCookie === 'function') return getSetCookie.call(headers)
      const single = headers.get('set-cookie')
      return single ? [single] : []
    })()
  )
}

/**
 * Merge raw Set-Cookie strings into the connection jar and persist.
 * Prefer this when headers come from a non-browser HTTP stack: `new Response()`
 * strips Set-Cookie as a forbidden response header name.
 */
export async function ingestSetCookieRawValues(rawList: string[]): Promise<void> {
  const parsed = parseSetCookieRawValues(rawList)
  if (Object.keys(parsed).length === 0) return
  const merged = { ...getCookies(), ...parsed }
  setCookies(merged)
  await persistConnectionCookies(merged)
}

/**
 * When the connection profile has no cookies yet, import matching cookies from
 * tauri-plugin-http's on-disk jar (so the UI matches what the plugin sends).
 */
export async function importHttpJarCookiesIfNeeded(url = getBaseUrl()): Promise<void> {
  if (!isDesktop()) return
  if (Object.keys(_cookies).length > 0) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const jar = await invoke<Record<string, string>>('list_http_jar_cookies', { url })
    if (!jar || Object.keys(jar).length === 0) return
    setCookies(jar)
    await persistConnectionCookies(jar)
  } catch (err) {
    console.warn('[cookies] failed to import HTTP jar cookies', err)
  }
}

/**
 * Get the configured request timeout (ms), or undefined for default
 */
export function getTimeout(): number | undefined {
  return _timeout
}

/**
 * Whether SSL certificate validation should be skipped
 */
export function getSkipSSL(): boolean {
  return _skipSSL
}

/**
 * Override the skip-SSL flag (e.g. to honor the form toggle when testing a
 * connection before it becomes the active one).
 */
export function setSkipSSL(skip: boolean): void {
  _skipSSL = skip
}

/**
 * Update the connection configuration (called from desktop connection screen)
 */
export function setConnectionConfig(config: {
  baseUrl: string
  headers?: Record<string, string>
  cookies?: Record<string, string>
  timeout?: number
  skipSSL?: boolean
}): void {
  _baseUrl = config.baseUrl.replace(/\/$/, '')
  _customHeaders = config.headers ?? {}
  _cookies = config.cookies ?? {}
  _timeout = config.timeout
  _skipSSL = config.skipSSL ?? false
  // Notify listeners
  for (const listener of _listeners) {
    listener()
  }
}

/**
 * Subscribe to connection config changes. Returns an unsubscribe function.
 */
export function onConnectionChange(listener: () => void): () => void {
  _listeners.push(listener)
  return () => {
    const idx = _listeners.indexOf(listener)
    if (idx >= 0) _listeners.splice(idx, 1)
  }
}

// ─── Pluggable Fetch (desktop bypasses CORS via Tauri HTTP) ─────────────────────
// The desktop app registers a fetch implementation that proxies requests through
// the Tauri Rust backend, avoiding browser CORS restrictions. In web mode this
// stays undefined and the REST client uses the global fetch.

/**
 * Extended fetch init used by the HTTP Client (and forwarded by desktop fetch).
 * Unknown fields are ignored by the browser fetch implementation.
 */
export type PlatformFetchInit = RequestInit & {
  /** When false, suppress automatic cookie injection / credentials. */
  sendCookies?: boolean
  /** Desktop: connect timeout in milliseconds. */
  connectTimeout?: number
  /** Desktop: max redirects to follow (0 = none). */
  maxRedirections?: number
  /** Desktop: skip SSL verification for this request. */
  skipSsl?: boolean
}

type PlatformFetch = (input: RequestInfo | URL, init?: PlatformFetchInit) => Promise<Response>

let _platformFetch: PlatformFetch | undefined

/**
 * Register a custom fetch implementation for REST requests (called by the
 * desktop app to route requests through Tauri's HTTP plugin).
 */
export function registerPlatformFetch(fetchFn: PlatformFetch): void {
  _platformFetch = fetchFn
}

/**
 * Get the registered platform fetch, or undefined to use the default fetch.
 */
export function getPlatformFetch(): PlatformFetch | undefined {
  return _platformFetch
}

/**
 * Return the active fetch implementation wrapped with request logging.
 * This always returns a function in both web and desktop modes.
 */
export function getLoggingFetch(): typeof fetch {
  return createLoggingFetch((_platformFetch ?? globalThis.fetch) as typeof globalThis.fetch)
}

/**
 * Reset connection config to defaults (web mode: origin)
 */
export function resetConnectionConfig(): void {
  _baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  _customHeaders = {}
  _cookies = {}
  _timeout = undefined
  _skipSSL = false
  for (const listener of _listeners) {
    listener()
  }
}

// ─── Desktop Connection Store Bridge ────────────────────────────────────────────
// The desktop app registers these callbacks so the shared SettingsPage can
// interact with the connection store without importing desktop-only modules.

export interface DesktopConnectionInfo {
  id: string
  name: string
  baseUrl: string
  accessKey?: string
  username?: string
  headers?: Record<string, string>
  cookies?: Record<string, string>
  skipSSL?: boolean
  timeout?: number
  color?: string
  icon?: string
  readonly?: boolean
}

export interface DesktopConnectionStoreAPI {
  getActiveConnection: () => Promise<DesktopConnectionInfo | null>
  saveConnection: (config: Record<string, unknown>) => Promise<DesktopConnectionInfo>
  clearActiveConnection: () => Promise<void>
  clearConnectionCookies?: (id: string) => Promise<void>
}

let _connectionStoreAPI: DesktopConnectionStoreAPI | null = null

/**
 * Register the desktop connection store API (called by the desktop app on init)
 */
export function registerConnectionStoreAPI(api: DesktopConnectionStoreAPI): void {
  _connectionStoreAPI = api
}

/**
 * Get the registered connection store API (null in web mode)
 */
export function getConnectionStoreAPI(): DesktopConnectionStoreAPI | null {
  return _connectionStoreAPI
}
