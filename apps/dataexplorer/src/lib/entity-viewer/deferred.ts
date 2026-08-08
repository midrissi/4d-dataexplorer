import { getBaseUrl } from '~/lib/platform'

/** A deferred BLOB URI includes `$binary=true` and must not be loaded as a sub-entity-set. */
export function isDeferredBlobUri(uri: string): boolean {
  return /[?&]\$binary=true(?:&|$)/.test(uri)
}

/** Detect a 4D deferred BLOB value and build its absolute download URL. */
export function getDeferredBlobUrl(value: unknown): string | null {
  if (value && typeof value === 'object' && '__deferred' in value) {
    const d = (value as { __deferred?: { uri?: string; image?: boolean } }).__deferred
    if (d?.uri && !d.image && isDeferredBlobUri(d.uri)) {
      return `${getBaseUrl()}${d.uri}`
    }
  }
  return null
}

export type DeferredRelationInfo = { uri: string; key?: string; image?: boolean }

/**
 * Detect a 4D deferred relation (related entity or related entity set).
 * Images and BLOBs are excluded — they render as pictures / downloads.
 */
export function getDeferredRelation(value: unknown): DeferredRelationInfo | null {
  if (value && typeof value === 'object' && '__deferred' in value) {
    const d = (value as { __deferred?: { uri?: string; __KEY?: string; image?: boolean } })
      .__deferred
    if (d?.uri && !d.image && !isDeferredBlobUri(d.uri)) {
      return { uri: d.uri, key: d.__KEY, image: d.image }
    }
  }
  return null
}
