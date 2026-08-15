import type { CopyableBodyKind, CopyableHttpRequest } from './types'

const SKIP_HEADER_NAMES = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'accept-encoding',
])

export type SnippetHeader = { name: string; value: string }

/** Headers that belong in generated snippets (skip hop-by-hop / computed). */
export function headersForSnippet(request: CopyableHttpRequest): SnippetHeader[] {
  const result: SnippetHeader[] = []
  for (const [name, value] of Object.entries(request.headers)) {
    const lower = name.toLowerCase()
    if (SKIP_HEADER_NAMES.has(lower)) continue
    if (lower === 'cookie' && value.trim() === '') continue
    if (request.bodyKind === 'multipart' && lower === 'content-type') continue
    result.push({ name, value })
  }
  return result
}

export function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

export function looksLikeJson(body: string, contentType: string | undefined): boolean {
  if (contentType?.toLowerCase().includes('json')) return true
  const trimmed = body.trim()
  if (!trimmed) return false
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export function inferBodyKind(
  body: string | null,
  headers: Record<string, string>,
  fallback: CopyableBodyKind = 'none'
): CopyableBodyKind {
  if (body == null || body === '') return 'none'
  const contentType = headerValue(headers, 'content-type')?.toLowerCase() ?? ''
  if (contentType.includes('multipart/form-data')) return 'multipart'
  if (contentType.includes('application/x-www-form-urlencoded')) return 'urlencoded'
  if (contentType.includes('octet-stream') || contentType.startsWith('image/')) return 'binary'
  if (looksLikeJson(body, contentType)) return 'json'
  if (fallback !== 'none') return fallback
  return 'text'
}
