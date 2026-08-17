import { describe, expect, it } from 'bun:test'
import { buildSwitcherEntries, listValueHint } from './lists-switcher-entries'

const dataclass = {
  id: '1',
  name: 'companyKeys',
  type: 'dataclass' as const,
  dataclass: 'Company',
  attribute: 'ID',
}

const hardcoded = {
  id: '2',
  name: 'statusCodes',
  type: 'hardcoded' as const,
  values: ['open', 'closed', 'pending'],
}

describe('listValueHint', () => {
  it('formats dataclass and hardcoded hints', () => {
    expect(listValueHint(dataclass)).toBe('Company.ID')
    expect(listValueHint({ ...dataclass, dataclass: '', attribute: '' })).toBeUndefined()
    expect(listValueHint(hardcoded)).toBe('open, closed, pending')
    expect(listValueHint({ ...hardcoded, values: ['a', 'b', 'c', 'd'] })).toBe('a, b, c, ...')
    expect(listValueHint({ ...hardcoded, values: [] })).toBeUndefined()
  })
})

describe('buildSwitcherEntries', () => {
  it('drops invalid names and prefers base over profile over globals', () => {
    const entries = buildSwitcherEntries({
      base: [dataclass],
      profile: [
        { ...dataclass, id: 'p', name: 'companyKeys', dataclass: 'ProfileCo', attribute: 'X' },
      ],
      globals: [
        { ...hardcoded, id: 'g', name: 'companyKeys' },
        { ...hardcoded, id: 'bad', name: '1invalid' },
        hardcoded,
      ],
    })
    expect(entries.map((e) => `${e.name}:${e.scope}:${e.valueHint}`)).toEqual([
      'companyKeys:base:Company.ID',
      'statusCodes:globals:open, closed, pending',
    ])
  })

  it('sorts by name', () => {
    const entries = buildSwitcherEntries({
      base: [],
      profile: [],
      globals: [
        { ...hardcoded, id: 'z', name: 'zeta' },
        { ...hardcoded, id: 'a', name: 'alpha' },
      ],
    })
    expect(entries.map((e) => e.name)).toEqual(['alpha', 'zeta'])
  })
})
