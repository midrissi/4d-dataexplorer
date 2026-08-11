import { describe, expect, it } from 'bun:test'
import type { EnvTemplateSuggestion } from '@4d/ui'
import {
  buildFieldTemplateSuggestions,
  mergeFieldTemplateSuggestions,
  normalizeFieldKey,
  proposeFieldTemplateKeys,
  tokenizeFieldName,
} from './suggest-field-templates'

describe('normalizeFieldKey / tokenizeFieldName', () => {
  it('normalizes separators and case', () => {
    expect(normalizeFieldKey('first_name')).toBe('firstname')
    expect(normalizeFieldKey('FirstName')).toBe('firstname')
    expect(tokenizeFieldName('firstName')).toEqual(['first', 'name'])
    expect(tokenizeFieldName('email_address')).toEqual(['email', 'address'])
  })
})

describe('proposeFieldTemplateKeys', () => {
  it('maps firstname to faker person.firstName', () => {
    expect(proposeFieldTemplateKeys({ name: 'firstname' })).toContain('$faker.person.firstName')
    expect(proposeFieldTemplateKeys({ name: 'first_name' })).toContain('$faker.person.firstName')
  })

  it('tolerates near-miss typos like firsname', () => {
    expect(proposeFieldTemplateKeys({ name: 'firsname' })).toContain('$faker.person.firstName')
  })

  it('adds type defaults for numbers and dates', () => {
    expect(proposeFieldTemplateKeys({ name: 'amount', type: 'int' })).toContain('$faker.number.int')
    expect(proposeFieldTemplateKeys({ name: 'created', type: 'date' })).toContain('$isoTimestamp')
  })

  it('does not propose $this.<same field>', () => {
    const keys = proposeFieldTemplateKeys({ name: 'email' })
    expect(keys.some((k) => k.toLowerCase() === '$this.email')).toBe(false)
  })
})

describe('buildFieldTemplateSuggestions / merge', () => {
  const catalog: EnvTemplateSuggestion[] = [
    { key: 'variable', detail: 'value', group: 'environment' },
    { key: '$this', detail: '…', group: 'context' },
    { key: '$this.firstname', detail: '…', group: 'context' },
    { key: '$faker.person.firstName', detail: 'Faker person.firstName', group: 'dynamic' },
    { key: '$pick', detail: 'Random item', group: 'dynamic' },
  ]

  it('builds a field group and merges to the front', () => {
    const fieldItems = buildFieldTemplateSuggestions({ name: 'firstname' }, catalog)
    expect(fieldItems[0]?.key).toBe('$faker.person.firstName')
    expect(fieldItems[0]?.group).toBe('field')

    const merged = mergeFieldTemplateSuggestions(catalog, { name: 'firstname' })
    expect(merged[0]?.group).toBe('field')
    expect(merged.filter((i) => i.key === '$faker.person.firstName')).toHaveLength(1)
  })
})
