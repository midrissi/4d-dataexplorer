import { describe, expect, it } from 'bun:test'
import {
  isAnonymizeAbortError,
  mergeReadyLists,
  parseAnonymizeSeed,
  previewModeForFormat,
} from './anonymize-dialog-helpers'

describe('mergeReadyLists', () => {
  it('returns the previous object when every next list is the same reference', () => {
    const values = ['a', 'b']
    const prev = { status: values }
    expect(mergeReadyLists(prev, { status: values })).toBe(prev)
  })

  it('merges when any list identity changed', () => {
    const prev = { status: ['a'] }
    const next = { status: ['a', 'b'] }
    expect(mergeReadyLists(prev, next)).toEqual({ status: ['a', 'b'] })
    expect(mergeReadyLists(prev, next)).not.toBe(prev)
  })

  it('returns prev when next is empty', () => {
    const prev = { status: ['a'] }
    expect(mergeReadyLists(prev, {})).toBe(prev)
  })
})

describe('parseAnonymizeSeed', () => {
  it('parses finite numbers and ignores blank or NaN', () => {
    expect(parseAnonymizeSeed('42')).toBe(42)
    expect(parseAnonymizeSeed(' 7 ')).toBe(7)
    expect(parseAnonymizeSeed('')).toBeUndefined()
    expect(parseAnonymizeSeed('   ')).toBeUndefined()
    expect(parseAnonymizeSeed('nope')).toBeUndefined()
  })
})

describe('isAnonymizeAbortError', () => {
  it('detects AbortError from DOMException and Error', () => {
    expect(isAnonymizeAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true)
    expect(isAnonymizeAbortError(new Error('AbortError'))).toBe(false)
    const err = new Error('cancelled')
    err.name = 'AbortError'
    expect(isAnonymizeAbortError(err)).toBe(true)
    expect(isAnonymizeAbortError(new Error('boom'))).toBe(false)
    expect(isAnonymizeAbortError('AbortError')).toBe(false)
  })
})

describe('previewModeForFormat', () => {
  it('maps export formats to highlighter modes', () => {
    expect(previewModeForFormat('json')).toBe('json')
    expect(previewModeForFormat('json-rest')).toBe('json')
    expect(previewModeForFormat('csv')).toBe('csv')
    expect(previewModeForFormat('tsv')).toBe('csv')
    expect(previewModeForFormat('html')).toBe('html')
    expect(previewModeForFormat('markdown')).toBe('markdown')
    expect(previewModeForFormat('xml')).toBe('code')
    expect(previewModeForFormat('sql')).toBe('code')
  })
})
