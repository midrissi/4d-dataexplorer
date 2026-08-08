import { describe, expect, it } from 'bun:test'
import {
  applyFavouriteMeta,
  formatFavouriteTagsInput,
  normalizeFavouriteName,
  normalizeFavouriteTags,
  parseFavouriteTagsInput,
} from './favourite-meta'

describe('favourite-meta', () => {
  it('normalizes names', () => {
    expect(normalizeFavouriteName('  Hello  ')).toBe('Hello')
    expect(normalizeFavouriteName('   ')).toBeUndefined()
    expect(normalizeFavouriteName(null)).toBeUndefined()
  })

  it('dedupes tags case-insensitively and trims', () => {
    expect(normalizeFavouriteTags([' API ', 'api', 'Smoke', 'smoke'])).toEqual(['API', 'Smoke'])
  })

  it('parses free-text tag input', () => {
    expect(parseFavouriteTagsInput('api, smoke #prod\nnightly')).toEqual([
      'api',
      'smoke',
      'prod',
      'nightly',
    ])
  })

  it('formats tags for the input', () => {
    expect(formatFavouriteTagsInput(['api', 'smoke'])).toBe('api, smoke')
    expect(formatFavouriteTagsInput(undefined)).toBe('')
  })

  it('applies meta onto an item', () => {
    const next = applyFavouriteMeta(
      { id: '1', name: 'old', tags: ['x'] },
      { name: '  New  ', tags: ['a', 'a', ''] }
    )
    expect(next).toEqual({ id: '1', name: 'New', tags: ['a'] })
  })
})
