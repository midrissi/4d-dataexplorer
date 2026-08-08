import { isDeferredRelationValue } from '~/lib/fieldPaths'

function isSelectionColumn(entities: Record<string, unknown>[], column: string): boolean {
  for (const entity of entities) {
    const value = entity[column]
    if (value === null || value === undefined) continue
    return isDeferredRelationValue(value)
  }
  return false
}

/** Scalar preview columns for an entity-selection table (excludes `__*` and relations). */
export function previewSelectionColumns(entities: Record<string, unknown>[], limit = 5): string[] {
  const keys = new Set<string>()
  for (const entity of entities) {
    for (const key of Object.keys(entity)) {
      if (!key.startsWith('__')) keys.add(key)
    }
  }
  return Array.from(keys)
    .filter((key) => !isSelectionColumn(entities, key))
    .slice(0, limit)
}
