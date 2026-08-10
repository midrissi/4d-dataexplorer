import { describe, expect, it } from 'bun:test'
import {
  applyEnvTemplateCompletion,
  filterEnvTemplateSuggestions,
  getEnvTemplateMatch,
} from './env-template-autocomplete'

describe('getEnvTemplateMatch', () => {
  it('detects unfinished {{ at cursor', () => {
    expect(getEnvTemplateMatch('hello {{', 8)).toEqual({
      braceStart: 6,
      prefix: '',
      cursor: 8,
    })
    expect(getEnvTemplateMatch('{{key', 5)).toEqual({
      braceStart: 0,
      prefix: 'key',
      cursor: 5,
    })
    expect(getEnvTemplateMatch('{{$tim', 6)?.prefix).toBe('$tim')
  })

  it('returns null when not inside a template', () => {
    expect(getEnvTemplateMatch('plain', 3)).toBeNull()
    expect(getEnvTemplateMatch('{{done}} more', 13)).toBeNull()
    expect(getEnvTemplateMatch('{{done}}', 8)).toBeNull()
  })

  it('matches after a completed template when a new {{ is started', () => {
    const text = '{{key}}test{{'
    expect(getEnvTemplateMatch(text, text.length)?.prefix).toBe('')
    expect(getEnvTemplateMatch(text, text.length)?.braceStart).toBe(11)
  })
})

describe('applyEnvTemplateCompletion', () => {
  it('replaces unfinished prefix with {{key}}', () => {
    expect(applyEnvTemplateCompletion('before {{tim', 12, 'timestamp')).toEqual({
      value: 'before {{timestamp}}',
      cursor: 20,
    })
  })

  it('consumes an existing closing brace pair', () => {
    expect(applyEnvTemplateCompletion('{{tim}}', 5, 'timestamp')).toEqual({
      value: '{{timestamp}}',
      cursor: 13,
    })
  })

  it('completes a filter after |', () => {
    expect(applyEnvTemplateCompletion('{{$randomFirstName|lowe', 23, 'lower')).toEqual({
      value: '{{$randomFirstName|lower}}',
      cursor: 26,
    })
  })

  it('completes a later filter in a chain', () => {
    expect(applyEnvTemplateCompletion('{{name|female|up', 16, 'upper')).toEqual({
      value: '{{name|female|upper}}',
      cursor: 21,
    })
  })
})

describe('filterEnvTemplateSuggestions', () => {
  const items = [
    { key: 'baseUrl', group: 'environment' },
    { key: 'lastname', group: 'environment' },
    { key: 'user_lastname', group: 'environment' },
    { key: '$randomLastName', group: 'dynamic' },
    { key: '$timestamp', group: 'dynamic' },
    { key: '$isoTimestamp', group: 'dynamic' },
  ]

  it('filters by prefix first, then substring contains', () => {
    expect(filterEnvTemplateSuggestions(items, '$iso').map((i) => i.key)).toEqual(['$isoTimestamp'])
    expect(filterEnvTemplateSuggestions(items, 'lastname').map((i) => i.key)).toEqual([
      'lastname',
      'user_lastname',
      '$randomLastName',
    ])
    expect(filterEnvTemplateSuggestions(items, '').map((i) => i.key)).toEqual([
      'baseUrl',
      'lastname',
      'user_lastname',
      '$randomLastName',
      '$timestamp',
      '$isoTimestamp',
    ])
  })

  it('suggests filters after |', () => {
    expect(filterEnvTemplateSuggestions(items, '$randomFirstName|lowe').map((i) => i.key)).toEqual([
      'lower',
    ])
    expect(filterEnvTemplateSuggestions(items, 'name|').map((i) => i.key)).toContain('upper')
    expect(filterEnvTemplateSuggestions(items, 'name|').map((i) => i.key)).toContain('female')
  })

  it('hides filter suggestions while typing args', () => {
    expect(filterEnvTemplateSuggestions(items, '$randomInt|between:1')).toEqual([])
  })
})
