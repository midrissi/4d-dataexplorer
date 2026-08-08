import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { normalizeFavouriteTags } from './favourite-meta'

export type UsedTag = {
  /** Display label (first-seen casing). */
  label: string
  count: number
  lastUsedAt: number
}

type UsedTagsState = {
  tags: UsedTag[]
  /** Record tags as used (bumps count / recency). */
  registerTags: (tags: readonly string[]) => void
  /** Labels sorted by recency then frequency. */
  allLabels: () => string[]
  /** Autocomplete candidates for a query, excluding already-selected labels. */
  suggest: (query: string, exclude?: readonly string[]) => string[]
}

const MAX_USED_TAGS = 200

function sortUsedTags(tags: UsedTag[]): UsedTag[] {
  return [...tags].sort((a, b) => {
    if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label)
  })
}

export function filterTagSuggestions(
  catalog: readonly UsedTag[],
  query: string,
  exclude: readonly string[] = []
): string[] {
  const excluded = new Set(exclude.map((tag) => tag.toLowerCase()))
  const q = query.trim().toLowerCase()
  const ranked = sortUsedTags(
    catalog.filter((item) => {
      if (excluded.has(item.label.toLowerCase())) return false
      if (!q) return true
      return item.label.toLowerCase().includes(q)
    })
  )
  return ranked.map((item) => item.label)
}

export const useUsedTagsStore = create<UsedTagsState>()(
  persist(
    (set, get) => ({
      tags: [],
      registerTags: (rawTags) => {
        const incoming = normalizeFavouriteTags(rawTags)
        if (incoming.length === 0) return
        const now = Date.now()
        set((state) => {
          const byKey = new Map(state.tags.map((tag) => [tag.label.toLowerCase(), tag]))
          for (const label of incoming) {
            const key = label.toLowerCase()
            const existing = byKey.get(key)
            if (existing) {
              byKey.set(key, {
                ...existing,
                count: existing.count + 1,
                lastUsedAt: now,
              })
            } else {
              byKey.set(key, { label, count: 1, lastUsedAt: now })
            }
          }
          return {
            tags: sortUsedTags([...byKey.values()]).slice(0, MAX_USED_TAGS),
          }
        })
      },
      allLabels: () => sortUsedTags(get().tags).map((tag) => tag.label),
      suggest: (query, exclude = []) => filterTagSuggestions(get().tags, query, exclude),
    }),
    { name: 'dataexplorer-used-tags-v1' }
  )
)
