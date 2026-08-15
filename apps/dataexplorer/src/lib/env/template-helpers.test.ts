import { describe, expect, it } from 'bun:test'
import {
  isHelperTemplateKey,
  isStructuredHelperKey,
  resolveHelperArgValue,
  resolveHelperTemplate,
} from './template-helpers'

describe('isHelperTemplateKey', () => {
  it('recognizes aliases and helpers paths', () => {
    expect(isHelperTemplateKey('$pick')).toBe(true)
    expect(isHelperTemplateKey('$object')).toBe(true)
    expect(isHelperTemplateKey('$vector')).toBe(true)
    expect(isHelperTemplateKey('$faker.helpers.arrayElement')).toBe(true)
    expect(isHelperTemplateKey('$faker.helpers.multiple')).toBe(true)
    expect(isHelperTemplateKey('$faker.person.firstName')).toBe(false)
    expect(isHelperTemplateKey('$timestamp')).toBe(false)
  })
})

describe('isStructuredHelperKey', () => {
  it('marks array/object helpers as structured', () => {
    expect(isStructuredHelperKey('$pick')).toBe(false)
    expect(isStructuredHelperKey('$sample')).toBe(true)
    expect(isStructuredHelperKey('$object')).toBe(true)
    expect(isStructuredHelperKey('$vector')).toBe(true)
    expect(isStructuredHelperKey('$faker.helpers.arrayElements')).toBe(true)
    expect(isStructuredHelperKey('$faker.helpers.arrayElement')).toBe(false)
  })
})

describe('resolveHelperArgValue', () => {
  it('coerces literals', () => {
    expect(resolveHelperArgValue('true')).toBe(true)
    expect(resolveHelperArgValue('false')).toBe(false)
    expect(resolveHelperArgValue('42')).toBe(42)
    expect(resolveHelperArgValue('draft')).toBe('draft')
  })

  it('resolves faker number paths as numbers', () => {
    const value = resolveHelperArgValue('$faker.number.int', { min: 5, max: 5 })
    expect(value).toBe(5)
  })
})

