import {
  buildHttpRequest,
  createEmptyHttpDraft,
  type HttpClientRequestDraft,
} from '~/lib/http-client'
import { methodSeedToHttpSeed } from '~/lib/method-seed-to-http-seed'
import type { NetworkDetails } from '~/store/console'
import type { HttpFormDataField } from '~/store/http-client-types'
import type { MethodExecutorSeed } from '~/store/method-executor-types'
import { inferBodyKind } from './headers'
import type { CopyableFormField, CopyableHttpRequest } from './types'

function stringifyBody(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isPlaceholderBody(body: string): {
  kind: CopyableHttpRequest['bodyKind']
  text: string | null
} {
  if (body === '[multipart form data]') return { kind: 'multipart', text: null }
  if (body.startsWith('[') && body.endsWith(' body]')) return { kind: 'binary', text: null }
  return { kind: 'text', text: body.replace(/\n… \[truncated]$/, '') }
}

export function copyableFromNetworkDetails(details: NetworkDetails): CopyableHttpRequest {
  const rawBody = stringifyBody(details.requestBody)
  let body = rawBody
  let bodyKind = inferBodyKind(rawBody, details.requestHeaders)
  if (typeof details.requestBody === 'string') {
    const placeholder = isPlaceholderBody(details.requestBody)
    if (placeholder.kind !== 'text') {
      bodyKind = placeholder.kind
      body = placeholder.text
    } else {
      body = placeholder.text
      bodyKind = inferBodyKind(body, details.requestHeaders)
    }
  } else if (details.requestBody !== undefined && details.requestBody !== null) {
    bodyKind = 'json'
  }

  return {
    method: (details.method || 'GET').toUpperCase(),
    url: details.url,
    headers: { ...details.requestHeaders },
    body,
    bodyKind,
  }
}

function formFieldsFromDraft(fields: HttpFormDataField[]): CopyableFormField[] {
  const result: CopyableFormField[] = []
  for (const field of fields) {
    if (!field.enabled || !field.key.trim()) continue
    if (field.kind === 'file') {
      result.push({ key: field.key, value: '', fileName: field.fileName || 'file' })
    } else {
      result.push({ key: field.key, value: field.value })
    }
  }
  return result
}

export function copyableFromHttpDraft(draft: HttpClientRequestDraft): CopyableHttpRequest {
  const built = buildHttpRequest(draft)
  const methodAllowsBody = built.method !== 'GET' && built.method !== 'HEAD'
  const mode = draft.body.mode
  let body: string | null = null
  let bodyKind: CopyableHttpRequest['bodyKind'] = 'none'
  let formFields: CopyableFormField[] | undefined

  if (methodAllowsBody && mode === 'form-data') {
    formFields = formFieldsFromDraft(draft.body.formData)
    bodyKind = 'multipart'
  } else if (methodAllowsBody && mode === 'urlencoded') {
    bodyKind = 'urlencoded'
    body = typeof built.body === 'string' ? built.body : null
  } else if (methodAllowsBody && mode === 'raw') {
    body = draft.body.raw
    bodyKind = inferBodyKind(body, built.headers, 'text')
  } else if (methodAllowsBody && mode === 'binary') {
    bodyKind = 'binary'
    body = draft.body.binaryFileName ? `@${draft.body.binaryFileName}` : null
  }

  return {
    method: built.method,
    url: built.url,
    headers: built.headers,
    body,
    bodyKind,
    formFields,
  }
}

export function copyableFromMethodSeed(
  seed: MethodExecutorSeed,
  origin: string
): CopyableHttpRequest {
  const draft = createEmptyHttpDraft({
    ...methodSeedToHttpSeed(seed),
    targetMode: 'custom',
    customOrigin: origin.replace(/\/$/, ''),
  })
  return copyableFromHttpDraft(draft)
}
