import { describe, expect, it } from 'bun:test'
import { restParamValueKind, restParamValueSuggestions } from './http-client'
import {
  parseListParamTags,
  serializeListParamTags,
} from '~/components/RequestKeyValue/ListTagsInput'

describe('restParamValueKind', () => {
  it('classifies enum, number, list, and text params', () => {
    expect(restParamValueKind('$method')).toBe('enum')
    expect(restParamValueKind('$asArray')).toBe('enum')
    expect(restParamValueKind('$top')).toBe('number')
    expect(restParamValueKind('$timeout')).toBe('number')
    expect(restParamValueKind('$attributes')).toBe('list')
    expect(restParamValueKind('$expand')).toBe('list')
    expect(restParamValueKind('$filter')).toBe('text')
    expect(restParamValueKind('custom')).toBe('text')
  })

  it('matches keys case-insensitively and without requiring exact casing', () => {
    expect(restParamValueKind('$METHOD')).toBe('enum')
    expect(restParamValueKind('top')).toBe('number')
  })
})

describe('restParamValueSuggestions', () => {
  it('returns curated values for known params', () => {
    expect(restParamValueSuggestions('$method')).toContain('entityset')
    expect(restParamValueSuggestions('$top')).toEqual(['10', '20', '50', '100'])
  })
})

describe('list param tags', () => {
  it('round-trips comma-separated attributes', () => {
    expect(parseListParamTags('a, b ,c')).toEqual(['a', 'b', 'c'])
    expect(serializeListParamTags(['FirstName', 'LastName'])).toBe('FirstName,LastName')
  })
})
