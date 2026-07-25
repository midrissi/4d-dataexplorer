import { describe, expect, it } from 'bun:test'
import { serializeRuntimeParams } from './serialize-params'

describe('serializeRuntimeParams', () => {
  it('serializes custom, entity, and entity-selection arguments in order', () => {
    expect(
      serializeRuntimeParams([
        { id: '1', kind: 'custom', value: '{"enabled":true}' },
        { id: '2', kind: 'entity', dataClass: 'City', key: '42' },
        { id: '3', kind: 'entitysel', dataClass: 'Student', entitySetId: 'SET-ID' },
      ])
    ).toEqual([
      { enabled: true },
      { __DATACLASS: 'City', __ENTITY: true, __KEY: '42' },
      { __ENTITIES: true, __DATASET: 'SET-ID' },
    ])
  })

  it('serializes typed scalar arguments including 4D dates', () => {
    expect(
      serializeRuntimeParams([
        { id: '1', kind: 'string', value: 'Hello' },
        { id: '2', kind: 'number', value: '42.5' },
        { id: '3', kind: 'boolean', value: true },
        { id: '4', kind: 'date', value: '2013-11-20' },
      ])
    ).toEqual(['Hello', 42.5, true, '!!2013-11-20!!'])
  })

  it('rejects invalid custom JSON', () => {
    expect(() =>
      serializeRuntimeParams([{ id: '1', kind: 'custom', name: '$value', value: '{' }])
    ).toThrow('$value: value must be valid JSON')
  })

  it('rejects incomplete scalar values', () => {
    expect(() =>
      serializeRuntimeParams([{ id: '1', kind: 'number', name: '$n', value: '' }])
    ).toThrow('$n: number is required')
    expect(() =>
      serializeRuntimeParams([{ id: '1', kind: 'date', name: '$d', value: '' }])
    ).toThrow('$d: date is required')
    expect(() =>
      serializeRuntimeParams([{ id: '1', kind: 'date', name: '$d', value: '20-11-2013' }])
    ).toThrow('$d: date must be YYYY-MM-DD')
  })

  it('requires entity references to be complete', () => {
    expect(() =>
      serializeRuntimeParams([{ id: '1', kind: 'entity', dataClass: 'City', key: '' }])
    ).toThrow('dataclass and entity key are required')
    expect(() =>
      serializeRuntimeParams([{ id: '1', kind: 'entitysel', dataClass: 'City', entitySetId: '' }])
    ).toThrow('entity set ID is required')
  })
})
