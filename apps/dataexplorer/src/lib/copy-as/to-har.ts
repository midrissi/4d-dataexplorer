import { headersForSnippet, headerValue } from './headers'
import type { CopyableHttpRequest } from './types'

export type HarHeader = { name: string; value: string }
export type HarParam = { name: string; value?: string; fileName?: string; contentType?: string }

export type HarRequest = {
  method: string
  url: string
  httpVersion: 'HTTP/1.1'
  cookies: []
  headers: HarHeader[]
  queryString: []
  headersSize: -1
  bodySize: -1
  postData?: {
    mimeType: string
    text?: string
    params?: HarParam[]
  }
}

function parseUrlEncoded(body: string): HarParam[] {
  const params: HarParam[] = []
  for (const part of body.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    const rawName = eq === -1 ? part : part.slice(0, eq)
    const rawValue = eq === -1 ? '' : part.slice(eq + 1)
    params.push({
      name: decodeUriComponentSafe(rawName.replace(/\+/g, ' ')),
      value: decodeUriComponentSafe(rawValue.replace(/\+/g, ' ')),
    })
  }
  return params
}

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function mimeTypeFor(request: CopyableHttpRequest): string {
  const contentType = headerValue(request.headers, 'content-type')
  if (contentType) return contentType.split(';')[0]?.trim() || contentType
  if (request.bodyKind === 'json') return 'application/json'
  if (request.bodyKind === 'urlencoded') return 'application/x-www-form-urlencoded'
  if (request.bodyKind === 'multipart') return 'multipart/form-data'
  if (request.bodyKind === 'binary') return 'application/octet-stream'
  return 'text/plain'
}

/** HAR request for snippet generation (headers already filtered). */
export function toHarRequest(request: CopyableHttpRequest): HarRequest {
  const har: HarRequest = {
    method: request.method,
    url: request.url,
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: headersForSnippet(request),
    queryString: [],
    headersSize: -1,
    bodySize: -1,
  }

  if (request.bodyKind === 'multipart' && request.formFields?.length) {
    har.postData = {
      mimeType: 'multipart/form-data',
      params: request.formFields.map((field) =>
        field.fileName
          ? {
              name: field.key,
              fileName: field.fileName,
              contentType: 'application/octet-stream',
            }
          : { name: field.key, value: field.value }
      ),
    }
    return har
  }

  if (request.bodyKind === 'urlencoded') {
    const params = request.formFields?.length
      ? request.formFields.map((field) => ({ name: field.key, value: field.value }))
      : request.body
        ? parseUrlEncoded(request.body)
        : []
    har.postData = {
      mimeType: 'application/x-www-form-urlencoded',
      params,
    }
    return har
  }

  if (request.bodyKind === 'binary') {
    har.postData = {
      mimeType: mimeTypeFor(request),
      text: request.body || '@file.bin',
    }
    return har
  }

  if (request.body) {
    har.postData = {
      mimeType: mimeTypeFor(request),
      text: request.body,
    }
  }

  return har
}
