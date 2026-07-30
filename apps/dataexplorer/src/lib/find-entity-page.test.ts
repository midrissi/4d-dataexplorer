import { describe, expect, it } from 'bun:test'
import {
  buildBeforeKeyFilter,
  canLocateEntityPageByKey,
  coerceEntityKeyParam,
  nextFilterParamIndex,
  pageFromBeforeCount,
} from './find-entity-page'

describe('find-entity-page helpers', () => {
  it('canLocateEntityPageByKey allows default and key sorts only', () => {
    expect(canLocateEntityPageByKey('')).toBe(true)
    expect(canLocateEntityPageByKey(undefined)).toBe(true)
    expect(canLocateEntityPageByKey('ID')).toBe(true)
    expect(canLocateEntityPageByKey('__KEY')).toBe(true)
    expect(canLocateEntityPageByKey('ID_car', 'ID_car')).toBe(true)
    expect(canLocateEntityPageByKey('name')).toBe(false)
  })

  it('coerceEntityKeyParam parses numeric keys', () => {
    expect(coerceEntityKeyParam('400')).toBe(400)
    expect(coerceEntityKeyParam('abc')).toBe('abc')
  })

  it('nextFilterParamIndex continues after existing placeholders', () => {
    expect(nextFilterParamIndex('')).toBe(1)
    expect(nextFilterParamIndex('ID > :1')).toBe(2)
    expect(nextFilterParamIndex('a = :1 AND b = :3')).toBe(4)
  })

  it('buildBeforeKeyFilter uses the catalog primary key attribute', () => {
    expect(buildBeforeKeyFilter({ entityKey: '400', keyAttribute: 'ID' })).toEqual({
      filter: 'ID < :1',
      params: [400],
    })
  })

  it('buildBeforeKeyFilter uses descending comparison when ordered by key desc', () => {
    expect(
      buildBeforeKeyFilter({ entityKey: '400', keyAttribute: 'ID', sort: 'ID', order: 'desc' })
    ).toEqual({
      filter: 'ID > :1',
      params: [400],
    })
  })

  it('buildBeforeKeyFilter combines with an existing filter', () => {
    expect(
      buildBeforeKeyFilter({
        entityKey: '12',
        keyAttribute: 'ID',
        filter: 'status = :1',
        filterParams: ['open'],
      })
    ).toEqual({
      filter: '(status = :1) AND ID < :2',
      params: ['open', 12],
    })
  })

  it('buildBeforeKeyFilter returns null for custom sorts or missing key', () => {
    expect(buildBeforeKeyFilter({ entityKey: '1', keyAttribute: 'ID', sort: 'name' })).toBeNull()
    expect(buildBeforeKeyFilter({ entityKey: '1', keyAttribute: '' })).toBeNull()
  })

  it('pageFromBeforeCount maps counts to 1-based pages', () => {
    expect(pageFromBeforeCount(0, 50)).toBe(1)
    expect(pageFromBeforeCount(49, 50)).toBe(1)
    expect(pageFromBeforeCount(50, 50)).toBe(2)
    expect(pageFromBeforeCount(399, 50)).toBe(8)
  })
})
