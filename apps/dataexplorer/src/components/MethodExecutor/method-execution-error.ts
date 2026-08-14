import { analyzeHttpClientNetworkError, formatHttpClientNetworkErrorInfo } from '~/lib/http-client'
import { getBaseUrl } from '~/lib/platform'
import { restPathForSeed } from '~/lib/postman/method-seed-to-item'
import type { HttpClientResponse } from '~/store/http-client-types'
import type { MethodExecutorSeed } from '~/store/method-executor-types'

/** Absolute REST URL for a method seed (for error request-details). */
export function methodRequestUrl(seed: MethodExecutorSeed, query?: Record<string, string>): string {
  const origin = getBaseUrl().replace(/\/$/, '')
  const path = `/rest${restPathForSeed(seed)}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${origin}${path}?${qs}` : `${origin}${path}`
}

/** Build an HTTP-Client-shaped error response for the Method Executor result panel. */
export function methodExecutionErrorResponse(
  error: unknown,
  context: { url: string; durationMs: number }
): HttpClientResponse {
  const errorInfo = analyzeHttpClientNetworkError(error, { url: context.url })
  return {
    status: 0,
    statusText: '',
    durationMs: context.durationMs,
    sizeBytes: 0,
    url: context.url,
    headers: {},
    cookies: [],
    contentType: null,
    bodyText: null,
    bodyJson: null,
    bodyBinary: false,
    error: formatHttpClientNetworkErrorInfo(errorInfo),
    errorInfo,
  }
}
