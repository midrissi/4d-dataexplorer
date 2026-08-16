import { describe, expect, it } from 'bun:test'
import {
  anonymizeEntities,
  anonymizeEntitiesWithProgress,
  buildAnonymizeFieldPlan,
  buildDefaultAnonymizePlan,
  detectEntityIoFormat,
  getEntityIoFormat,
  IMAGE_UPLOAD_CONCURRENCY,
  listAnonymizeMappableAttributes,
  parseAnonymizeFieldPlan,
  prepareAnonymizedUpdate,
  stripForCreate,
  stripSystemFields,
  uploadAnonymizedImages,
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

  it('parses valid JSON field plans and rejects malformed entries', () => {
    expect(
      parseAnonymizeFieldPlan([
        {
          name: 'firstName',
          type: 'string',
          mode: 'faker',
          fakerKey: '{{$faker.person.firstName}}',
        },
        { name: 'status', mode: 'fixed', fixedValue: 'Anonymous' },
      ])
    ).toEqual([
      { name: 'firstName', type: 'string', mode: 'faker', fakerKey: '{{$faker.person.firstName}}' },
      { name: 'status', mode: 'fixed', fixedValue: 'Anonymous' },
    ])
    expect(parseAnonymizeFieldPlan([{ name: 'status', mode: 'unknown' }])).toBeNull()
    expect(
      parseAnonymizeFieldPlan([
        { name: 'status', mode: 'keep' },
        { name: 'status', mode: 'empty' },
      ])
    ).toBeNull()
  })

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

  it('includes writable image attributes in anonymization mappings', () => {
    const mappable = listAnonymizeMappableAttributes(
      [...agencyAttrs, { name: 'portrait', type: 'image', kind: 'storage' as const }],
      'ID'
    )
    expect(mappable.map((attribute) => attribute.name)).toContain('portrait')
    const portrait = mappable.find((attribute) => attribute.name === 'portrait')
    expect(portrait).toBeDefined()
    if (!portrait) return
    expect(buildAnonymizeFieldPlan(portrait).fakerKey).toContain('$faker.image')
  })

  it('uploads generated image URLs and replaces them with 4D upload IDs', async () => {
    const uploaded: File[] = []
    const progress: Array<[number, number]> = []
    const rows = await uploadAnonymizedImages(
      [{ portrait: 'https://images.example.test/portrait.jpg' }],
      [
        {
          name: 'portrait',
          type: 'image',
          mode: 'faker',
          fakerKey: '{{$faker.image.personPortrait}}',
        },
      ],
      async (file) => {
        uploaded.push(file)
        return { ID: 'IMAGE-UPLOAD-ID' }
      },
      (current, total) => progress.push([current, total]),
      async () => new Response(new Blob(['image'], { type: 'image/jpeg' }), { status: 200 })
    )

    expect(uploaded[0]?.name).toBe('portrait.jpg')
    expect(uploaded[0]?.type).toBe('image/jpeg')
    expect(rows[0]?.portrait).toEqual({ ID: 'IMAGE-UPLOAD-ID' })
    expect(progress).toEqual([[1, 1]])
  })

  it('uploads generated images with bounded concurrency', async () => {
    let inFlight = 0
    let maxInFlight = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const rows = [
      { portrait: 'https://images.test/1.png' },
      { portrait: 'https://images.test/2.png' },
      { portrait: 'https://images.test/3.png' },
    ]
    const upload = uploadAnonymizedImages(
      rows,
      [{ name: 'portrait', type: 'image', mode: 'faker', fakerKey: '{{$faker.image.avatar}}' }],
      async (file) => ({ ID: file.name }),
      () => {},
      async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await gate
        inFlight -= 1
        return new Response(new Blob(['image'], { type: 'image/png' }), { status: 200 })
      },
      2
    )

    await Promise.resolve()
    await Promise.resolve()
    expect(maxInFlight).toBe(2)
    release?.()
    await upload
    expect(rows.every((row) => typeof row.portrait === 'object')).toBe(true)
    expect(IMAGE_UPLOAD_CONCURRENCY).toBeGreaterThan(1)
  })

  it('stops image upload work when anonymization is cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    let fetchCalls = 0
    let uploadCalls = 0

    await expect(
      uploadAnonymizedImages(
        [{ portrait: 'https://images.test/portrait.png' }],
        [{ name: 'portrait', type: 'image', mode: 'faker', fakerKey: '{{$faker.image.avatar}}' }],
        async () => {
          uploadCalls += 1
          return { ID: 'unused' }
        },
        () => {},
        async () => {
          fetchCalls += 1
          return new Response()
        },
        1,
        controller.signal
      )
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchCalls).toBe(0)
    expect(uploadCalls).toBe(0)
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

  it('reports progress while anonymizing large selections', async () => {
    const progress: Array<[number, number]> = []
    const entities = await anonymizeEntitiesWithProgress(
      [{ name: 'one' }, { name: 'two' }, { name: 'three' }],
      { plan: [{ name: 'name', mode: 'fixed', fixedValue: 'Anonymous' }] },
      (processed, total) => progress.push([processed, total]),
      2
    )

    expect(entities.map((entity) => entity.name)).toEqual(['Anonymous', 'Anonymous', 'Anonymous'])
    expect(progress).toEqual([
      [2, 3],
      [3, 3],
    ])
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
