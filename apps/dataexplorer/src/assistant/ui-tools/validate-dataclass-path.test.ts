import { describe, expect, test } from 'bun:test'
import type { CatalogAllResponse } from '@4d/rest'
import { validateDataclassPath } from './validate-dataclass-path'

const catalog = {
  dataClasses: [
    {
      name: 'Car',
      collectionName: 'Cars',
      dataURI: '/rest/Car',
      attributes: [
        { name: 'model', kind: 'storage', type: 'string' },
        { name: 'agency', kind: 'relatedEntity', type: 'Agency' },
        { name: 'ID_agency', kind: 'storage', type: 'long' },
      ],
    },
    {
      name: 'Agency',
      collectionName: 'Agencies',
      dataURI: '/rest/Agency',
      attributes: [
        { name: 'city', kind: 'storage', type: 'string' },
        { name: 'manager', kind: 'relatedEntity', type: 'Employee' },
      ],
    },
    {
      name: 'Employee',
      collectionName: 'Employees',
      dataURI: '/rest/Employee',
      attributes: [
        { name: 'firstname', kind: 'storage', type: 'string' },
        { name: 'lastname', kind: 'storage', type: 'string' },
        { name: 'employer', kind: 'relatedEntity', type: 'Agency' },
      ],
    },
  ],
} as CatalogAllResponse

describe('validateDataclassPath', () => {
  test('accepts a nested relation path ending on storage', () => {
    const result = validateDataclassPath(catalog, 'Car', 'agency.manager.firstname')
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.resolved.map((r) => r.segment)).toEqual(['agency', 'manager', 'firstname'])
    expect(result.resolved[result.resolved.length - 1]?.dataClass).toBe('Employee')
  })

  test('rejects a missing leaf attribute with AI-usable error', () => {
    const result = validateDataclassPath(catalog, 'Car', 'agency.manager.name')
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.error).toContain('agency.manager.name is not valid')
    expect(result.error).toContain('no name attribute on agency.manager')
    expect(result.error).toContain('Available:')
    expect(result.error).toContain('firstname')
  })

  test('rejects a missing first segment', () => {
    const result = validateDataclassPath(catalog, 'Car', 'dealer.name')
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.error).toContain('no dealer attribute on Car')
  })

  test('rejects continuing through a non-relation', () => {
    const result = validateDataclassPath(catalog, 'Car', 'model.length')
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.error).toContain('is not a relation')
  })

  test('accepts relation wildcard', () => {
    const result = validateDataclassPath(catalog, 'Car', 'agency.manager.*')
    expect(result.valid).toBe(true)
  })

  test('rejects unknown dataclass', () => {
    const result = validateDataclassPath(catalog, 'Boat', 'agency')
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.error).toContain('Boat')
    expect(result.error).toContain('not found')
  })
})
