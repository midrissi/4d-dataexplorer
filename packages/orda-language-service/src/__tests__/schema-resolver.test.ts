import { describe, expect, test } from 'bun:test'
import {
  buildCatalogIndex,
  getAttribute,
  getAttributes,
  getDataClass,
  getRelatedDataclassName,
} from '../schema/catalog-index.ts'
import { getReachableAttributes, resolveAttributePath } from '../schema/schema-resolver.ts'
import { testCatalog } from './fixtures.ts'

const index = buildCatalogIndex(testCatalog)

describe('buildCatalogIndex', () => {
  test('indexes dataclasses case-insensitively', () => {
    expect(getDataClass('Users', index)).toBeDefined()
    expect(getDataClass('users', index)).toBeDefined()
    expect(getDataClass('USERS', index)).toBeDefined()
  })

  test('indexes attributes case-insensitively', () => {
    expect(getAttribute('Users', 'firstName', index)).toBeDefined()
    expect(getAttribute('users', 'firstname', index)).toBeDefined()
  })

  test('records relation targets', () => {
    // Orders.user → Users
    expect(getRelatedDataclassName('Orders', 'user', index)).toBe('Users')
    // Users.orders → Orders (strips "Selection" suffix)
    expect(getRelatedDataclassName('Users', 'orders', index)).toBe('Orders')
  })

  test('returns undefined for unknown attribute', () => {
    expect(getAttribute('Users', 'nonexistent', index)).toBeUndefined()
  })

  test('returns undefined for unknown dataclass', () => {
    expect(getDataClass('Nonexistent', index)).toBeUndefined()
  })

  test('getAttributes collapses duplicate attribute names', () => {
    const dupCatalog = {
      dataClasses: [
        {
          name: 'City',
          collectionName: 'City',
          dataURI: '/rest/City',
          attributes: [
            { name: 'City', kind: 'storage' as const, type: 'string' },
            { name: 'City', kind: 'storage' as const, type: 'string' },
            { name: 'ID', kind: 'storage' as const, type: 'long' },
            { name: 'id', kind: 'storage' as const, type: 'long' },
          ],
        },
      ],
    }
    const dupIndex = buildCatalogIndex(dupCatalog)
    const attrs = getAttributes('City', dupIndex)
    expect(attrs.map((a) => a.name)).toEqual(['City', 'ID'])
  })
})

describe('resolveAttributePath', () => {
  test('resolves simple attribute', () => {
    const result = resolveAttributePath('firstName', 'Users', index)
    expect(result).not.toBeNull()
    expect(result?.attribute.name).toBe('firstName')
    expect(result?.depth).toBe(0)
  })

  test('resolves relation traversal', () => {
    const result = resolveAttributePath('user.lastName', 'Orders', index)
    expect(result).not.toBeNull()
    expect(result?.attribute.name).toBe('lastName')
    expect(result?.dataclass.name).toBe('Users')
    expect(result?.depth).toBe(1)
  })

  test('resolves with collection notation', () => {
    // Users.orders[].status  (stripping [a])
    const result = resolveAttributePath('orders[a].status', 'Users', index)
    expect(result).not.toBeNull()
    expect(result?.attribute.name).toBe('status')
    expect(result?.dataclass.name).toBe('Orders')
  })

  test('returns null for unknown path', () => {
    expect(resolveAttributePath('nonexistent', 'Users', index)).toBeNull()
  })

  test('returns null for broken traversal', () => {
    expect(resolveAttributePath('firstName.nonexistent', 'Users', index)).toBeNull()
  })

  test('returns null for empty path', () => {
    expect(resolveAttributePath('', 'Users', index)).toBeNull()
  })

  test('trims whitespace around path segments', () => {
    const result = resolveAttributePath('  user . lastName  ', 'Orders', index)
    expect(result).not.toBeNull()
    expect(result?.attribute.name).toBe('lastName')
    expect(result?.dataclass.name).toBe('Users')
  })

  test('returns null when starting dataclass is unknown', () => {
    expect(resolveAttributePath('firstName', 'MissingClass', index)).toBeNull()
  })
})

describe('getReachableAttributes', () => {
  test('returns direct attributes for depth 0', () => {
    const attrs = getReachableAttributes('Users', index, 0)
    const paths = attrs.map((a) => a.path)
    expect(paths).toContain('firstName')
    expect(paths).toContain('orders')
    expect(paths).not.toContain('orders.status')
  })

  test('follows relation attributes up to the configured depth', () => {
    const attrs = getReachableAttributes('Users', index, 1)
    const paths = attrs.map((a) => a.path)
    expect(paths).toContain('orders.status')
    expect(paths).toContain('orders.user')
  })

  test('does not recurse infinitely on circular relations', () => {
    const attrs = getReachableAttributes('Users', index, 3)
    const paths = attrs.map((a) => a.path)
    expect(paths).toContain('orders.user')
    expect(paths).not.toContain('orders.user.firstName')
    // A repeated cycle would keep expanding this forever if visited protection failed.
    expect(paths).not.toContain('orders.user.orders.user.orders')
  })

  test('returns an empty list for unknown dataclass', () => {
    expect(getReachableAttributes('MissingClass', index, 1)).toEqual([])
  })
})
