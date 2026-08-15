import { describe, expect, it } from 'bun:test'
import {
  anonymizeEntities,
  buildDefaultAnonymizePlan,
  detectEntityIoFormat,
  getEntityIoFormat,
  stripSystemFields,
} from './index'
import type { EntityIoFormat, EntityIoFormatId } from './types'

function requireFormat(id: EntityIoFormatId): EntityIoFormat {
  const format = getEntityIoFormat(id)
  expect(format).toBeDefined()
  if (!format) throw new Error(`Missing format: ${id}`)
  return format
}

describe('entity-io formats', () => {
  const rows = [
    { firstName: 'Ada', age: 36, active: true },
    { firstName: 'Grace', age: 45, active: false },
  ]
  const ctx = { dataclassName: 'Person', columns: ['firstName', 'age', 'active'] }

  it('json roundtrips', () => {
    const format = requireFormat('json')
    const text = format.serialize(rows, ctx)
    expect(format.parse?.(text, ctx)).toEqual(rows)
  })

  it('json-rest wraps __ENTITIES', () => {
    const format = requireFormat('json-rest')
    const text = format.serialize(rows, ctx)
    expect(text).toContain('"__DATACLASS": "Person"')
    expect(format.parse?.(text, ctx)).toEqual(rows)
  })

  it('jsonl roundtrips', () => {
    const format = requireFormat('jsonl')
    const text = format.serialize(rows, ctx)
    expect(format.parse?.(text, ctx)).toEqual(rows)
  })

  it('csv roundtrips', () => {
    const format = requireFormat('csv')
    const text = format.serialize(rows, ctx)
    const parsed = format.parse?.(text, ctx) ?? []
    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.firstName).toBe('Ada')
    expect(parsed[0]?.age).toBe(36)
    expect(parsed[0]?.active).toBe(true)
  })

  it('sql export and parse INSERT', () => {
    const format = requireFormat('sql')
    const text = format.serialize(rows, ctx)
    expect(text).toContain('INSERT INTO "Person"')
    const parsed = format.parse?.(text, ctx) ?? []
    expect(parsed[0]?.firstName).toBe('Ada')
    expect(parsed[1]?.age).toBe(45)
  })

  it('xml roundtrips', () => {
    const format = requireFormat('xml')
    const text = format.serialize(rows, ctx)
    expect(text).toContain('<entities dataclass="Person"')
    const parsed = format.parse?.(text, ctx) ?? []
    expect(parsed[0]?.firstName).toBe('Ada')
  })

  it('detects json-rest from content', () => {
    const text = '{"__ENTITIES":[{"a":1}],"__DATACLASS":"X"}'
    expect(detectEntityIoFormat('data.json', text)?.id).toBe('json-rest')
  })
})

describe('stripSystemFields', () => {
  it('removes __KEY by default and can keep key/stamp', () => {
    const entity = { __KEY: '1', __STAMP: 2, name: 'x', __TIMESTAMP: 't' }
    expect(stripSystemFields(entity)).toEqual({ name: 'x' })
    expect(stripSystemFields(entity, { keepKey: true, keepStamp: true })).toEqual({
      __KEY: '1',
      __STAMP: 2,
      name: 'x',
    })
  })
})

describe('anonymize', () => {
  it('skips primary key and replaces mapped fields', () => {
    const plan = buildDefaultAnonymizePlan(
      [
        { name: 'ID', type: 'long', kind: 'storage', autosequence: true },
        { name: 'firstName', type: 'string', kind: 'storage' },
        { name: 'email', type: 'string', kind: 'storage' },
      ],
      'ID'
    )
    expect(plan.find((p) => p.name === 'ID')).toBeUndefined()
    expect(plan.find((p) => p.name === 'firstName')?.mode).toBe('faker')

    const entities = anonymizeEntities([{ ID: 1, firstName: 'Secret', email: 'a@b.com' }], {
      plan,
      seed: 42,
    })
    expect(entities[0]?.ID).toBe(1)
    expect(entities[0]?.firstName).not.toBe('Secret')
    expect(entities[0]?.email).not.toBe('a@b.com')
  })
})
