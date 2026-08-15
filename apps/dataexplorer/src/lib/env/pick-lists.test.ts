import { describe, expect, it } from 'bun:test'
import {
  buildPickListsResolveMap,
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
      { id: 'a', name: 'companyKeys', dataclass: 'Company', attribute: 'ID' },
      expect.objectContaining({
        name: 'roleNames',
        dataclass: 'Role',
        attribute: 'name',
      }),
    ])
  })

  it('lists declared names and builds resolve maps', () => {
    expect(
      listDeclaredPickListNames([
        { id: '1', name: 'companyKeys', dataclass: 'Company', attribute: 'ID' },
        { id: '2', name: 'bad-name', dataclass: 'X', attribute: 'y' },
        { id: '3', name: 'companyKeys', dataclass: 'Company', attribute: 'ID' },
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

describe('createPickListValuesCache', () => {
  it('loads once, dedupes in-flight, and invalidates', async () => {
    const cache = createPickListValuesCache()
    let calls = 0
    const loader = async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 10))
      return { values: ['a', 'b'], truncated: false }
    }

    const [r1, r2] = await Promise.all([
      cache.ensure('base1', 'Company', 'ID', loader),
      cache.ensure('base1', 'Company', 'ID', loader),
    ])
    expect(calls).toBe(1)
    expect(r1.values).toEqual(['a', 'b'])
    expect(r2.values).toEqual(['a', 'b'])
    expect(cache.getCached('base1', 'Company', 'ID')).toEqual({
      status: 'ready',
      values: ['a', 'b'],
      truncated: false,
    })

    cache.invalidate('base1', 'Company', 'ID')
    expect(cache.getCached('base1', 'Company', 'ID')).toEqual({ status: 'idle' })

    await cache.ensure('base1', 'Company', 'ID', loader)
    expect(calls).toBe(2)

    cache.invalidateBase('base1')
    expect(cache.getCached('base1', 'Company', 'ID')).toEqual({ status: 'idle' })
  })

  it('separates bases and records errors', async () => {
    const cache = createPickListValuesCache()
    await cache.ensure('baseA', 'Company', 'ID', async () => ({
      values: ['1'],
      truncated: false,
    }))
    await expect(
      cache.ensure('baseB', 'Company', 'ID', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(cache.getCached('baseA', 'Company', 'ID').status).toBe('ready')
    expect(cache.getCached('baseB', 'Company', 'ID')).toEqual({
      status: 'error',
      message: 'boom',
    })
  })

  it('marks empty distinct results', async () => {
    const cache = createPickListValuesCache()
    await cache.ensure('base1', 'Role', 'name', async () => ({
      values: [],
      truncated: false,
    }))
    expect(cache.getCached('base1', 'Role', 'name')).toEqual({ status: 'empty' })
  })
})
