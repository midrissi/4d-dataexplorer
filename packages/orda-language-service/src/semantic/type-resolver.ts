import type { AttributeType } from '@4d/rest'
import { getAttribute, getDataClass, getRelatedDataclassName } from '../schema/catalog-index.ts'
import type { AttributeNode, AttributePlaceholderNode } from '../types/ast.ts'
import type { CatalogIndex, ResolvedAttribute } from '../types/service.ts'

/**
 * Resolve an `AttributeNode` (multi-segment) to its final `DataClassAttribute`
 * using the catalog index. Returns `null` if any segment is unresolvable.
 */
export function resolveAttributeNode(
  node: AttributeNode,
  dataclassName: string,
  index: CatalogIndex
): ResolvedAttribute | null {
  if (node.segments.length === 0) return null

  let currentDcName = dataclassName
  let depth = 0

  for (let i = 0; i < node.segments.length; i++) {
    const seg = node.segments[i]
    const attr = getAttribute(currentDcName, seg.name, index)
    if (!attr) return null

    if (i < node.segments.length - 1) {
      const related = getRelatedDataclassName(currentDcName, seg.name, index)
      if (!related) return null
      const relatedDc = getDataClass(related, index)
      if (!relatedDc) return null
      currentDcName = relatedDc.name
      depth++
    } else {
      const dc = getDataClass(currentDcName, index)
      if (!dc) return null
      return { attribute: attr, dataclass: dc, depth }
    }
  }

  return null
}

/**
 * Map a 4D attribute type to a simplified category for comparison compatibility.
 */
export type AttributeCategory =
  | 'string'
  | 'number'
  | 'bool'
  | 'date'
  | 'object'
  | 'image'
  | 'blob'
  | 'other'

export function categoriseType(type: AttributeType): AttributeCategory {
  switch (type) {
    case 'string':
    case 'uuid':
      return 'string'
    case 'long':
    case 'long64':
    case 'number':
    case 'word':
    case 'byte':
    case 'duration':
      return 'number'
    case 'bool':
      return 'bool'
    case 'date':
      return 'date'
    case 'object':
      return 'object'
    case 'image':
      return 'image'
    case 'blob':
      return 'blob'
    default:
      return 'other'
  }
}

export function isAttributePlaceholder(
  node: AttributeNode | AttributePlaceholderNode
): node is AttributePlaceholderNode {
  return node.kind === 'AttributePlaceholder'
}
