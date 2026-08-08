import { beforeEach, describe, expect, it } from 'bun:test'
import { filterTagSuggestions, PREDEFINED_FAVOURITE_TAGS, useUsedTagsStore } from './used-tags'

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
      { label: 'custom', count: 1, lastUsedAt: 1 },
    ]
    expect(filterTagSuggestions(catalog, 'ap', ['api'], [])).toEqual([])
    expect(filterTagSuggestions(catalog, 'p', [], [])).toEqual(['api'])
    expect(filterTagSuggestions(catalog, '', ['smoke'], [])).toEqual(['api', 'custom'])
  })

  it('orders suggestions alphabetically', () => {
    const catalog = [{ label: 'zebra', count: 1, lastUsedAt: 1 }]
    const suggestions = filterTagSuggestions(catalog, '', [])
    expect(suggestions).toEqual(
      [...PREDEFINED_FAVOURITE_TAGS, 'zebra'].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      )
    )
  })

  it('store suggest returns presets alphabetically with an empty catalog', () => {
    const suggestions = useUsedTagsStore.getState().suggest('')
    expect(suggestions).toEqual([...PREDEFINED_FAVOURITE_TAGS])
  })

  it('forgets custom tags from autocomplete but keeps presets', () => {
    useUsedTagsStore.getState().registerTags(['mycustom', 'smoke'])
    expect(useUsedTagsStore.getState().allLabels()).toContain('mycustom')
    useUsedTagsStore.getState().forgetTag('mycustom')
    expect(useUsedTagsStore.getState().allLabels()).not.toContain('mycustom')
    // Preset labels may still be in history; forgetting a preset is a no-op.
    useUsedTagsStore.getState().forgetTag('smoke')
    expect(useUsedTagsStore.getState().suggest('')).toContain('smoke')
  })
})
