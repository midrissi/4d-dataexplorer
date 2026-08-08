import { describe, expect, it } from 'bun:test'
import { getDeferredBlobUrl, getDeferredRelation, isDeferredBlobUri } from './deferred'

describe('isDeferredBlobUri', () => {
  it('detects $binary=true query flag', () => {
    expect(isDeferredBlobUri('/rest/Doc(1)/file?$binary=true')).toBe(true)
    expect(isDeferredBlobUri('/rest/Doc(1)/file?$binary=true&$expand=1')).toBe(true)
    expect(isDeferredBlobUri('/rest/City(1)/photo?$imageformat=best')).toBe(false)
  })
})

describe('getDeferredRelation', () => {
  it('returns uri/key for a non-image deferred relation', () => {
    expect(getDeferredRelation({ __deferred: { uri: '/rest/City(1)', __KEY: '1' } })).toEqual({
      uri: '/rest/City(1)',
      key: '1',
      image: undefined,
    })
  })

  it('ignores images and blob URIs', () => {
    expect(getDeferredRelation({ __deferred: { uri: '/rest/City(1)/photo', image: true } })).toBe(
      null
    )
    expect(getDeferredRelation({ __deferred: { uri: '/rest/Doc(1)/file?$binary=true' } })).toBe(
      null
    )
  })
})

describe('getDeferredBlobUrl', () => {
  it('returns null for non-blob deferred values', () => {
    expect(getDeferredBlobUrl({ __deferred: { uri: '/rest/City(1)' } })).toBe(null)
    expect(getDeferredBlobUrl({ __deferred: { uri: '/rest/City(1)/photo', image: true } })).toBe(
      null
    )
  })
})
