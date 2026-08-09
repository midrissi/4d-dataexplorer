import { applyParamsToPath, resolveHttpMethod } from '~/lib/http-client'
import type { HttpClientSeed, HttpFormDataField, HttpKeyValuePair } from '~/store/http-client-types'
import type { PostmanBody, PostmanFormDataField, PostmanHeader, PostmanItem } from './types'
import { buildPostmanUrl } from './url'

function enabledPairs(pairs: HttpKeyValuePair[] | undefined): HttpKeyValuePair[] {
  return (pairs ?? []).filter((pair) => pair.enabled && pair.key.trim())
}

function headersFromSeed(seed: HttpClientSeed): PostmanHeader[] {
  return enabledPairs(seed.headers).map((pair) => ({
    key: pair.key.trim(),
    value: pair.value,
    ...(pair.description ? { description: pair.description } : {}),
  }))
}

function formDataFieldToPostman(field: HttpFormDataField): PostmanFormDataField | null {
  if (!field.enabled || !field.key.trim()) return null
  if (field.kind === 'file') {
    return {
      key: field.key.trim(),
      type: 'file',
      ...(field.contentType ? { contentType: field.contentType } : {}),
      // Live File / base64 payloads are not embedded in the collection.
      src: field.fileName || undefined,
    }
  }
  return {
    key: field.key.trim(),
    value: field.value,
    type: 'text',
    ...(field.contentType ? { contentType: field.contentType } : {}),
  }
}

function bodyFromSeed(seed: HttpClientSeed, method: string): PostmanBody | undefined {
  if (method === 'GET' || method === 'HEAD') return undefined
  const mode = seed.body?.mode ?? 'none'
  if (mode === 'none') return undefined

  if (mode === 'urlencoded') {
    const urlencoded = enabledPairs(seed.body?.urlencoded).map((pair) => ({
      key: pair.key.trim(),
      value: pair.value,
    }))
    return { mode: 'urlencoded', urlencoded }
  }

  if (mode === 'form-data') {
    const formdata = (seed.body?.formData ?? [])
      .map(formDataFieldToPostman)
      .filter((field): field is PostmanFormDataField => field != null)
    return { mode: 'formdata', formdata }
  }

  if (mode === 'binary') {
    const fileName = seed.body?.binaryFileName
    const note = fileName
      ? `// Binary body "${fileName}" was not embedded. Re-attach the file in Postman.`
      : '// Binary body was not embedded. Re-attach the file in Postman.'
    return {
      mode: 'raw',
      raw: note,
      options: { raw: { language: 'text' } },
    }
  }

  // raw
  const language = seed.body?.rawLanguage ?? 'text'
  const rawLanguage =
    language === 'json' || language === 'xml' || language === 'html' || language === 'javascript'
      ? language
      : 'text'
  return {
    mode: 'raw',
    raw: seed.body?.raw ?? '',
    options: { raw: { language: rawLanguage } },
  }
}

function ensureContentTypeHeader(
  headers: PostmanHeader[],
  seed: HttpClientSeed,
  method: string
): PostmanHeader[] {
  if (method === 'GET' || method === 'HEAD') return headers
  const mode = seed.body?.mode ?? 'none'
  if (mode !== 'raw' && mode !== 'urlencoded') return headers
  const hasContentType = headers.some((h) => h.key.toLowerCase() === 'content-type')
  if (hasContentType) return headers

  if (mode === 'urlencoded') {
    return [...headers, { key: 'Content-Type', value: 'application/x-www-form-urlencoded' }]
  }

  const contentType =
    seed.body?.rawContentType?.trim() ||
    (seed.body?.rawLanguage === 'json'
      ? 'application/json'
      : seed.body?.rawLanguage === 'xml'
        ? 'application/xml'
        : seed.body?.rawLanguage === 'html'
          ? 'text/html'
          : seed.body?.rawLanguage === 'javascript'
            ? 'application/javascript'
            : '')
  if (!contentType) return headers
  return [...headers, { key: 'Content-Type', value: contentType }]
}

/** Plain-text label for a method favourite / HTTP seed (no live base URL). */
export function httpSeedExportLabel(seed: HttpClientSeed): string {
  const method = resolveHttpMethod({
    method: seed.method ?? 'GET',
    customMethod: seed.customMethod ?? '',
  })
  const path = seed.path || '/'
  return `${method} ${path}`
}

export function httpSeedToPostmanItem(
  seed: HttpClientSeed,
  options: { name: string; description?: string }
): PostmanItem & { request: NonNullable<Extract<PostmanItem, { request: unknown }>['request']> } {
  const method = resolveHttpMethod({
    method: seed.method ?? 'GET',
    customMethod: seed.customMethod ?? '',
  })
  const pathWithParams = applyParamsToPath(seed.path || '/', seed.params ?? [])
  const useBaseUrlVar = seed.targetMode !== 'custom'
  const customOrigin = (seed.customOrigin ?? '').trim().replace(/\/$/, '')

  const url = buildPostmanUrl({
    pathWithQuery: pathWithParams,
    useBaseUrlVar,
    ...(useBaseUrlVar ? {} : { origin: customOrigin || 'https://example.com' }),
  })

  let header = headersFromSeed(seed)
  header = ensureContentTypeHeader(header, seed, method)
  const body = bodyFromSeed(seed, method)

  const descriptionParts = [options.description, ...(seed.warnings ?? [])].filter(Boolean)

  return {
    name: options.name,
    ...(descriptionParts.length > 0 ? { description: descriptionParts.join('\n\n') } : {}),
    request: {
      method,
      header,
      url,
      ...(body ? { body } : {}),
    },
  }
}
