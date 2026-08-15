import { describe, expect, it } from 'bun:test'
import {
  buildPickListsResolveMap,
  collectInlineListRefs,
  collectPickListNamesFromPlan,
  collectReferencedPickListNames,
  createPickListValuesCache,
  isValidPickListName,
  listDeclaredPickListNames,
  normalizePickListDeclarations,
} from './pick-lists'

describe('pick-lists normalize', () => {
  it('normalizes declarations and drops invalid shapes', () => {
    expect(normalizePickListDeclarations(null)).toEqual([])
    expect(
      normalizePickListDeclarations([
        { id: 'a', name: ' companyKeys ', dataclass: 'Company', attribute: 'ID' },
        { name: 'roleNames', dataclass: 'Role', attribute: 'name' },
        'nope',
      ])
    ).toEqual([
      { id: 'a', name: 'companyKeys', type: 'dataclass', dataclass: 'Company', attribute: 'ID' },
      expect.objectContaining({
        name: 'roleNames',
        type: 'dataclass',
        dataclass: 'Role',
        attribute: 'name',
      }),
    ])
  })

  it('lists declared names and builds resolve maps', () => {
    expect(
      listDeclaredPickListNames([
        {
          id: '1',
          name: 'companyKeys',
          type: 'dataclass' as const,
          dataclass: 'Company',
          attribute: 'ID',
        },
        { id: '2', name: 'bad-name', type: 'dataclass' as const, dataclass: 'X', attribute: 'y' },
        {
          id: '3',
          name: 'companyKeys',
          type: 'dataclass' as const,
          dataclass: 'Company',
          attribute: 'ID',
        },
      ])
    ).toEqual(['companyKeys'])
    expect(isValidPickListName('empIds')).toBe(true)
    expect(isValidPickListName('1bad')).toBe(false)
    expect(
      buildPickListsResolveMap({
        companyKeys: ['1', '2'],
        empty: [],
        'bad-name': ['x'],
      })
    ).toEqual({ companyKeys: ['1', '2'] })
  })
})

describe('collectReferencedPickListNames', () => {
  it('extracts $lists refs from pick templates', () => {
    expect(collectReferencedPickListNames('{{$pick | from:$lists.companyKeys}}')).toEqual([
      'companyKeys',
    ])
    expect(
      collectPickListNamesFromPlan([
        { mode: 'faker', fakerKey: '{{$pick | from:$lists.roleNames}}' },
        { mode: 'keep' },
        { mode: 'faker', fakerKey: '{{$faker.person.firstName}}' },
      ])
    ).toEqual(['roleNames'])
  })
})

describe('collectInlineListRefs', () => {
  it('extracts ds.Dataclass.Attribute refs from templates', () => {
    const refs = collectInlineListRefs([
      '{{$pick | from:ds.Employee.ID}}',
      '{{$sample | from:ds.Product.category | count:3}}',
      '{{$pick | from:$lists.named}}', // should NOT be collected here
      'no template here',
    ])
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({ key: 'ds.Employee.ID', dataclass: 'Employee', attribute: 'ID' })
    expect(refs[1]).toMatchObject({
      key: 'ds.Product.category',
      dataclass: 'Product',
      attribute: 'category',
    })
  })

  it('extracts optional top:N and entityset:ID filters', () => {
    const refs = collectInlineListRefs([
      '{{$pick | from:ds.Employee.firstName | top:50 | entityset:12345678}}',
    ])
    expect(refs[0]).toMatchObject({
      key: 'ds.Employee.firstName',
      dataclass: 'Employee',
      attribute: 'firstName',
      top: 50,
      entitySetId: '12345678',
    })
  })

  it('falls back to a plain numeric count:N for the fetch limit', () => {
    const refs = collectInlineListRefs(['{{$pick | from:ds.Employee.ID | count:10}}'])
    expect(refs[0]).toMatchObject({ key: 'ds.Employee.ID', top: 10 })
  })

  it('prefers top:N over count:N when both are present', () => {
    const refs = collectInlineListRefs(['{{$pick | from:ds.Employee.ID | top:25 | count:10}}'])
    expect(refs[0]?.top).toBe(25)
  })

  it('ignores non-numeric count ranges for the fetch limit', () => {
    const refs = collectInlineListRefs(['{{$sample | from:ds.Employee.ID | count:2,5}}'])
    expect(refs[0]?.top).toBeUndefined()
  })

  it('deduplicates by key, first occurrence wins', () => {
    const refs = collectInlineListRefs([
      '{{$pick | from:ds.Employee.ID | top:100}}',
      '{{$pick | from:ds.Employee.ID | top:200}}',
    ])
    expect(refs).toHaveLength(1)
    expect(refs[0]?.top).toBe(100)
  })

  it('does not collect plain Dataclass.Attribute (no ds. prefix)', () => {
    const refs = collectInlineListRefs(['{{$pick | from:Employee.ID}}'])
    expect(refs).toHaveLength(0)
  })
})

describe('createPickListValuesCache', () => {
  it('loads once, dedupes in-flight, and invalidates', async () => {
    const cache = createPickListValuesCache()
    let calls = 0
    const slowLoader = async (_: { dataclass: string; attribute: string; top: number }) => {
      calls += 1
      await new Promise((r) => setTimeout(r, 10))
      return { values: ['a', 'b'], truncated: false }
    }

    const loaderParams = { dataclass: 'Company', attribute: 'ID', top: 500 }
    const [r1, r2] = await Promise.all([
      cache.ensure('base1', 'decl-1', loaderParams, slowLoader),
      cache.ensure('base1', 'decl-1', loaderParams, slowLoader),
    ])
    expect(calls).toBe(1)
    expect(r1.values).toEqual(['a', 'b'])
    expect(r2.values).toEqual(['a', 'b'])
    expect(cache.getCached('base1', 'decl-1')).toEqual({
      status: 'ready',
      values: ['a', 'b'],
      truncated: false,
    })

    cache.invalidate('base1', 'decl-1')
    expect(cache.getCached('base1', 'decl-1')).toEqual({ status: 'idle' })

    await cache.ensure('base1', 'decl-1', loaderParams, slowLoader)
    expect(calls).toBe(2)

    cache.invalidateBase('base1')
    expect(cache.getCached('base1', 'decl-1')).toEqual({ status: 'idle' })
  })

  it('separates bases and records errors', async () => {
    const cache = createPickListValuesCache()
    const loaderParams = { dataclass: 'Company', attribute: 'ID', top: 500 }
    await cache.ensure('baseA', 'decl-a', loaderParams, async () => ({
      values: ['1'],
      truncated: false,
    }))
    await expect(
      cache.ensure('baseB', 'decl-b', loaderParams, async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(cache.getCached('baseA', 'decl-a').status).toBe('ready')
    expect(cache.getCached('baseB', 'decl-b')).toEqual({
      status: 'error',
      message: 'boom',
    })
  })

  it('marks empty distinct results', async () => {
    const cache = createPickListValuesCache()
    const loaderParams = { dataclass: 'Role', attribute: 'name', top: 500 }
    await cache.ensure('base1', 'decl-role', loaderParams, async () => ({
      values: [],
      truncated: false,
    }))
    expect(cache.getCached('base1', 'decl-role')).toEqual({ status: 'empty' })
  })
})
