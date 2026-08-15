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
  it('replaces unfinished prefix with {{key}} and leaves cursor before }}', () => {
    expect(applyEnvTemplateCompletion('before {{tim', 12, 'timestamp')).toEqual({
      value: 'before {{timestamp}}',
      cursor: 18,
    })
  })

  it('consumes an existing closing brace pair', () => {
    expect(applyEnvTemplateCompletion('{{tim}}', 5, 'timestamp')).toEqual({
      value: '{{timestamp}}',
      cursor: 11,
    })
  })

  it('completes a filter after |', () => {
    expect(applyEnvTemplateCompletion('{{$faker.person.firstName|lowe', 30, 'lower')).toEqual({
      value: '{{$faker.person.firstName|lower}}',
      cursor: 31,
    })
  })

  it('completes a later filter in a chain', () => {
    expect(applyEnvTemplateCompletion('{{name|female|up', 16, 'upper')).toEqual({
      value: '{{name|female|upper}}',
      cursor: 19,
    })
  })

  it('completes a $lists arg after | from:', () => {
    expect(applyEnvTemplateCompletion('{{$pick|from:$list.', 19, '$lists.empIds')).toEqual({
      value: '{{$pick|from:$lists.empIds}}',
      cursor: 26,
    })
  })

  it('completes a $lists arg with spaces after | from:', () => {
    expect(applyEnvTemplateCompletion('{{$pick | from:$lists.', 22, '$lists.companyKeys')).toEqual({
      value: '{{$pick | from:$lists.companyKeys}}',
      cursor: 33,
    })
  })
})

describe('filterEnvTemplateSuggestions', () => {
  const items = [
    { key: 'baseUrl', group: 'environment' },
    { key: 'lastname', group: 'environment' },
    { key: 'user_lastname', group: 'environment' },
    { key: '$faker.person.lastName', group: 'dynamic' },
    { key: '$timestamp', group: 'dynamic' },
    { key: '$isoTimestamp', group: 'dynamic' },
    { key: '$lists.empIds', group: 'context', detail: '1000 values' },
    { key: '$lists.companyKeys', group: 'context', detail: 'Pick list' },
  ]

  it('filters by prefix first, then substring contains', () => {
    expect(filterEnvTemplateSuggestions(items, '$iso').map((i) => i.key)).toEqual(['$isoTimestamp'])
    expect(filterEnvTemplateSuggestions(items, 'lastname').map((i) => i.key)).toEqual([
      'lastname',
      'user_lastname',
      '$faker.person.lastName',
    ])
    expect(filterEnvTemplateSuggestions(items, '').map((i) => i.key)).toEqual([
      'baseUrl',
      'lastname',
      'user_lastname',
      '$faker.person.lastName',
      '$timestamp',
      '$isoTimestamp',
      '$lists.empIds',
      '$lists.companyKeys',
    ])
  })

  it('suggests filters after |', () => {
    expect(
      filterEnvTemplateSuggestions(items, '$faker.person.firstName|lowe').map((i) => i.key)
    ).toEqual(['lower'])
    expect(filterEnvTemplateSuggestions(items, 'name|').map((i) => i.key)).toContain('upper')
    expect(filterEnvTemplateSuggestions(items, 'name|').map((i) => i.key)).toContain('female')
  })

  it('hides filter suggestions while typing non-list args', () => {
    expect(filterEnvTemplateSuggestions(items, '$faker.number.int|between:1')).toEqual([])
  })

  it('suggests $lists names while typing | from:$lists…', () => {
    expect(filterEnvTemplateSuggestions(items, '$pick|from:').map((i) => i.key)).toEqual([
      '$lists.empIds',
      '$lists.companyKeys',
    ])
    expect(filterEnvTemplateSuggestions(items, '$pick|from:$list.').map((i) => i.key)).toEqual([
      '$lists.empIds',
      '$lists.companyKeys',
    ])
    expect(
      filterEnvTemplateSuggestions(items, '$pick | from:$lists.emp').map((i) => i.key)
    ).toEqual(['$lists.empIds'])
  })

  it('does not suggest $lists for literal from: values', () => {
    expect(filterEnvTemplateSuggestions(items, '$pick|from:a,b')).toEqual([])
  })
})
