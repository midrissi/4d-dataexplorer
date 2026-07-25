import type { NetworkDetails } from '~/store/console'
import {
  createKeyValuePair,
  type HttpClientSeed,
  type HttpKeyValuePair,
  type HttpMethod,
  normalizeHttpBody,
} from '~/store/http-client-types'
import { paramsFromSearch, rawLanguageFromContentType, splitOriginAndPath } from './http-client'
import { getBaseUrl } from './platform'

const REDACTED = '[REDACTED]'
const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key'])

const KNOWN_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

function headersFromRecord(headers: Record<string, string>): {
  headers: HttpKeyValuePair[]
  warnings: string[]
} {
  const warnings: string[] = []
  const result: HttpKeyValuePair[] = []
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    if (SENSITIVE_HEADER_NAMES.has(lower) || value.includes(REDACTED)) {
      warnings.push(`Omitted sensitive header “${key}” from the replay draft.`)
      continue
    }
    result.push(createKeyValuePair({ key, value, enabled: true }))
  }
  return { headers: result, warnings }
}

function bodyFromNetwork(details: NetworkDetails): {
  body: HttpClientSeed['body']
  warnings: string[]
} {
  const warnings: string[] = []
  const requestBody = details.requestBody
  if (requestBody === undefined) {
    return { body: normalizeHttpBody({ mode: 'none' }), warnings }
  }

  if (typeof requestBody === 'string') {
    if (requestBody === '[multipart form data]') {
      warnings.push('Multipart body could not be reconstructed from the console log.')
      return { body: normalizeHttpBody({ mode: 'none' }), warnings }
    }
    if (requestBody.startsWith('[') && requestBody.endsWith(' body]')) {
      warnings.push('Binary body could not be reconstructed from the console log.')
      return { body: normalizeHttpBody({ mode: 'none' }), warnings }
    }
    if (requestBody.includes('\n… [truncated]')) {
      warnings.push('Request body was truncated in the console log.')
    }
    const contentType =
      details.requestHeaders['content-type'] ??
      details.requestHeaders['Content-Type'] ??
      'text/plain'
    const language = rawLanguageFromContentType(contentType)
    return {
      body: normalizeHttpBody({
        mode: 'raw',
        raw: requestBody.replace(/\n… \[truncated]$/, ''),
        rawLanguage: language,
        rawContentType: contentType,
      }),
      warnings,
    }
  }

  // Object / array bodies were JSON.
  try {
    return {
      body: normalizeHttpBody({
        mode: 'raw',
        raw: JSON.stringify(requestBody, null, 2),
        rawLanguage: 'json',
        rawContentType: 'application/json',
      }),
      warnings,
    }
  } catch {
    warnings.push('Request body could not be serialized for replay.')
    return { body: normalizeHttpBody({ mode: 'none' }), warnings }
  }
}

/**
 * Convert a captured console network entry into a safe HTTP Client seed.
 * Redacted secrets are omitted rather than silently restored.
 */
export function mapNetworkDetailsToSeed(details: NetworkDetails): HttpClientSeed {
  const warnings: string[] = []
  const methodUpper = (details.method || 'GET').toUpperCase()
  const method: HttpMethod = KNOWN_METHODS.has(methodUpper as HttpMethod)
    ? (methodUpper as HttpMethod)
    : 'CUSTOM'

  let targetMode: HttpClientSeed['targetMode'] = 'current'
  let customOrigin: string | undefined
  let path = '/'
  let params: HttpKeyValuePair[] = []

  const currentOrigin = getBaseUrl().replace(/\/$/, '')
  const split = splitOriginAndPath(details.url)
  if (split) {
    path = split.path || '/'
    try {
      const parsed = new URL(details.url)
      params = paramsFromSearch(parsed.search)
      if (parsed.origin !== new URL(currentOrigin || 'http://localhost').origin) {
        targetMode = 'custom'
        customOrigin = parsed.origin
      }
    } catch {
      // keep defaults
    }
  } else {
    path = details.url.startsWith('/') ? details.url : `/${details.url}`
    const q = path.indexOf('?')
    if (q >= 0) {
      params = paramsFromSearch(path.slice(q + 1))
      path = path.slice(0, q) || '/'
    }
  }

  const { headers, warnings: headerWarnings } = headersFromRecord(details.requestHeaders)
  warnings.push(...headerWarnings)

  const { body, warnings: bodyWarnings } = bodyFromNetwork(details)
  warnings.push(...bodyWarnings)

  return {
    method,
    customMethod: method === 'CUSTOM' ? methodUpper : undefined,
    targetMode,
    customOrigin,
    path: path.split('?')[0] || '/',
    params,
    headers,
    body,
    warnings: warnings.length > 0 ? warnings : undefined,
    label: `${methodUpper} ${path.split('?')[0] || '/'}`,
  }
}
