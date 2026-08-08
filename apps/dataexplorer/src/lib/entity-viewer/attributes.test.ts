import { describe, expect, it } from 'bun:test'
import { isInternalAttribute, isRelationAttribute, relationKindFromAttr } from './attributes'

describe('isInternalAttribute', () => {
  it('detects __-prefixed keys', () => {
    expect(isInternalAttribute('__KEY')).toBe(true)
    expect(isInternalAttribute('name')).toBe(false)
  })
})

describe('isRelationAttribute / relationKindFromAttr', () => {
  it('detects relatedEntity vs relatedEntities from kind or behavior', () => {
    expect(isRelationAttribute({ kind: 'relatedEntity' })).toBe(true)
    expect(isRelationAttribute({ kind: 'storage', behavior: 'relatedEntities' })).toBe(true)
    expect(isRelationAttribute({ kind: 'storage' })).toBe(false)
    expect(relationKindFromAttr({ kind: 'relatedEntities' })).toBe('relatedEntities')
    expect(relationKindFromAttr({ kind: 'relatedEntity' })).toBe('relatedEntity')
  })
})
