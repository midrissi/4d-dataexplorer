import { describe, expect, test } from 'bun:test'
import {
  listAnonymizeFakerSuggestions,
  suggestionsForAnonymizeField,
} from './anonymize-faker-suggestions'

describe('anonymize faker suggestions', () => {
  test('lists $faker paths grouped by module', () => {
    const catalog = listAnonymizeFakerSuggestions()
    expect(catalog.length).toBeGreaterThan(50)
    expect(
      catalog.some((item) => typeof item !== 'string' && item.value === '$faker.number.int')
    ).toBe(true)
    expect(
      catalog.some(
        (item) =>
          typeof item !== 'string' && item.group === 'person' && item.value.includes('firstName')
      )
    ).toBe(true)
  })

  test('prefers field-name matches at the top', () => {
    const catalog = listAnonymizeFakerSuggestions()
    const forEmail = suggestionsForAnonymizeField('email', catalog)
    expect(forEmail[0]).toEqual({ value: '$faker.internet.email', group: 'field' })
  })
})
