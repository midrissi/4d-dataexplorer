import { getImageUri, isDeferredRelationValue } from '~/lib/fieldPaths'

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'duration'
  | 'object'
  | 'image'
  | 'null'

export type RelationSchemaAttribute = {
  name: string
  kind?: string
  behavior?: string
}

/** Detect field type from a sample value. */
export function detectFieldType(value: unknown): FieldType {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (getImageUri(value)) return 'image'
  if (typeof value === 'number') {
    // Check if it's a duration (milliseconds) - numbers that represent time
    // Durations are usually >= 1000ms (at least 1 second) and represent reasonable time ranges
    // Check if it's divisible by 1000 (whole seconds) and within a reasonable range
    // Max reasonable duration: 7 days = 604800000ms
    if (value >= 1000 && value <= 604800000 && value % 1000 === 0) {
      return 'duration'
    }
    return 'number'
  }
  if (typeof value === 'object') return 'object'
  if (typeof value === 'string') {
    // Check if it's a date string in 4D !!yyyy-mm-dd!! format
    if (/^!!\d{4}-\d{2}-\d{2}!!$/.test(value)) {
      return 'date'
    }
    // Check if it's a date string in dd!mm!yyyy format
    if (/^\d{1,2}!\d{1,2}!\d{4}$/.test(value)) {
      return 'date'
    }
    // Check if it's a date string in ISO format
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return 'date'
    }
  }
  return 'text'
}

/** Map catalog attribute type to internal field type. */
export function mapCatalogTypeToFieldType(catalogType: string, kind?: string): FieldType {
  switch (catalogType) {
    case 'bool':
      return 'boolean'
    case 'byte':
    case 'word':
    case 'long':
    case 'long64':
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'duration':
      return 'duration'
    case 'image':
      return 'image'
    case 'object':
      return 'object'
    case 'string':
    case 'uuid':
      return 'text'
    default:
      // If type is a dataclass name (relationship), it's an object
      // Check kind to determine if it's relatedEntity or relatedEntities
      if (kind === 'relatedEntity' || kind === 'relatedEntities') {
        return 'object'
      }
      // Default to text for unknown types
      return 'text'
  }
}

/**
 * Check if a column represents a relationship type (relatedEntity or relatedEntities).
 * Uses the catalog schema when available, and always also inspects the column
 * values. The value check catches alias relations (whose schema kind is `alias`
 * but whose value is a deferred relation) and related entity sets with no schema.
 */
export function isRelationshipType(
  col: string,
  schema?: RelationSchemaAttribute[],
  entities?: ReadonlyArray<Record<string, unknown>>
): boolean {
  if (schema) {
    const attr = schema.find((a) => a.name === col)
    if (
      attr &&
      (attr.kind === 'relatedEntity' ||
        attr.kind === 'relatedEntities' ||
        attr.behavior === 'relatedEntity' ||
        attr.behavior === 'relatedEntities')
    )
      return true
  }

  if (entities) {
    for (const entity of entities) {
      const value = entity[col]
      if (value === null || value === undefined) continue
      return isDeferredRelationValue(value)
    }
  }

  return false
}

/** Value formatter for object type (required by AG Grid when data type is object). */
export function objectValueFormatter(params: { value: unknown }): string {
  const value = params.value
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  try {
    const str = JSON.stringify(value)
    return str.length > 80 ? `${str.slice(0, 80)}…` : str
  } catch {
    return '[Object]'
  }
}

/** Value parser for object type (required by AG Grid when data type is object). */
export function objectValueParser(params: { newValue: string | null }): unknown {
  const str = params.newValue
  if (str === null || str === undefined || str === '') return null
  try {
    return JSON.parse(str) as unknown
  } catch {
    return null
  }
}
