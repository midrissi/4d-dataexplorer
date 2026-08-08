import { describe, expect, test } from 'bun:test'
import { getMethodParamsText, getMethodReactKey, methodScope } from './method-meta'

describe('methodScope', () => {
  test('maps entity applyTo to entity', () => {
    expect(methodScope('entity')).toBe('entity')
  })

  test('maps entitySelection variants to entitySelection', () => {
    expect(methodScope('entitySelection')).toBe('entitySelection')
    expect(methodScope('entityCollection')).toBe('entitySelection')
    expect(methodScope('dataClassSelection')).toBe('entitySelection')
  })

  test('defaults to dataclass', () => {
    expect(methodScope()).toBe('dataclass')
    expect(methodScope('dataclass')).toBe('dataclass')
    expect(methodScope('unknown')).toBe('dataclass')
  })
})

describe('getMethodParamsText', () => {
  test('returns null when paramsText is missing or blank', () => {
    expect(getMethodParamsText({})).toBeNull()
    expect(getMethodParamsText({ paramsText: '' })).toBeNull()
    expect(getMethodParamsText({ paramsText: '   ' })).toBeNull()
    expect(getMethodParamsText({ paramsText: null })).toBeNull()
  })

  test('returns trimmed paramsText when present', () => {
    expect(getMethodParamsText({ paramsText: '() : Text' })).toBe('() : Text')
    expect(getMethodParamsText({ paramsText: '  (id: Integer)  ' })).toBe('(id: Integer)')
  })
})

describe('getMethodReactKey', () => {
  test('builds a stable key from name, applyTo, params, and index', () => {
    const method = { name: 'agencyStats', applyTo: 'entity' }
    expect(getMethodReactKey(method, 0, '() : Collection')).toBe(
      'agencyStats-entity-() : Collection-0'
    )
    expect(getMethodReactKey({ name: 'listAll' }, 2, null)).toBe('listAll-none-()-2')
  })
})
