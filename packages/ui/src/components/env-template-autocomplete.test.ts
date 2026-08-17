import { describe, expect, it } from 'bun:test'
import {
  applyEnvTemplateCompletion,
  filterEnvTemplateSuggestions,
  getEnvTemplateMatch,
} from './env-template-autocomplete'
import { measurePlacement } from './use-env-template-autocomplete'

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

  it('completes an inline ds.* arg after | from:', () => {
    expect(applyEnvTemplateCompletion('{{$pick|from:ds.Emp', 19, 'ds.Employee.ID')).toEqual({
      value: '{{$pick|from:ds.Employee.ID}}',
      cursor: 27,
    })
  })

  it('completes a named $object property value', () => {
    expect(
      applyEnvTemplateCompletion('{{$object | name:$faker.person.', 32, '$faker.person.lastName')
    ).toEqual({
      value: '{{$object | name:$faker.person.lastName}}',
      cursor: 39,
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
    { key: 'ds.Employee.ID', group: 'context', detail: 'number' },
    { key: 'ds.Employee.firstName', group: 'context', detail: 'string' },
    { key: 'ds.Company.name', group: 'context', detail: 'string' },
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

  it('suggests inline ds.* refs while typing | from:ds…', () => {
    expect(filterEnvTemplateSuggestions(items, '$pick|from:ds').map((i) => i.key)).toEqual([
      'ds.Employee.ID',
      'ds.Employee.firstName',
      'ds.Company.name',
    ])
    expect(
      filterEnvTemplateSuggestions(items, '$pick | from:ds.Employee.').map((i) => i.key)
    ).toEqual(['ds.Employee.ID', 'ds.Employee.firstName'])
    expect(
      filterEnvTemplateSuggestions(items, '$pick | from:ds.Company').map((i) => i.key)
    ).toEqual(['ds.Company.name'])
  })

  it('suggests variables while typing a named $object property', () => {
    expect(
      filterEnvTemplateSuggestions(items, '$object | name:$faker.person.').map((item) => item.key)
    ).toEqual(['$faker.person.lastName'])
    expect(
      filterEnvTemplateSuggestions(items, '$object | status:base').map((item) => item.key)
    ).toEqual(['baseUrl'])
  })

  it('hides inline ds.* refs from the top-level variable list', () => {
    expect(filterEnvTemplateSuggestions(items, 'ds').map((i) => i.key)).not.toContain(
      'ds.Employee.ID'
    )
    expect(filterEnvTemplateSuggestions(items, '').map((i) => i.key)).not.toContain(
      'ds.Employee.ID'
    )
  })
})

describe('measurePlacement', () => {
  it('places the list below when there is room', () => {
    const placement = measurePlacement(
      {
        top: 40,
        bottom: 64,
        left: 10,
        right: 210,
        width: 200,
        height: 24,
        x: 10,
        y: 40,
        toJSON() {},
      },
      800
    )
    expect(placement.side).toBe('bottom')
    expect(placement.top).toBe(70)
    expect(placement.width).toBe(280)
  })

  it('places the list above when space below is tight', () => {
    const placement = measurePlacement(
      {
        top: 700,
        bottom: 740,
        left: 10,
        right: 310,
        width: 300,
        height: 40,
        x: 10,
        y: 700,
        toJSON() {},
      },
      780
    )
    expect(placement.side).toBe('top')
    expect(placement.top).toBe(694)
    expect(placement.maxHeight).toBeGreaterThan(0)
  })
})
