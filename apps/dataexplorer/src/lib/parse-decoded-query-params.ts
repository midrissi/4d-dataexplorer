/**
 * Decode a request URL's query string into a plain object for console display.
 * Values that look like JSON are parsed; others stay as strings.
 * Returns null when the URL has no query params.
 */
export function parseDecodedQueryParams(
  url: string
): Record<string, string | number | boolean | null | unknown> | null {
  let search = ''
  try {
    const parsed = new URL(url, 'http://localhost')
    search = parsed.search
  } catch {
    const qIndex = url.indexOf('?')
    if (qIndex < 0) return null
    search = url.slice(qIndex)
  }

  if (!search || search === '?') return null

  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  if (![...params.keys()].length) return null

  const result: Record<string, string | number | boolean | null | unknown> = {}
  for (const [key, rawValue] of params.entries()) {
    result[key] = coerceQueryParamValue(rawValue)
  }
  return result
}

function coerceQueryParamValue(raw: string): string | number | boolean | null | unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber)) return asNumber
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      // Keep the decoded string when JSON is invalid.
    }
  }

  return raw
}
