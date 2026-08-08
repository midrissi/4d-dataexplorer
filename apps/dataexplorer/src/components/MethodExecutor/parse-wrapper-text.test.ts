import { describe, expect, it } from 'bun:test'
import { parseWrapperText } from './parse-wrapper-text'

describe('parseWrapperText', () => {
  it('returns undefined for empty input', () => {
    expect(parseWrapperText()).toBeUndefined()
    expect(parseWrapperText('')).toBeUndefined()
    expect(parseWrapperText('   ')).toBeUndefined()
  })

  it('parses a plain object wrapper', () => {
    expect(parseWrapperText('{"foo":"test"}')).toEqual({ foo: 'test' })
  })

  it('rejects arrays and scalars', () => {
    expect(() => parseWrapperText('[]')).toThrow('INVALID_WRAPPER_OBJECT')
    expect(() => parseWrapperText('"x"')).toThrow('INVALID_WRAPPER_OBJECT')
    expect(() => parseWrapperText('null')).toThrow('INVALID_WRAPPER_OBJECT')
  })

  it('rejects invalid JSON', () => {
    expect(() => parseWrapperText('{')).toThrow('INVALID_WRAPPER_JSON')
  })
})
