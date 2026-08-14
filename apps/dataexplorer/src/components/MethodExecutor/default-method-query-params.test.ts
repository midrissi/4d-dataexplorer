import { describe, expect, it } from 'bun:test'
import { createKeyValuePair } from '~/store/http-client-types'
import {
  createDefaultMethodQueryParams,
  hasExtraMethodQueryParams,
  resolveMethodQueryParams,
} from './default-method-query-params'

describe('createDefaultMethodQueryParams', () => {
  it('seeds $method=entityset enabled', () => {
    const params = createDefaultMethodQueryParams()
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({
      key: '$method',
      value: 'entityset',
      enabled: true,
    })
  })
})

describe('resolveMethodQueryParams', () => {
  it('falls back to defaults when undefined', () => {
    expect(resolveMethodQueryParams()).toEqual(createDefaultMethodQueryParams())
  })

  it('keeps an explicit empty list', () => {
    expect(resolveMethodQueryParams([])).toEqual([])
  })

  it('keeps provided pairs', () => {
    const pairs = [createKeyValuePair({ key: '$top', value: '10' })]
    expect(resolveMethodQueryParams(pairs)).toBe(pairs)
  })
})

describe('hasExtraMethodQueryParams', () => {
  it('is false for missing, empty, or only the default row', () => {
    expect(hasExtraMethodQueryParams()).toBe(false)
    expect(hasExtraMethodQueryParams([])).toBe(false)
    expect(hasExtraMethodQueryParams(createDefaultMethodQueryParams())).toBe(false)
  })

  it('is true when the default is disabled or changed', () => {
    expect(
      hasExtraMethodQueryParams([
        createKeyValuePair({ key: '$method', value: 'entityset', enabled: false }),
      ])
    ).toBe(true)
    expect(
      hasExtraMethodQueryParams([
        createKeyValuePair({ key: '$method', value: 'release', enabled: true }),
      ])
    ).toBe(true)
  })

  it('is true when additional params are present', () => {
    expect(
      hasExtraMethodQueryParams([
        ...createDefaultMethodQueryParams(),
        createKeyValuePair({ key: '$top', value: '5' }),
      ])
    ).toBe(true)
  })
})
