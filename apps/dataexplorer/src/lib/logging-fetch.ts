import { consoleService } from '~/lib/console'
import type { PlatformFetchInit } from '~/lib/platform'

const MAX_BODY_BYTES = 64 * 1024
const REDACTED = '[REDACTED]'
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key'])
const SENSITIVE_KEYS = /^(accesskey|api[-_]?key|authorization|cookie|password|secret|token)$/i
const wrappers = new WeakMap<typeof fetch, typeof fetch>()

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value
  })
  return result
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen))
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEYS.test(key) ? REDACTED : redactValue(item, seen)
  }
  return result
}

function parseBody(text: string, contentType: string, truncated: boolean): unknown {
  const suffix = truncated ? '\n… [truncated]' : ''
  if (!text) return undefined

  if (!truncated && contentType.includes('json')) {
    try {
      return redactValue(JSON.parse(text))
    } catch {
      // Preserve invalid JSON as text.
    }
  }
  return `${text}${suffix}`
}

/** True for bodies that must not be cloned/tee'd (unread tee side stalls Tauri streams). */
function shouldSkipBodyLogging(contentType: string): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  if (ct.includes('multipart/form-data')) return true
  if (
    ct.includes('json') ||
    ct.startsWith('text/') ||
    ct.includes('xml') ||
    ct.includes('javascript') ||
    ct.includes('form-urlencoded') ||
    ct.includes('svg')
  ) {
    return false
  }
  // Treat remaining typed bodies as binary-like (image/audio/video/pdf/octet-stream/…).
  return true
}

async function readBody(
  source: Request | Response,
  contentType: string
): Promise<{ body: unknown | undefined; sizeBytes?: number }> {
  if (!source.body) return { body: undefined }
  if (contentType.includes('multipart/form-data')) {
    return { body: '[multipart form data]' }
  }
  if (shouldSkipBodyLogging(contentType)) {
    return { body: `[${contentType || 'binary'} body]` }
  }

  const reader = source.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  let truncated = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = MAX_BODY_BYTES - bytes
      if (value.byteLength > remaining) {
        text += decoder.decode(value.subarray(0, Math.max(0, remaining)), { stream: true })
        bytes += remaining
        truncated = true
        await reader.cancel()
        break
      }
      bytes += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return {
      body: parseBody(text, contentType, truncated),
      sizeBytes: truncated ? undefined : bytes,
    }
  } catch {
    return { body: undefined }
  } finally {
    reader.releaseLock()
  }
}

function contentLengthBytes(headers: Headers): number | undefined {
  const raw = headers.get('content-length')
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * `new Request(input, init)` only keeps Fetch `RequestInit` fields. Desktop
 * options (`skipSsl`, timeouts, cookie policy) must be forwarded separately.
 */
function platformFetchInit(init?: RequestInit): PlatformFetchInit | undefined {
  if (!init) return undefined
  const source = init as PlatformFetchInit
  const next: PlatformFetchInit = {}
  if (typeof source.skipSsl === 'boolean') next.skipSsl = source.skipSsl
  if (typeof source.sendCookies === 'boolean') next.sendCookies = source.sendCookies
  if (typeof source.connectTimeout === 'number') next.connectTimeout = source.connectTimeout
  if (typeof source.maxRedirections === 'number') next.maxRedirections = source.maxRedirections
  return Object.keys(next).length > 0 ? next : undefined
}

export function createLoggingFetch(inner: typeof fetch): typeof fetch {
  const existing = wrappers.get(inner)
  if (existing) return existing

  const loggingFetch = (async (input, init) => {
    const startedAt = performance.now()
    let request: Request
    const forwarded = platformFetchInit(init)

    try {
      request = new Request(input, init)
    } catch {
      return inner(input, init)
    }

    const requestContentType = request.headers.get('content-type') ?? ''
    // Fetch with `request`, not `input`: new Request(existingRequest) consumes its body.
    // Never clone/read binary request bodies — unused tee branches stall Tauri streams.
    const requestBodyPromise = shouldSkipBodyLogging(requestContentType)
      ? Promise.resolve({
          body: requestContentType.includes('multipart/form-data')
            ? '[multipart form data]'
            : `[${requestContentType || 'binary'} body]`,
        } as { body: unknown | undefined; sizeBytes?: number })
      : readBody(request.clone(), requestContentType)

    try {
      const response = await inner(request, forwarded)
      const durationMs = performance.now() - startedAt
      const responseContentType = response.headers.get('content-type') ?? ''
      const responseSizeHint = contentLengthBytes(response.headers)

      // Critical: do not clone binary responses. An unread tee side blocks the
      // consumer (e.g. HTTP Client body read) and freezes the desktop app.
      if (shouldSkipBodyLogging(responseContentType)) {
        void requestBodyPromise.then((requestResult) => {
          consoleService.network({
            method: request.method,
            url: request.url,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            responseSizeBytes: responseSizeHint,
            requestHeaders: headersToRecord(request.headers),
            responseHeaders: headersToRecord(response.headers),
            requestBody: requestResult.body,
            responseBody: `[${responseContentType || 'binary'} body]`,
          })
        })
        return response
      }

      const responseClone = response.clone()

      void Promise.all([requestBodyPromise, readBody(responseClone, responseContentType)]).then(
        ([requestResult, responseResult]) => {
          consoleService.network({
            method: request.method,
            url: request.url,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            responseSizeBytes: responseSizeHint ?? responseResult.sizeBytes,
            requestHeaders: headersToRecord(request.headers),
            responseHeaders: headersToRecord(response.headers),
            requestBody: requestResult.body,
            responseBody: responseResult.body,
          })
        }
      )

      return response
    } catch (error) {
      consoleService.network({
        method: request.method,
        url: request.url,
        durationMs: performance.now() - startedAt,
        requestHeaders: headersToRecord(request.headers),
        requestBody: (await requestBodyPromise).body,
        error: redactValue(error),
      })
      consoleService.error('Network request failed', {
        method: request.method,
        url: request.url,
        error: getErrorMessage(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorCause:
          error instanceof Error && error.cause instanceof Error
            ? `${error.cause.name}: ${error.cause.message}`
            : error instanceof Error && error.cause != null
              ? String(error.cause)
              : undefined,
      })
      throw error
    }
  }) as typeof fetch

  wrappers.set(inner, loggingFetch)
  return loggingFetch
}
