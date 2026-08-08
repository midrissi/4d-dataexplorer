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
  /** Drop a custom tag from autocomplete history (presets are unaffected). */
  forgetTag: (tag: string) => void
  /** Labels sorted by recency then frequency. */
  allLabels: () => string[]
  /** Autocomplete candidates for a query, excluding already-selected labels. */
  suggest: (query: string, exclude?: readonly string[]) => string[]
}

const MAX_USED_TAGS = 200

/**
 * Starter tags for favourites — shown by default when the field is empty.
 * Oriented around ORDA / REST / webform work without being noisy.
 */
export const PREDEFINED_FAVOURITE_TAGS = [
  'auth',
  'demo',
  'hotfix',
  'local',
  'nightly',
  'orda',
  'prod',
  'regression',
  'rest',
  'seed',
  'smoke',
  'staging',
  'webform',
  'wip',
] as const

const PREDEFINED_TAG_KEYS = new Set(PREDEFINED_FAVOURITE_TAGS.map((tag) => tag.toLowerCase()))

export function isPredefinedFavouriteTag(tag: string): boolean {
  return PREDEFINED_TAG_KEYS.has(tag.trim().toLowerCase())
}

/** Chip tone for favourites UI — presets vs user history. */
export function favouriteTagChipTone(tag: string): 'preset' | 'custom' {
  return isPredefinedFavouriteTag(tag) ? 'preset' : 'custom'
}
function sortUsedTags(tags: UsedTag[]): UsedTag[] {
  return [...tags].sort((a, b) => {
    if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label)
  })
}

function matchesQuery(label: string, query: string): boolean {
  if (!query) return true
  return label.toLowerCase().includes(query)
}

export function filterTagSuggestions(
  catalog: readonly UsedTag[],
  query: string,
  exclude: readonly string[] = [],
  predefined: readonly string[] = PREDEFINED_FAVOURITE_TAGS
): string[] {
  const excluded = new Set(exclude.map((tag) => tag.toLowerCase()))
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []

  const push = (label: string) => {
    const key = label.toLowerCase()
    if (excluded.has(key) || seen.has(key)) return
    if (!matchesQuery(label, q)) return
    seen.add(key)
    out.push(label)
  }

  for (const label of predefined) push(label)
  for (const item of catalog) push(item.label)

  return [...out].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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
      forgetTag: (tag) => {
        const key = tag.trim().toLowerCase()
        if (!key || isPredefinedFavouriteTag(key)) return
        set((state) => ({
          tags: state.tags.filter((item) => item.label.toLowerCase() !== key),
        }))
      },
      allLabels: () => sortUsedTags(get().tags).map((tag) => tag.label),
      suggest: (query, exclude = []) =>
        filterTagSuggestions(get().tags, query, exclude, PREDEFINED_FAVOURITE_TAGS),
    }),
    { name: 'dataexplorer-used-tags-v1' }
  )
)
