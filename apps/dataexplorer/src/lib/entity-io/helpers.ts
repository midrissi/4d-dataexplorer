import type { EntityIoAttribute } from './types'

const SYSTEM_KEYS = new Set([
  '__KEY',
  '__STAMP',
  '__TIMESTAMP',
  '__ENTITYSET',
  '__STATUS',
  '__ENTITIES',
  '__COUNT',
  '__FIRST',
  '__SENT',
  '__entityModel',
  'id',
])

/** True when the key is a 4D REST system field. */
export function isSystemEntityKey(key: string): boolean {
  return SYSTEM_KEYS.has(key) || key.startsWith('__')
}

/** Strip system metadata from an entity (keeps business attributes). */
export function stripSystemFields(
  entity: Record<string, unknown>,
  options?: { keepKey?: boolean; keepStamp?: boolean }
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (key === '__KEY' && options?.keepKey) {
      out[key] = value
      continue
    }
    if (key === '__STAMP' && options?.keepStamp) {
      out[key] = value
      continue
    }
    if (isSystemEntityKey(key)) continue
    out[key] = value
  }
  return out
}

/** Storage attributes suitable for export / analyze (no relations, blob, image). */
export function exportableAttributes(attrs: EntityIoAttribute[]): EntityIoAttribute[] {
  return attrs.filter((a) => {
    if (a.kind === 'relatedEntity' || a.kind === 'relatedEntities') return false
    if (a.type === 'blob' || a.type === 'image') return false
    return a.kind === 'storage' || a.kind === 'calculated' || a.kind === 'alias' || !a.kind
  })
}

/** Analyze-friendly storage attributes (exclude blob/image/relations). */
export function analyzableAttributes(attrs: EntityIoAttribute[]): EntityIoAttribute[] {
  return attrs.filter((a) => {
    if (a.kind === 'relatedEntity' || a.kind === 'relatedEntities') return false
    if (a.type === 'blob' || a.type === 'image' || a.type === 'object') return false
    if (a.kind && a.kind !== 'storage' && a.kind !== 'calculated' && a.kind !== 'alias')
      return false
    return true
  })
}

const NUMERIC_TYPES = new Set([
  'byte',
  'word',
  'long',
  'long64',
  'number',
  'real',
  'float',
  'duration',
])

export function isNumericAttributeType(type: string): boolean {
  return NUMERIC_TYPES.has(type.toLowerCase())
}

/** Flatten a cell value for tabular formats. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Project rows onto an ordered column list. */
export function projectRows(
  rows: Record<string, unknown>[],
  columns: string[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const projected: Record<string, unknown> = {}
    for (const col of columns) {
      if (col in row) projected[col] = row[col]
      else projected[col] = null
    }
    return projected
  })
}

/** Infer column names from rows (union of keys, system fields last if kept). */
export function inferColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  const cols: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      cols.push(key)
    }
  }
  return cols
}

/** Parse a scalar from CSV/TSV/YAML-ish text. */
export function coerceCellValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    if (!Number.isNaN(n)) return n
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      /* keep string */
    }
  }
  return raw
}

/** Escape XML text content. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape a SQL string literal. */
export function escapeSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** Format a JS value as a SQL literal. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'object') return escapeSqlString(JSON.stringify(value))
  return escapeSqlString(String(value))
}
