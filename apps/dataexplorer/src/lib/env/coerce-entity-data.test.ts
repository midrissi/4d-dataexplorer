import { describe, expect, it } from 'bun:test'
import {
  coerceEntityDataBySchema,
  isNumberAttrType,
  prepareEntityFormData,
  stringHasEnvTemplate,
  toDateOnlyString,
} from './coerce-entity-data'

describe('coerceEntityDataBySchema', () => {
  const attrs = [
    { name: 'age', type: 'number' },
    { name: 'birthdate', type: 'date' },
    { name: 'active', type: 'bool' },
    { name: 'name', type: 'string' },
  ]

  it('coerces number and date strings', () => {
    expect(
      coerceEntityDataBySchema(
        { age: '42', birthdate: '2001-05-20', name: 'Ada', active: 'true' },
        attrs
      )
    ).toEqual({ age: 42, birthdate: '2001-05-20', name: 'Ada', active: true })
  })

  it('normalizes Postman-style date strings to YYYY-MM-DD', () => {
    const result = coerceEntityDataBySchema({ birthdate: '2020-01-15T12:00:00.000Z' }, attrs)
    expect(result.birthdate).toBe('2020-01-15')
  })

  it('leaves unresolved templates alone', () => {
    expect(
      coerceEntityDataBySchema(
        { age: '{{$faker.number.int}}', birthdate: '{{$faker.date.anytime}}' },
        attrs
      )
    ).toEqual({ age: '{{$faker.number.int}}', birthdate: '{{$faker.date.anytime}}' })
  })

  it('prepareEntityFormData matches coerce for plain values', () => {
    expect(prepareEntityFormData({ age: '7' }, attrs)).toEqual({ age: 7 })
  })
})

describe('helpers', () => {
  it('detects number attr types', () => {
    expect(isNumberAttrType('long64')).toBe(true)
    expect(isNumberAttrType('number')).toBe(true)
    expect(isNumberAttrType('string')).toBe(false)
  })

  it('detects template markers', () => {
    expect(stringHasEnvTemplate('{{$faker.number.int}}')).toBe(true)
    expect(stringHasEnvTemplate('42')).toBe(false)
  })

  it('parses date-only from Date strings', () => {
    expect(toDateOnlyString('1999-12-31')).toBe('1999-12-31')
    expect(toDateOnlyString('not a date')).toBeNull()
  })
})
