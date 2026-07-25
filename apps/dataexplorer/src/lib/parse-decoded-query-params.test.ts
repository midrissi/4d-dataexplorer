import { describe, expect, test } from 'bun:test'
import { parseDecodedQueryParams } from './parse-decoded-query-params'

describe('parseDecodedQueryParams', () => {
  test('decodes encoded 4D REST query params', () => {
    const url =
      'http://localhost:7080/rest/Car?%24params=%5B%22A%40%22%5D&%24skip=0&%24top=100&$filter=%22registration%20%3D%20:1%22'

    expect(parseDecodedQueryParams(url)).toEqual({
      $params: ['A@'],
      $skip: 0,
      $top: 100,
      $filter: 'registration = :1',
    })
  })

  test('returns null when there is no query string', () => {
    expect(parseDecodedQueryParams('http://localhost:7080/rest/Car')).toBeNull()
  })

  test('handles relative URLs', () => {
    expect(parseDecodedQueryParams('/rest/User?$top=10&active=true')).toEqual({
      $top: 10,
      active: true,
    })
  })
})