describe('resolveHelperTemplate', () => {
  it('picks from a list', () => {
    const result = resolveHelperTemplate('$pick', [
      { name: 'from', args: ['draft', 'published', 'archived'] },
    ])
    expect(result).not.toBeNull()
    if (!result) return
    expect(['draft', 'published', 'archived']).toContain(result.text)
    expect(result.rehydrate).toBe(false)
  })

  it('samples a unique subset', () => {
    const result = resolveHelperTemplate('$unique', [
      { name: 'from', args: ['a', 'b', 'c', 'd'] },
      { name: 'count', args: ['3'] },
    ])
    expect(result).not.toBeNull()
    expect(result?.rehydrate).toBe(true)
    expect(Array.isArray(result?.structured)).toBe(true)
    const arr = result?.structured as string[]
    expect(arr).toHaveLength(3)
    expect(new Set(arr).size).toBe(3)
    for (const item of arr) {
      expect(['a', 'b', 'c', 'd']).toContain(item)
    }
  })

  it('rejects unique count larger than from', () => {
    expect(
      resolveHelperTemplate('$unique', [
        { name: 'from', args: ['a', 'b'] },
        { name: 'count', args: ['5'] },
      ])
    ).toBeNull()
  })

  it('accepts count range between min and max', () => {
    const result = resolveHelperTemplate('$repeat', [
      { name: 'of', args: ['$faker.number.int'] },
      { name: 'count', args: ['2', '2'] },
      { name: 'min', args: ['7'] },
      { name: 'max', args: ['7'] },
    ])
    expect(result).not.toBeNull()
    expect(result?.structured).toEqual([7, 7])
  })

  it('accepts count:>=n with default upper bound', () => {
    for (let i = 0; i < 20; i++) {
      const result = resolveHelperTemplate('$repeat', [
        { name: 'of', args: ['x'] },
        { name: 'count', args: ['>=3'] },
      ])
      expect(result).not.toBeNull()
      const arr = result?.structured as unknown[]
      expect(arr.length).toBeGreaterThanOrEqual(3)
      expect(arr.length).toBeLessThanOrEqual(10)
      expect(arr.every((item) => item === 'x')).toBe(true)
    }
  })

  it('accepts count:<=n for samples', () => {
    for (let i = 0; i < 20; i++) {
      const result = resolveHelperTemplate('$sample', [
        { name: 'from', args: ['a', 'b', 'c', 'd'] },
        { name: 'count', args: ['<=2'] },
      ])
      expect(result).not.toBeNull()
      const arr = result?.structured as string[]
      expect(arr.length).toBeGreaterThanOrEqual(1)
      expect(arr.length).toBeLessThanOrEqual(2)
    }
  })

  it('clamps count range to from length', () => {
    const result = resolveHelperTemplate('$unique', [
      { name: 'from', args: ['a', 'b', 'c'] },
      { name: 'count', args: ['2', '10'] },
    ])
    expect(result).not.toBeNull()
    const arr = result?.structured as string[]
    expect(arr.length).toBeGreaterThanOrEqual(2)
    expect(arr.length).toBeLessThanOrEqual(3)
    expect(new Set(arr).size).toBe(arr.length)
  })

  it('rejects count:>n when min exceeds from length', () => {
    expect(
      resolveHelperTemplate('$sample', [
        { name: 'from', args: ['a', 'b'] },
        { name: 'count', args: ['>2'] },
      ])
    ).toBeNull()
  })

  it('resolves uniqueArray count ranges to a fixed length', () => {
    const result = resolveHelperTemplate('$faker.helpers.uniqueArray', [
      { name: 'of', args: ['$faker.string.uuid'] },
      { name: 'count', args: ['3', '3'] },
    ])
    expect(result).not.toBeNull()
    const arr = result?.structured as string[]
    expect(arr).toHaveLength(3)
    expect(new Set(arr).size).toBe(3)
  })

  it('repeats a generator path', () => {
    const result = resolveHelperTemplate('$repeat', [
      { name: 'of', args: ['$faker.number.int'] },
      { name: 'count', args: ['4'] },
      { name: 'min', args: ['1'] },
      { name: 'max', args: ['1'] },
    ])
    expect(result).not.toBeNull()
    expect(result?.structured).toEqual([1, 1, 1, 1])
    expect(result?.text).toBe('[1,1,1,1]')
  })

  it('builds an object with typed fields', () => {
    const ok = resolveHelperTemplate('$object', [
      { name: 'status', args: ['draft'] },
      { name: 'active', args: ['true'] },
      { name: 'qty', args: ['3'] },
      { name: 'age', args: ['$faker.number.int'] },
      { name: 'min', args: ['9'] },
      { name: 'max', args: ['9'] },
    ])
    expect(ok).not.toBeNull()
    expect(ok?.structured).toEqual({
      status: 'draft',
      active: true,
      qty: 3,
      age: 9,
    })
  })

  it('rejects empty object (no fields)', () => {
    expect(
      resolveHelperTemplate('$object', [
        { name: 'min', args: ['1'] },
        { name: 'max', args: ['2'] },
      ])
    ).toBeNull()
  })

  it('builds a float vector with dims', () => {
    const result = resolveHelperTemplate('$vector', [
      { name: 'dims', args: ['4'] },
      { name: 'min', args: ['0'] },
      { name: 'max', args: ['0'] },
    ])
    expect(result).not.toBeNull()
    expect(result?.rehydrate).toBe(true)
    expect(result?.structured).toEqual([0, 0, 0, 0])
  })

  it('accepts count as dims alias and normalizes', () => {
    const result = resolveHelperTemplate('$vector', [
      { name: 'count', args: ['3'] },
      { name: 'normalize', args: [] },
      { name: 'min', args: ['1'] },
      { name: 'max', args: ['1'] },
    ])
    expect(result).not.toBeNull()
    const values = result?.structured as number[]
    expect(values).toHaveLength(3)
    const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0))
    expect(norm).toBeCloseTo(1, 10)
  })

  it('rejects missing or invalid vector dims', () => {
    expect(resolveHelperTemplate('$vector', [])).toBeNull()
    expect(resolveHelperTemplate('$vector', [{ name: 'dims', args: ['0'] }])).toBeNull()
    expect(resolveHelperTemplate('$vector', [{ name: 'dims', args: ['9000'] }])).toBeNull()
  })

  it('supports weighted picks', () => {
    const result = resolveHelperTemplate('$faker.helpers.weightedArrayElement', [
      { name: 'from', args: ['only:1'] },
    ])
    expect(result).not.toBeNull()
    expect(result?.text).toBe('only')
  })

  it('supports helpers.arrayElement alias path', () => {
    const result = resolveHelperTemplate('$faker.helpers.arrayElement', [
      { name: 'from', args: ['x'] },
    ])
    expect(result?.text).toBe('x')
  })

  it('rejects missing from/of', () => {
    expect(resolveHelperTemplate('$pick', [])).toBeNull()
    expect(resolveHelperTemplate('$repeat', [{ name: 'count', args: ['2'] }])).toBeNull()
  })

  it('rejects unknown filters on non-object helpers', () => {
    expect(
      resolveHelperTemplate('$pick', [
        { name: 'from', args: ['a'] },
        { name: 'nope', args: [] },
      ])
    ).toBeNull()
  })

  it('picks from a named $lists ref', () => {
    const result = resolveHelperTemplate(
      '$pick',
      [{ name: 'from', args: ['$lists.companyKeys'] }],
      { lists: { companyKeys: ['10', '20', '30'] } }
    )
    expect(result).not.toBeNull()
    if (!result) return
    expect(['10', '20', '30']).toContain(result.text)
  })

  it('rejects missing or empty $lists refs', () => {
    expect(
      resolveHelperTemplate('$pick', [{ name: 'from', args: ['$lists.missing'] }], {
        lists: { companyKeys: ['1'] },
      })
    ).toBeNull()
    expect(
      resolveHelperTemplate('$pick', [{ name: 'from', args: ['$lists.empty'] }], {
        lists: { empty: [] },
      })
    ).toBeNull()
    expect(
      resolveHelperTemplate('$pick', [{ name: 'from', args: ['$lists.companyKeys'] }])
    ).toBeNull()
  })

  it('samples from a named $lists ref', () => {
    const result = resolveHelperTemplate(
      '$unique',
      [
        { name: 'from', args: ['$lists.roleNames'] },
        { name: 'count', args: ['2'] },
      ],
      { lists: { roleNames: ['admin', 'user', 'guest'] } }
    )
    expect(result).not.toBeNull()
    expect(Array.isArray(result?.structured)).toBe(true)
    const arr = result?.structured as string[]
    expect(arr).toHaveLength(2)
    for (const item of arr) {
      expect(['admin', 'user', 'guest']).toContain(item)
    }
  })

  it('picks from an inline Dataclass.Attribute ref pre-loaded into lists', () => {
    const result = resolveHelperTemplate('$pick', [{ name: 'from', args: ['ds.Employee.ID'] }], {
      lists: { 'ds.Employee.ID': ['1', '2', '3'] },
    })
    expect(result).not.toBeNull()
    if (!result) return
    expect(['1', '2', '3']).toContain(result.text)
  })

  it('ignores inline-ref directives (top / entityset) during resolution', () => {
    const result = resolveHelperTemplate(
      '$pick',
      [
        { name: 'from', args: ['ds.Agency.name'] },
        { name: 'entityset', args: ['64D65C5DEDD64577B589C5ECD3B0D689'] },
        { name: 'top', args: ['10'] },
      ],
      { lists: { 'ds.Agency.name': ['Alpha', 'Beta', 'Gamma'] } }
    )
    expect(result).not.toBeNull()
    if (!result) return
    expect(['Alpha', 'Beta', 'Gamma']).toContain(result.text)
  })

  it('rejects inline ref when not pre-loaded', () => {
    expect(resolveHelperTemplate('$pick', [{ name: 'from', args: ['ds.Employee.ID'] }])).toBeNull()
    expect(
      resolveHelperTemplate('$pick', [{ name: 'from', args: ['ds.Employee.ID'] }], { lists: {} })
    ).toBeNull()
  })
})
