import type { CatalogAllResponse, DataClass, DataClassAttribute } from '@4d/rest'
import type { CatalogIndex } from '../types/service.ts'

/**
 * Build an O(1) lookup index from the full catalog response.
 *
 * All map keys are lower-cased for case-insensitive resolution.
 */
export function buildCatalogIndex(catalog: CatalogAllResponse): CatalogIndex {
  const dataclasses = new Map<string, DataClass>()
  const attributes = new Map<string, DataClassAttribute>()
  const relations = new Map<string, string>()

  for (const dc of catalog.dataClasses) {
    const dcKey = dc.name.toLowerCase()
    dataclasses.set(dcKey, dc)

    for (const attr of dc.attributes) {
      const attrKey = `${dcKey}.${attr.name.toLowerCase()}`
      attributes.set(attrKey, attr)

      // Record relation targets for traversal
      if (attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities') {
        // The `type` field holds the related dataclass name (possibly with "Selection" suffix)
        const relatedName =
          attr.kind === 'relatedEntities' && attr.type.endsWith('Selection')
            ? attr.type.slice(0, -'Selection'.length)
            : attr.type
        relations.set(attrKey, relatedName)
      }
    }
  }

  return { dataclasses, attributes, relations }
}

/**
 * Look up a DataClass by name (case-insensitive).
 */
export function getDataClass(name: string, index: CatalogIndex): DataClass | undefined {
  return index.dataclasses.get(name.toLowerCase())
}

/**
 * Look up an attribute by dataclass name + attribute name (both case-insensitive).
 */
export function getAttribute(
  dataclassName: string,
  attrName: string,
  index: CatalogIndex
): DataClassAttribute | undefined {
  return index.attributes.get(`${dataclassName.toLowerCase()}.${attrName.toLowerCase()}`)
}

/**
 * Get all attributes of a dataclass, or an empty array if not found.
 * Duplicate names (case-insensitive) are collapsed to the first occurrence —
 * some 4D catalog payloads list the same attribute more than once.
 */
export function getAttributes(dataclassName: string, index: CatalogIndex): DataClassAttribute[] {
  const dc = getDataClass(dataclassName, index)
  if (!dc) return []

  const seen = new Set<string>()
  const unique: DataClassAttribute[] = []
  for (const attr of dc.attributes) {
    const key = attr.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(attr)
  }
  return unique
}

/**
 * Follow a relation attribute to get the related dataclass name.
 * Returns undefined if the attribute is not a relation or the dataclass is unknown.
 */
export function getRelatedDataclassName(
  dataclassName: string,
  attrName: string,
  index: CatalogIndex
): string | undefined {
  return index.relations.get(`${dataclassName.toLowerCase()}.${attrName.toLowerCase()}`)
}
