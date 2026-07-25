/**
 * Detect SQL fragments that 4D REST / ORDA filters do not support.
 * Used to reject bad LLM tool args before they hit the server.
 */
const SQL_FRAGMENT_RE =
  /\b(select|from|where|join|insert|update|delete|union|group\s+by|order\s+by|having|exists|into|values)\b/i

export function looksLikeSql(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (SQL_FRAGMENT_RE.test(trimmed)) return true
  // Parenthesized subqueries: (SELECT …) or bare SELECT …
  if (/^\(?\s*select\b/i.test(trimmed)) return true
  return false
}

export function findSqlInQueryParts(parts: {
  filter?: string | null
  filterParams?: Array<{ type?: string; value?: unknown } | unknown> | null
}): string | null {
  if (typeof parts.filter === 'string' && looksLikeSql(parts.filter)) {
    return `filter contains unsupported SQL: ${parts.filter}`
  }

  if (!Array.isArray(parts.filterParams)) return null

  for (let i = 0; i < parts.filterParams.length; i++) {
    const raw = parts.filterParams[i]
    const value =
      raw != null && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw
        ? (raw as { value: unknown }).value
        : raw
    if (typeof value === 'string' && looksLikeSql(value)) {
      return `filterParams[:${i + 1}] contains unsupported SQL: ${value}`
    }
  }

  return null
}

export const SQL_NOT_SUPPORTED_HINT =
  'SQL is not supported in 4D REST filters. Use ORDA/4D filter syntax only (e.g. "ID_color = :1"). ' +
  'For lookups (e.g. color name → id), call @datastore/query on the related dataclass first, ' +
  'read the scalar id from the result, then pass that id as a filterParam value (e.g. "12").'
