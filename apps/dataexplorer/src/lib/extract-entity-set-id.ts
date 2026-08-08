/**
 * `__ENTITYSET` can be a bare id or a REST path like
 * `/rest/City/$entityset/ABC?x=1`. Return just the trailing id.
 */
export function extractEntitySetId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const withoutQuery = value.trim().split(/[?#]/)[0]
  const marker = '/$entityset/'
  const markerIndex = withoutQuery.lastIndexOf(marker)
  if (markerIndex >= 0) {
    const id = withoutQuery.slice(markerIndex + marker.length).split('/')[0]
    return id || undefined
  }
  const segments = withoutQuery.split('/').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : withoutQuery
}
