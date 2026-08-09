import { describe, expect, it } from 'bun:test'
import { allEmojis, EMOJI_CATEGORIES, filterEmojis } from './emoji-data'

describe('emoji data', () => {
  it('includes a large categorized palette', () => {
    expect(EMOJI_CATEGORIES).toHaveLength(10)
    expect(EMOJI_CATEGORIES[0]?.id).toBe('professional')
    expect(allEmojis().length).toBeGreaterThan(700)
  })

  it('dedupes within each category', () => {
    for (const category of EMOJI_CATEGORIES) {
      expect(new Set(category.emojis).size).toBe(category.emojis.length)
    }
  })

  it('filters by alias and category', () => {
    const folders = filterEmojis('folder', 'objects')
    expect(folders).toContain('📁')
    expect(folders).toContain('📂')
    expect(filterEmojis('zzzzyyy')).toEqual([])
  })

  it('returns the full category when the query is empty', () => {
    const smileys = filterEmojis('', 'smileys')
    expect(smileys.length).toBeGreaterThan(50)
    expect(smileys[0]).toBe('😀')
  })

  it('includes REST/API emojis in the professional category', () => {
    const professional = filterEmojis('', 'professional')
    expect(professional).toContain('📁')
    expect(professional).toContain('🔐')
    expect(professional).toContain('🛰️')
    expect(filterEmojis('api', 'professional')).toContain('🛰️')
    expect(filterEmojis('rest', 'professional')).toContain('📁')
  })
})
