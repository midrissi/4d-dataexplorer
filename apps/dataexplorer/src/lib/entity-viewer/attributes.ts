import type { DataClassAttribute } from '@4d/rest'

const INTERNAL_ATTR_PREFIX = '__'

export function isInternalAttribute(key: string): boolean {
  return key.startsWith(INTERNAL_ATTR_PREFIX)
}

export function isRelationAttribute(attr: Pick<DataClassAttribute, 'kind' | 'behavior'>): boolean {
  return (
    attr.kind === 'relatedEntity' ||
    attr.kind === 'relatedEntities' ||
    attr.behavior === 'relatedEntity' ||
    attr.behavior === 'relatedEntities'
  )
}

export function relationKindFromAttr(
  attr: Pick<DataClassAttribute, 'kind' | 'behavior'>
): 'relatedEntity' | 'relatedEntities' {
  if (attr.kind === 'relatedEntities' || attr.behavior === 'relatedEntities') {
    return 'relatedEntities'
  }
  return 'relatedEntity'
}
