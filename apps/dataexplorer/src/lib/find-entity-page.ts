import { api, client } from '~/lib/api'

export type FindEntityPageOptions = {
  dataclassName: string
  entityKey: string
  pageSize: number
  /** Primary-key attribute name from the catalog (e.g. "ID"). Required for $filter. */
  keyAttribute: string
  filter?: string
  filterParams?: unknown[]
  /** Query builder sort attribute; empty means server default (primary key ascending). */
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * Whether we can locate an entity's page via primary-key ordering.
 * Custom attribute sorts are not comparable by key alone.
 */
export function canLocateEntityPageByKey(sort?: string, keyAttribute?: string): boolean {
  const attr = (sort ?? '').trim()
  if (!attr) return true
  const lower = attr.toLowerCase()
  if (lower === '__key' || lower === 'id') return true
  if (keyAttribute && lower === keyAttribute.toLowerCase()) return true
  return false
}

/** Coerce a persisted entity key for `$params` (numeric keys as numbers). */
export function coerceEntityKeyParam(entityKey: string): string | number {
  const trimmed = entityKey.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    if (!Number.isNaN(n)) return n
  }
  return trimmed
}

/** Next `:n` placeholder index given an existing filter expression. */
export function nextFilterParamIndex(filter: string): number {
  const matches = filter.match(/:(\d+)/g)
  if (!matches?.length) return 1
  return Math.max(...matches.map((m) => Number(m.slice(1)))) + 1
}

/**
 * Build a count filter that selects entities before `entityKey` in key order.
 * Returns null when the current sort is not key-based.
 *
 * Note: 4D REST does not allow filtering on `__KEY` — use the dataclass
 * primary-key attribute name from the catalog (usually `ID`).
 */
export function buildBeforeKeyFilter(options: {
  entityKey: string
  keyAttribute: string
  filter?: string
  filterParams?: unknown[]
  sort?: string
  order?: 'asc' | 'desc'
}): { filter: string; params: unknown[] } | null {
  const keyAttr = options.keyAttribute.trim()
  if (!keyAttr) return null
  if (!canLocateEntityPageByKey(options.sort, keyAttr)) return null

  const sortAttr = (options.sort ?? '').trim()
  // No $orderby → 4D returns entities in primary-key ascending order.
  const ascending = !sortAttr ? true : (options.order ?? 'asc') !== 'desc'
  const cmp = ascending ? '<' : '>'

  const baseFilter = (options.filter ?? '').trim()
  const baseParams = options.filterParams ?? []
  const keyParam = coerceEntityKeyParam(options.entityKey)

  if (!baseFilter) {
    return { filter: `${keyAttr} ${cmp} :1`, params: [keyParam] }
  }

  const idx = nextFilterParamIndex(baseFilter)
  return {
    filter: `(${baseFilter}) AND ${keyAttr} ${cmp} :${idx}`,
    params: [...baseParams, keyParam],
  }
}

/** Convert a "how many entities before this key" count into a 1-based page. */
export function pageFromBeforeCount(beforeCount: number, pageSize: number): number {
  const size = Math.max(1, pageSize)
  const before = Math.max(0, beforeCount)
  return Math.floor(before / size) + 1
}

const keyAttributeCache = new Map<string, string | null>()

/** Resolve the catalog primary-key attribute for a dataclass (cached). */
export async function resolveKeyAttribute(dataclassName: string): Promise<string | null> {
  if (keyAttributeCache.has(dataclassName)) {
    return keyAttributeCache.get(dataclassName) ?? null
  }
  try {
    const schema = await api.getDataclassSchema(dataclassName)
    const key = schema.key?.trim() || null
    keyAttributeCache.set(dataclassName, key)
    return key
  } catch {
    keyAttributeCache.set(dataclassName, null)
    return null
  }
}

/** Test helper — clear cached key attributes. */
export function clearKeyAttributeCache(): void {
  keyAttributeCache.clear()
}

/**
 * Resolve which page contains `entityKey` under the current query (key-ordered lists only).
 * Returns null when the page cannot be determined reliably.
 */
export async function findEntityPageByKey(options: FindEntityPageOptions): Promise<number | null> {
  const built = buildBeforeKeyFilter(options)
  if (!built) return null

  try {
    let query = client.dataclass(options.dataclassName).filter(built.filter)
    if (built.params.length > 0) {
      query = query.params(...built.params)
    }
    const beforeCount = await query.count()
    if (typeof beforeCount !== 'number' || !Number.isFinite(beforeCount)) return null
    return pageFromBeforeCount(beforeCount, options.pageSize)
  } catch {
    return null
  }
}
