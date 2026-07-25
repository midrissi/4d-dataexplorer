import { describe, expect, test } from 'bun:test'
import { parseSelectAttributes, serializeSelectAttributes } from './AttributeTagsInput'

describe('select attribute tags', () => {
  test('parses comma-separated attributes', () => {
    expect(parseSelectAttributes('firstName, lastName, agency.name')).toEqual([
      'firstName',
      'lastName',
      'agency.name',
    ])
  })

  test('ignores empty segments', () => {
    expect(parseSelectAttributes(' firstName , , lastName ')).toEqual(['firstName', 'lastName'])
  })

  test('serializes tags back to a comma-separated select string', () => {
    expect(serializeSelectAttributes(['firstName', 'lastName'])).toBe('firstName, lastName')
  })
})
