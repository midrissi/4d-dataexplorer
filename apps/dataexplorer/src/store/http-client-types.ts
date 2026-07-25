export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CUSTOM'

export type HttpKeyValuePair = {
  id: string
  key: string
  value: string
  enabled: boolean
  description?: string
}

export type HttpFormDataField =
  | {
      id: string
      kind: 'text'
      key: string
      value: string
      enabled: boolean
      contentType?: string
    }
  | {
      id: string
      kind: 'file'
      key: string
      enabled: boolean
      fileName?: string
      /** Base64 payload for persistence across remounts; omitted when only a File handle is used. */
      fileBase64?: string
      contentType?: string
    }

export type HttpBodyMode = 'none' | 'form-data' | 'urlencoded' | 'raw' | 'binary'

export type HttpRawLanguage = 'json' | 'text' | 'xml' | 'javascript' | 'html' | 'custom'

export type HttpBodyState = {
  mode: HttpBodyMode
  formData: HttpFormDataField[]
  urlencoded: HttpKeyValuePair[]
  raw: string
  rawLanguage: HttpRawLanguage
  rawContentType: string
  binaryFileName?: string
  binaryBase64?: string
  binaryContentType?: string
}

export type HttpClientSettings = {
  /** Automatically attach cookies for the current connection / jar. */
  sendCookies: boolean
  timeoutMs: number | null
  followRedirects: boolean
  maxRedirects: number
  /** Desktop only: skip SSL verification for this request. */
  skipSsl: boolean
  /** Web credentials mode when cookies are enabled. */
  credentials: 'include' | 'omit' | 'same-origin'
}

export type HttpTargetMode = 'current' | 'custom'

export type HttpClientSeed = {
  method?: HttpMethod
  customMethod?: string
  targetMode?: HttpTargetMode
  /** Custom origin like `https://api.example.com` when targetMode is custom. */
  customOrigin?: string
  /** Path + optional query, e.g. `/rest/Car` or `rest/Car?$top=1`. */
  path?: string
  params?: HttpKeyValuePair[]
  headers?: HttpKeyValuePair[]
  body?: Partial<HttpBodyState>
  settings?: Partial<HttpClientSettings>
  /**
   * Lowercase built-in / transport header names the user unchecked for this request
   * (e.g. `user-agent`, `origin`, `cookie`).
   */
  disabledBuiltInHeaders?: string[]
  /** Soft warnings shown when seed cannot fully reconstruct a request. */
  warnings?: string[]
  label?: string
}

export type HttpResponseCookie = {
  name: string
  value: string
  raw: string
}

export type HttpClientResponse = {
  status: number
  statusText: string
  durationMs: number
  sizeBytes: number
  url: string
  headers: Record<string, string>
  cookies: HttpResponseCookie[]
  contentType: string | null
  bodyText: string | null
  bodyJson: unknown | null
  bodyBinary: boolean
  /** Present when {@link bodyBinary} is true — raw response bytes for preview/download. */
  bodyBytes?: Uint8Array
  bodyPreview?: string
  /**
   * True when the binary body was intentionally not loaded into memory
   * (video/audio, or larger than the HTTP client buffer limit).
   */
  bodySkipped?: boolean
  /** Human-readable multi-line error (also used for Copy). */
  error?: string
  /** Structured network/CORS diagnostics for the response error UI. */
  errorInfo?: HttpClientNetworkErrorInfo
}

export type HttpClientNetworkErrorKind =
  | 'cancelled'
  | 'cors'
  | 'mixed-content'
  | 'network'
  | 'unknown'

export type HttpClientNetworkErrorHint = {
  id: 'cors' | 'mixed-content' | 'console' | 'desktop'
  tone: 'amber' | 'destructive' | 'muted'
}

export type HttpClientNetworkErrorInfo = {
  kind: HttpClientNetworkErrorKind
  /** Short headline, e.g. "Failed to fetch" */
  title: string
  /** Exception name when available, e.g. "TypeError" */
  name?: string
  /** Raw exception message */
  message: string
  url: string
  causes: string[]
  pageOrigin?: string
  targetOrigin?: string
  hints: HttpClientNetworkErrorHint[]
}

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'CUSTOM',
]

export const DEFAULT_HTTP_SETTINGS: HttpClientSettings = {
  sendCookies: true,
  timeoutMs: null,
  followRedirects: true,
  maxRedirects: 20,
  skipSsl: false,
  credentials: 'include',
}

export const DEFAULT_HTTP_BODY: HttpBodyState = {
  mode: 'none',
  formData: [],
  urlencoded: [],
  raw: '',
  rawLanguage: 'json',
  rawContentType: 'application/json',
}

export function createKeyValuePair(
  partial?: Partial<Omit<HttpKeyValuePair, 'id'>> & { id?: string }
): HttpKeyValuePair {
  return {
    id: partial?.id ?? createHttpId(),
    key: partial?.key ?? '',
    value: partial?.value ?? '',
    enabled: partial?.enabled ?? true,
    description: partial?.description,
  }
}

export function createHttpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizeHttpBody(body?: Partial<HttpBodyState> | null): HttpBodyState {
  return {
    ...DEFAULT_HTTP_BODY,
    ...body,
    formData: Array.isArray(body?.formData) ? body.formData : DEFAULT_HTTP_BODY.formData,
    urlencoded: Array.isArray(body?.urlencoded) ? body.urlencoded : DEFAULT_HTTP_BODY.urlencoded,
    raw: typeof body?.raw === 'string' ? body.raw : DEFAULT_HTTP_BODY.raw,
    rawLanguage: body?.rawLanguage ?? DEFAULT_HTTP_BODY.rawLanguage,
    rawContentType: body?.rawContentType ?? DEFAULT_HTTP_BODY.rawContentType,
  }
}

export function normalizeHttpSettings(
  settings?: Partial<HttpClientSettings> | null
): HttpClientSettings {
  return {
    ...DEFAULT_HTTP_SETTINGS,
    ...settings,
    timeoutMs:
      settings?.timeoutMs === undefined
        ? DEFAULT_HTTP_SETTINGS.timeoutMs
        : settings.timeoutMs === null || Number.isFinite(settings.timeoutMs)
          ? settings.timeoutMs
          : DEFAULT_HTTP_SETTINGS.timeoutMs,
    maxRedirects:
      typeof settings?.maxRedirects === 'number' && Number.isFinite(settings.maxRedirects)
        ? Math.max(0, Math.floor(settings.maxRedirects))
        : DEFAULT_HTTP_SETTINGS.maxRedirects,
  }
}
