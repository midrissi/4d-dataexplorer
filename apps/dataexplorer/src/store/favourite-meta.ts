/** Shared favourite label / tag helpers (HTTP + Method Executor). */

export const MAX_FAVOURITE_TAGS = 12
export const MAX_FAVOURITE_NAME_LENGTH = 80

export type FavouriteMeta = {
  name?: string
  tags?: string[]
}

export function normalizeFavouriteName(name: string | undefined | null): string | undefined {
  const trimmed = (name ?? '').trim().slice(0, MAX_FAVOURITE_NAME_LENGTH)
  return trimmed || undefined
}

export function normalizeFavouriteTags(tags: readonly string[] | undefined | null): string[] {
  if (!tags?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag.slice(0, 32))
  }
  return [...out]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .slice(0, MAX_FAVOURITE_TAGS)
}

/** Parse a free-text tags field (comma / hash / newline separated). */
export function parseFavouriteTagsInput(value: string): string[] {
  return normalizeFavouriteTags(value.split(/[,#\n]+/))
}

export function formatFavouriteTagsInput(tags: readonly string[] | undefined): string {
  return tags?.length ? tags.join(', ') : ''
}

export function applyFavouriteMeta<T extends FavouriteMeta>(item: T, meta: FavouriteMeta): T {
  const name = normalizeFavouriteName(meta.name)
  const tags = normalizeFavouriteTags(meta.tags)
  return {
    ...item,
    name,
    tags: tags.length > 0 ? tags : undefined,
  }
}

/**
 * Label for a duplicated favourite: `"Name (copy)"`, then `"Name (copy 2)"`, …
 * Returns undefined when the source has no name.
 */
export function nextFavouriteCopyName(
  name: string | undefined | null,
  existingNames: readonly (string | undefined | null)[]
): string | undefined {
  const base = normalizeFavouriteName(name)
  if (!base) return undefined
  const used = new Set(
    existingNames
      .map((entry) => normalizeFavouriteName(entry)?.toLowerCase())
      .filter((entry): entry is string => Boolean(entry))
  )
  const first = `${base} (copy)`.slice(0, MAX_FAVOURITE_NAME_LENGTH)
  if (!used.has(first.toLowerCase())) return first
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (copy ${n})`
    const truncated = base.slice(0, Math.max(1, MAX_FAVOURITE_NAME_LENGTH - suffix.length))
    const candidate = `${truncated}${suffix}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return first
}

/** Deep-clone a JSON-serializable favourite payload. */
export function cloneFavouritePayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
