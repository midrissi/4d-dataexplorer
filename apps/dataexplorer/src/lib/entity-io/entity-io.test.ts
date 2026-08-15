import { describe, expect, it } from 'bun:test'
import {
  anonymizeEntities,
  buildAnonymizeFieldPlan,
  buildDefaultAnonymizePlan,
  detectEntityIoFormat,
  getEntityIoFormat,
  listAnonymizeMappableAttributes,
  prepareAnonymizedUpdate,
  stripForCreate,
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
  const agencyAttrs = [
    { name: 'ID', type: 'long', kind: 'storage' as const, autosequence: true },
    { name: 'firstName', type: 'string', kind: 'storage' as const },
    { name: 'email', type: 'string', kind: 'storage' as const },
    { name: 'notes', type: 'string', kind: 'storage' as const, readOnly: true },
  ]

  it('lists mappable attributes and builds single-field plans', () => {
    const mappable = listAnonymizeMappableAttributes(agencyAttrs, 'ID')
    expect(mappable.map((a) => a.name)).toEqual(['firstName', 'email'])
    const first = mappable[0]
    expect(first).toBeDefined()
    if (!first) return
    const plan = buildAnonymizeFieldPlan(first)
    expect(plan.name).toBe('firstName')
    expect(plan.mode).toBe('faker')
  })

  it('skips primary key and replaces mapped fields', () => {
    const plan = buildDefaultAnonymizePlan(agencyAttrs, 'ID')
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

  it('supports Faker filters and fixed values', () => {
    const [entity] = anonymizeEntities([{ age: 42, status: 'private' }], {
      plan: [
        {
          name: 'age',
          mode: 'faker',
          fakerKey: '{{$faker.number.int | between:7,7}}',
        },
        { name: 'status', mode: 'fixed', fixedValue: 'anonymous' },
      ],
    })

    expect(entity?.age).toBe(7)
    expect(entity?.status).toBe('anonymous')
  })

  it('resolves $this from the source value when anonymizing the same field', () => {
    const [entity] = anonymizeEntities([{ passwordHash: 'secret' }], {
      plan: [
        {
          name: 'passwordHash',
          mode: 'faker',
          fakerKey: '{{$this.passwordHash | hash:md5}}',
        },
      ],
    })

    expect(entity?.passwordHash).toBe('5ebe2294ecd0e0f08eab7690d2a6ee69')
  })

  it('resolves $this from values generated earlier in the plan', () => {
    const [entity] = anonymizeEntities([{ firstName: 'Secret', email: 'private@example.com' }], {
      plan: [
        { name: 'firstName', mode: 'fixed', fixedValue: 'Anonymous' },
        {
          name: 'email',
          mode: 'faker',
          fakerKey: '{{$this.firstName | lower}}',
        },
      ],
    })

    expect(entity?.firstName).toBe('Anonymous')
    expect(entity?.email).toBe('anonymous')
  })

  it('picks FK and attribute values from prepared $lists', () => {
    const [entity] = anonymizeEntities([{ comp_id: 1, role: 'secret' }], {
      plan: [
        {
          name: 'comp_id',
          type: 'long',
          mode: 'faker',
          fakerKey: '{{$pick | from:$lists.companyKeys}}',
        },
        {
          name: 'role',
          mode: 'faker',
          fakerKey: '{{$pick | from:$lists.roleNames}}',
        },
      ],
      lists: {
        companyKeys: ['100'],
        roleNames: ['admin'],
      },
    })

    expect(entity?.comp_id).toBe(100)
    expect(entity?.role).toBe('admin')
  })

  it('nulls fields when $lists is missing', () => {
    const [entity] = anonymizeEntities([{ comp_id: 1 }], {
      plan: [
        {
          name: 'comp_id',
          mode: 'faker',
          fakerKey: '{{$pick | from:$lists.companyKeys}}',
        },
      ],
    })

    expect(entity?.comp_id).toBeNull()
  })

  it('prepares in-place updates with lock keys and changed fields only', () => {
    const update = prepareAnonymizedUpdate(
      {
        __KEY: '1',
        __STAMP: 3,
        name: 'Anonymous',
        status: 'private',
        relation: { __deferred: true },
      },
      [
        { name: 'name', mode: 'fixed', fixedValue: 'Anonymous' },
        { name: 'status', mode: 'keep' },
      ]
    )

    expect(update).toEqual({
      __KEY: '1',
      __STAMP: 3,
      name: 'Anonymous',
    })
  })

  it('omits removed fields from create/download payloads', () => {
    const row = {
      __KEY: '1',
      name: 'Anonymous',
      address: 'secret street',
      status: 'private',
    }
    expect(
      stripForCreate(row, undefined, [
        { name: 'name', mode: 'fixed', fixedValue: 'Anonymous' },
        { name: 'status', mode: 'keep' },
      ])
    ).toEqual({
      name: 'Anonymous',
      status: 'private',
    })
  })
})
