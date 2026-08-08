import { beforeEach, describe, expect, it } from 'bun:test'
import { filterTagSuggestions, useUsedTagsStore } from './used-tags'

describe('used-tags', () => {
  beforeEach(() => useUsedTagsStore.setState({ tags: [] }))

  it('registers and dedupes tags case-insensitively', () => {
    useUsedTagsStore.getState().registerTags(['API', 'smoke'])
    useUsedTagsStore.getState().registerTags(['api', 'prod'])
    const labels = useUsedTagsStore.getState().allLabels()
    expect(labels).toContain('API')
    expect(labels).toContain('smoke')
    expect(labels).toContain('prod')
    expect(labels.filter((label) => label.toLowerCase() === 'api')).toHaveLength(1)
    const api = useUsedTagsStore.getState().tags.find((tag) => tag.label === 'API')
    expect(api?.count).toBe(2)
  })

  it('suggests by includes and excludes selected', () => {
    const catalog = [
      { label: 'api', count: 3, lastUsedAt: 3 },
      { label: 'smoke', count: 2, lastUsedAt: 2 },
      { label: 'prod', count: 1, lastUsedAt: 1 },
    ]
    expect(filterTagSuggestions(catalog, 'ap', ['api'])).toEqual([])
    expect(filterTagSuggestions(catalog, 'p', [])).toEqual(['api', 'prod'])
    expect(filterTagSuggestions(catalog, '', ['smoke'])).toEqual(['api', 'prod'])
  })
})
