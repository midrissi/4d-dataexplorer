import type { DataClassAttribute } from '@4d/rest'
import type { CatalogIndex, ResolvedAttribute } from '../types/service.ts'
import {
  getAttribute,
  getAttributes,
  getDataClass,
  getRelatedDataclassName,
} from './catalog-index.ts'

/**
 * Resolve a dot-separated attribute path string against a starting dataclass.
 *
 * Handles:
 *  - Simple paths: `"firstName"` → storage attribute
 *  - Relation traversal: `"employer.name"` → attribute on related class
 *  - Collection notation: `"hobbies[a].name"` → strips bracket letter, follows relation
 *
 * Returns `null` if any segment cannot be resolved.
 */
export function resolveAttributePath(
  rawPath: string,
  dataclassName: string,
  index: CatalogIndex
): ResolvedAttribute | null {
  // Strip collection letters and split into plain segments
  // e.g. "hobbies[a].name" → ["hobbies", "name"]
  const cleanPath = rawPath.replace(/\[[a-zA-Z]?\]/g, '')
  const segments = cleanPath
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)

  if (segments.length === 0) return null

  let currentDataclassName = dataclassName
  let resolvedAttr: DataClassAttribute | undefined
  let resolvedDc = getDataClass(dataclassName, index)

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const attr = getAttribute(currentDataclassName, seg, index)
    if (!attr) return null

    if (i < segments.length - 1) {
      // Must be a relation to continue traversal
      const related = getRelatedDataclassName(currentDataclassName, seg, index)
      if (!related) return null
      const relatedDc = getDataClass(related, index)
      if (!relatedDc) return null
      currentDataclassName = relatedDc.name
      resolvedDc = relatedDc
    } else {
      resolvedAttr = attr
      resolvedDc = getDataClass(currentDataclassName, index) ?? resolvedDc
    }
  }

  if (!resolvedAttr || !resolvedDc) return null

  return {
    attribute: resolvedAttr,
    dataclass: resolvedDc,
    depth: segments.length - 1,
  }
}

/**
 * Resolve all attribute paths reachable from `dataclassName` up to a given
 * traversal depth. Used by the completion service to enumerate suggestions.
 *
 * Returns an array of `{ path, attribute, dataclass }` entries.
 */
export interface ReachableAttribute {
  /** Full dot-separated path, e.g. "employer.name" */
  path: string
  attribute: DataClassAttribute
  /** Dataclass that owns this attribute */
  dataclassName: string
}

export function getReachableAttributes(
  dataclassName: string,
  index: CatalogIndex,
  maxDepth = 1
): ReachableAttribute[] {
  const result: ReachableAttribute[] = []
  _collectAttributes(dataclassName, '', 0, maxDepth, index, result, new Set())
  return result
}

function _collectAttributes(
  dataclassName: string,
  prefix: string,
  depth: number,
  maxDepth: number,
  index: CatalogIndex,
  result: ReachableAttribute[],
  visited: Set<string>
): void {
  if (visited.has(dataclassName.toLowerCase())) return
  visited.add(dataclassName.toLowerCase())

  const dc = getDataClass(dataclassName, index)
  if (!dc) return

  for (const attr of getAttributes(dataclassName, index)) {
    const path = prefix ? `${prefix}.${attr.name}` : attr.name
    result.push({ path, attribute: attr, dataclassName: dc.name })

    if (depth < maxDepth && (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities')) {
      const related = getRelatedDataclassName(dc.name, attr.name, index)
      if (related) {
        _collectAttributes(related, path, depth + 1, maxDepth, index, result, new Set(visited))
      }
    }
  }
}
