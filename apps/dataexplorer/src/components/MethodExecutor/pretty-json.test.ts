import { describe, expect, it } from 'bun:test'
import { prettyJson } from './pretty-json'

describe('prettyJson', () => {
  it('pretty-prints objects', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('stringifies null', () => {
    expect(prettyJson(null)).toBe('null')
  })

  it('falls back to String() when JSON.stringify returns undefined', () => {
    expect(prettyJson(undefined)).toBe('undefined')
  })
})
