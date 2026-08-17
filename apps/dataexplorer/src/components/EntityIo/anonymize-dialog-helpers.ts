import type { TextPreviewMode } from '~/components/HttpClient/TextPreviewPanel'
import { api } from '~/lib/api'
import type { EntityIoFormatId } from '~/lib/entity-io'

/** Keep one in-flight sample fetch per selection (covers Strict Mode remount). */
const anonymizeSampleInflight = new Map<string, Promise<Record<string, unknown>[]>>()

export function fetchAnonymizeSampleRows(
  dataclassName: string,
  entitySetId: string
): Promise<Record<string, unknown>[]> {
  const key = `${dataclassName}\0${entitySetId}`
  const existing = anonymizeSampleInflight.get(key)
  if (existing) return existing
  const promise = api
    .getEntities(dataclassName, { entitySetId, top: 5, page: 1 })
    .then((page) => page.entities as Record<string, unknown>[])
    .finally(() => {
      if (anonymizeSampleInflight.get(key) === promise) {
        anonymizeSampleInflight.delete(key)
      }
    })
  anonymizeSampleInflight.set(key, promise)
  return promise
}

/** Keep the previous object identity when no new list values arrived. */
export function mergeReadyLists(
  prev: Record<string, readonly string[]>,
  next: Record<string, readonly string[]>
): Record<string, readonly string[]> {
  for (const [name, values] of Object.entries(next)) {
    if (prev[name] !== values) return { ...prev, ...next }
  }
  return prev
}

export function parseAnonymizeSeed(seed: string): number | undefined {
  const seedNum = seed.trim() ? Number(seed) : undefined
  return Number.isFinite(seedNum) ? seedNum : undefined
}

export function isAnonymizeAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export function previewModeForFormat(formatId: EntityIoFormatId): TextPreviewMode {
  switch (formatId) {
    case 'json':
    case 'json-rest':
      return 'json'
    case 'csv':
    case 'tsv':
      return 'csv'
    case 'html':
      return 'html'
    case 'markdown':
      return 'markdown'
    default:
      return 'code'
  }
}
