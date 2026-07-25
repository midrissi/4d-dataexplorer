import { describe, expect, test } from 'bun:test'
import {
  parseQueryArgs,
  resolveCreateMode,
  resolveDeleteMode,
  resolveUpdateMode,
} from './datastore-write-args'

describe('datastore write tool arg routing', () => {
  test('resolveCreateMode prefers entities array for bulk create', () => {
    const entities = [{ firstname: 'Alice' }, { firstname: 'Bob' }]
    expect(resolveCreateMode({ dataClass: 'User', entities })).toEqual({
      mode: 'many',
      entities,
    })
  })

  test('resolveCreateMode uses data for single create', () => {
    const data = { firstname: 'Alice' }
    expect(resolveCreateMode({ dataClass: 'User', data })).toEqual({
      mode: 'single',
      data,
    })
  })

  test('resolveCreateMode errors when neither data nor entities provided', () => {
    expect(resolveCreateMode({ dataClass: 'User' })).toEqual({
      error: 'Provide data (one entity) or entities (array of records)',
    })
  })

  test('parseQueryArgs maps dataclassName to dataClass', () => {
    expect(parseQueryArgs({ dataclassName: 'User', limit: 5 }).dataClass).toBe('User')
  })

  test('parseQueryArgs maps expand and select arrays', () => {
    expect(
      parseQueryArgs({
        dataClass: 'Employee',
        select: ['firstname', 'employer.name'],
        expand: ['employer'],
      })
    ).toMatchObject({
      dataClass: 'Employee',
      select: ['firstname', 'employer.name'],
      expand: ['employer'],
    })
  })

  test('parseQueryArgs prefers attributes over select for $attributes', () => {
    expect(
      parseQueryArgs({
        dataClass: 'Car',
        attributes: ['model', 'model.model'],
        select: ['ignored'],
      })
    ).toMatchObject({
      dataClass: 'Car',
      select: ['model', 'model.model'],
    })
  })

  test('parseQueryArgs preserves nested arrays for ORDA in placeholders as json', () => {
    expect(
      parseQueryArgs({
        dataClass: 'Color',
        filter: 'ID in :1',
        filterParams: [[9, 13, 4, 7]],
      })
    ).toMatchObject({
      filterParams: [{ type: 'json', value: '[9,13,4,7]' }],
    })
  })

  test('resolveUpdateMode prefers entities array for bulk update', () => {
    const entities = [{ __KEY: '1', __STAMP: 2, status: 'done' }]
    expect(resolveUpdateMode({ dataClass: 'Order', entities })).toEqual({
      mode: 'many',
      entities,
    })
  })

  test('resolveUpdateMode uses key+data for single update', () => {
    const data = { status: 'done' }
    expect(resolveUpdateMode({ dataClass: 'Order', key: '42', data })).toEqual({
      mode: 'single',
      key: '42',
      data,
    })
  })

  test('resolveDeleteMode uses key for single delete', () => {
    expect(resolveDeleteMode({ dataClass: 'User', key: '7' })).toEqual({
      mode: 'single',
      key: '7',
    })
  })

  test('resolveDeleteMode uses filter for bulk delete', () => {
    const result = resolveDeleteMode({
      dataClass: 'User',
      filter: 'active = false',
      filterParams: [false],
    })
    expect(result).toMatchObject({
      mode: 'many',
      dataClass: 'User',
      parsed: {
        dataClass: 'User',
        filter: 'active = false',
      },
    })
  })
})
