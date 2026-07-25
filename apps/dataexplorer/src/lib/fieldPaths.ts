import { getBaseUrl } from '~/lib/platform'

// Helpers for working with (possibly dotted) attribute paths such as
// "name", "company.name", or "manager.manager.fullName". These paths let the
// field selector drill into related entities and display nested attribute
// values in the table and card views.

/** A value that is still an unexpanded 4D deferred relation (not inlined). */
export const DEFERRED_RELATION_MARKER = Symbol('deferredRelation')

/** True when the value is an unexpanded 4D deferred relation object. */
function isDeferredRelation(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__deferred' in value &&
    typeof (value as { __deferred?: unknown }).__deferred === 'object'
  )
}

/**
 * True when a value is an unexpanded deferred relation (relatedEntity or
 * relatedEntities). Image attributes also use `__deferred` but carry an `image`
 * flag, so they are excluded here.
 */
export function isDeferredRelationValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('__deferred' in value)) return false
  const deferred = (value as { __deferred?: { uri?: unknown; image?: unknown } }).__deferred
  if (typeof deferred !== 'object' || deferred === null || !('uri' in deferred)) return false
  return !deferred.image
}

/**
 * Return the absolute URL of a 4D deferred image value (a picture attribute),
 * or null when the value is not a deferred image.
 *
 * Relative REST paths (e.g. `/rest/Color(1)/photo?…`) are resolved against
 * {@link getBaseUrl} so they work in desktop mode, where there is no Vite
 * `/rest` proxy and a bare path would hit the Tauri origin instead.
 */
export function getImageUri(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('__deferred' in value)) return null
  const deferred = (value as { __deferred?: { uri?: unknown; image?: unknown } }).__deferred
  if (typeof deferred !== 'object' || deferred === null) return null
  if (!(deferred.image && typeof deferred.uri === 'string')) return null
  const uri = deferred.uri
  if (/^https?:\/\//i.test(uri)) return uri
  return `${getBaseUrl()}${uri.startsWith('/') ? '' : '/'}${uri}`
}

/**
 * Split a dotted attribute path into its segments. Returns a single-element
 * array for a plain attribute name.
 */
export function splitPath(path: string): string[] {
  return path.split('.').filter(Boolean)
}

/** The display label for a path is its last segment (e.g. "company.name" → "name"). */
export function pathLeaf(path: string): string {
  const segments = splitPath(path)
  return segments[segments.length - 1] ?? path
}

/**
 * Resolve a (possibly dotted) attribute path against an entity, walking nested
 * related-entity objects. Returns:
 * - the leaf value when the full path resolves,
 * - `DEFERRED_RELATION_MARKER` when an intermediate relation was not expanded,
 * - `undefined` when any segment is missing.
 */
export function getByPath(
  entity: Record<string, unknown> | null | undefined,
  path: string
): unknown {
  if (!entity) return undefined
  const segments = splitPath(path)
  let current: unknown = entity
  for (let i = 0; i < segments.length; i++) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    // An intermediate (non-leaf) segment that is still a deferred relation
    // means the related entity was not inlined by the server.
    if (i > 0 && isDeferredRelation(current)) return DEFERRED_RELATION_MARKER
    current = (current as Record<string, unknown>)[segments[i]]
  }
  return current
}
