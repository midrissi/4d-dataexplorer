/**
 * Named `$lists.<name>` declarations for `$pick` / `$sample` / `$unique`.
 *
 * Two kinds:
 * - `dataclass`: values loaded asynchronously via `$distinct` (not persisted)
 * - `hardcoded`: values persisted with the declaration
 *
 * Declarations are scoped (globals / profile / base) and merged with
 * base > profile > globals precedence at resolve time.
 */

import { parseTemplateExpression } from '@4d/ui'
import { ENV_TEMPLATE_RE } from './resolve'
import {
  type InlineListRefSpec,
  isInlineListRef,
  parseInlineListRef,
  parseListsRefName,
} from './this-context'

/** Default limit for new dataclass list declarations in the UI. */
export const PICK_LIST_DEFAULT_LIMIT = 500

export type PickListScope = 'globals' | 'profile' | 'base'

export type PickListKind = 'dataclass' | 'hardcoded'

type PickListDeclarationBase = {
  id: string
  name: string
}

/** Dataclass-backed list: values come from `$distinct` on the connected database. */
export type DataclassPickListDeclaration = PickListDeclarationBase & {
  type: 'dataclass'
  dataclass: string
  attribute: string
}

/** Hardcoded list: values are persisted with the declaration. */
export type HardcodedPickListDeclaration = PickListDeclarationBase & {
  type: 'hardcoded'
  values: string[]
}

/** Persisted declaration. Legacy entries without `type` migrate to `dataclass`. */
export type PickListDeclaration = DataclassPickListDeclaration | HardcodedPickListDeclaration

/** All three scopes for export / layered merge. */
export type ScopedPickLists = {
  globals: PickListDeclaration[]
  profile: PickListDeclaration[]
  base: PickListDeclaration[]
}

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isValidPickListName(name: string): boolean {
  return NAME_RE.test(name.trim())
}

/**
 * Same-scope name clash (empty / invalid names are not treated as duplicates).
 * When several rows share a valid name, only the last one is flagged.
 */
export function pickListNameIssue(
  entry: PickListDeclaration,
  entries: readonly PickListDeclaration[]
): 'invalid' | 'duplicate' | null {
  const name = entry.name.trim()
  if (!name) return null
  if (!isValidPickListName(name)) return 'invalid'
  let lastId: string | undefined
  let count = 0
  for (const item of entries) {
    if (item.name.trim() !== name) continue
    lastId = item.id
    count += 1
  }
  if (count > 1 && lastId === entry.id) return 'duplicate'
  return null
}

export function createPickListId(): string {
  return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyDataclassPickList(): DataclassPickListDeclaration {
  return {
    id: createPickListId(),
    name: '',
    type: 'dataclass',
    dataclass: '',
    attribute: '',
  }
}

export function createEmptyHardcodedPickList(): HardcodedPickListDeclaration {
  return {
    id: createPickListId(),
    name: '',
    type: 'hardcoded',
    values: [],
  }
}

/** @deprecated Prefer createEmptyDataclassPickList / createEmptyHardcodedPickList. */
export function createEmptyPickListDeclaration(): DataclassPickListDeclaration {
  return createEmptyDataclassPickList()
}

export function isDataclassPickList(
  entry: PickListDeclaration
): entry is DataclassPickListDeclaration {
  return entry.type === 'dataclass'
}

export function isHardcodedPickList(
  entry: PickListDeclaration
): entry is HardcodedPickListDeclaration {
  return entry.type === 'hardcoded'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse `x,y,z` / whitespace-separated pasted tags into ordered unique values. */
export function parseHardcodedListValues(raw: string): string[] {
  return normalizeHardcodedValues(
    raw
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean)
  )
}

/** Preserve first-seen order; dedupe case-insensitively. */
export function normalizeHardcodedValues(values: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function normalizePickListDeclaration(raw: unknown): PickListDeclaration | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createPickListId()
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''

  const explicitType = raw.type === 'hardcoded' || raw.type === 'dataclass' ? raw.type : null
  const looksHardcoded =
    explicitType === 'hardcoded' ||
    (explicitType == null && Array.isArray(raw.values) && !('dataclass' in raw))

  if (looksHardcoded) {
    const values = Array.isArray(raw.values)
      ? normalizeHardcodedValues(raw.values.map((v) => (typeof v === 'string' ? v : String(v))))
      : []
    return { id, name, type: 'hardcoded', values }
  }

  // Legacy entries without `type` (and with dataclass/attribute) → dataclass.
  const dataclass = typeof raw.dataclass === 'string' ? raw.dataclass.trim() : ''
  const attribute = typeof raw.attribute === 'string' ? raw.attribute.trim() : ''
  return { id, name, type: 'dataclass', dataclass, attribute }
}

export function normalizePickListDeclarations(raw: unknown): PickListDeclaration[] {
  if (!Array.isArray(raw)) return []
  const out: PickListDeclaration[] = []
  const seenIds = new Set<string>()
  for (const item of raw) {
    const decl = normalizePickListDeclaration(item)
    if (!decl) continue
    if (seenIds.has(decl.id)) {
      decl.id = createPickListId()
    }
    seenIds.add(decl.id)
    out.push(decl)
  }
  return out
}

/** Declared pick-list names (valid identifiers), including unloaded lists. */
export function listDeclaredPickListNames(entries: readonly PickListDeclaration[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const name = entry.name.trim()
    if (!isValidPickListName(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

/**
 * Merge scoped declarations with base > profile > globals precedence.
 * First-seen name wins when iterating in that order.
 */
export function mergeScopedPickLists(scopes: ScopedPickLists): PickListDeclaration[] {
  const out: PickListDeclaration[] = []
  const seen = new Set<string>()
  for (const entry of [...scopes.base, ...scopes.profile, ...scopes.globals]) {
    const name = entry.name.trim()
    if (!name || !isValidPickListName(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    out.push(entry)
  }
  return out
}

/** Build the resolve-context map from loaded value maps (valid names only). */
export function buildPickListsResolveMap(
  valuesByName: Record<string, readonly string[]>
): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {}
  for (const [name, values] of Object.entries(valuesByName)) {
    const trimmed = name.trim()
    if (!isValidPickListName(trimmed)) continue
    if (!values || values.length === 0) continue
    out[trimmed] = values
  }
  return out
}

export function stringifyDistinctValue(value: unknown, attribute?: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (attribute && attribute in record) return stringifyDistinctValue(record[attribute])
    if ('__KEY' in record) return stringifyDistinctValue(record.__KEY)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Collect `$lists.<name>` references from template text and `| from:$lists…` filters.
 */
export function collectReferencedPickListNames(text: string): string[] {
  if (!text?.includes('{{')) return []
  const out: string[] = []
  const seen = new Set<string>()
  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  for (const match of text.matchAll(re)) {
    const expr = parseTemplateExpression(match[1] ?? '')
    if (!expr) continue
    const fromKey = parseListsRefName(expr.key)
    if (fromKey && !seen.has(fromKey)) {
      seen.add(fromKey)
      out.push(fromKey)
    }
    for (const filter of expr.filters) {
      if (filter.name.toLowerCase() !== 'from') continue
      if (filter.args.length !== 1) continue
      const name = parseListsRefName(filter.args[0] ?? '')
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

/** Collect `$lists` names referenced by anonymize plan faker templates. */
export function collectPickListNamesFromPlan(
  plan: readonly { mode?: string; fakerKey?: string }[]
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const field of plan) {
    if (field.mode !== 'faker' || !field.fakerKey) continue
    for (const name of collectReferencedPickListNames(field.fakerKey)) {
      if (seen.has(name)) continue
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

export type PickListValuesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; values: readonly string[]; truncated: boolean }
  | { status: 'empty' }
  | { status: 'error'; message: string }

export type PickListLoaderResult = {
  values: string[]
  truncated: boolean
}

export type PickListDistinctLoader = (params: {
  dataclass: string
  attribute: string
  top: number
  entitySetId?: string
}) => Promise<PickListLoaderResult>

function cacheKey(baseId: string, declId: string): string {
  return `${baseId}\0${declId}`
}

/**
 * Session cache for distinct values keyed by baseId + declarationId.
 * In-flight promises are deduplicated.
 */
export function createPickListValuesCache() {
  const ready = new Map<string, { values: readonly string[]; truncated: boolean }>()
  const inflight = new Map<string, Promise<PickListLoaderResult>>()
  const errors = new Map<string, string>()

  const invalidate = (baseId: string, declId: string) => {
    const key = cacheKey(baseId, declId)
    ready.delete(key)
    inflight.delete(key)
    errors.delete(key)
  }

  const invalidateBase = (baseId: string) => {
    const prefix = `${baseId}\0`
    for (const key of [...ready.keys()]) {
      if (key.startsWith(prefix)) ready.delete(key)
    }
    for (const key of [...inflight.keys()]) {
      if (key.startsWith(prefix)) inflight.delete(key)
    }
    for (const key of [...errors.keys()]) {
      if (key.startsWith(prefix)) errors.delete(key)
    }
  }

  const getCached = (baseId: string, declId: string): PickListValuesState => {
    const key = cacheKey(baseId, declId)
    if (inflight.has(key)) return { status: 'loading' }
    const err = errors.get(key)
    if (err != null) return { status: 'error', message: err }
    const hit = ready.get(key)
    if (!hit) return { status: 'idle' }
    if (hit.values.length === 0) return { status: 'empty' }
    return { status: 'ready', values: hit.values, truncated: hit.truncated }
  }

  const ensure = async (
    baseId: string,
    declId: string,
    loaderParams: { dataclass: string; attribute: string; top: number; entitySetId?: string },
    loader: PickListDistinctLoader
  ): Promise<PickListLoaderResult> => {
    const key = cacheKey(baseId, declId)
    const cached = ready.get(key)
    if (cached) return { values: [...cached.values], truncated: cached.truncated }

    const pending = inflight.get(key)
    if (pending) return pending

    const promise = (async () => {
      try {
        const result = await loader(loaderParams)
        ready.set(key, { values: result.values, truncated: result.truncated })
        errors.delete(key)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.set(key, message)
        throw err
      } finally {
        inflight.delete(key)
      }
    })()

    inflight.set(key, promise)
    return promise
  }

  return { getCached, ensure, invalidate, invalidateBase }
}

/** Versioned Lists export/import payload. */
export type ListsExport = {
  version: 1
  globals?: PickListDeclaration[]
  profile?: PickListDeclaration[]
  base?: PickListDeclaration[]
}

export function parseListsExport(raw: unknown): ListsExport | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  const out: ListsExport = { version: 1 }
  if (Array.isArray(raw.globals)) out.globals = normalizePickListDeclarations(raw.globals)
  if (Array.isArray(raw.profile)) out.profile = normalizePickListDeclarations(raw.profile)
  if (Array.isArray(raw.base)) out.base = normalizePickListDeclarations(raw.base)
  // Legacy Environments export may nest pickLists under base or top-level.
  if (!out.base && Array.isArray(raw.pickLists)) {
    out.base = normalizePickListDeclarations(raw.pickLists)
  }
  return out
}

/** Apply a Lists JSON file or a legacy Environments export that nested pickLists. */
export function applyListsImport(
  parsed: unknown,
  opts: { hasBase: boolean }
): Partial<ScopedPickLists> | null {
  const imported = parseListsExport(parsed)
  if (imported) {
    const out: Partial<ScopedPickLists> = {}
    if (imported.globals) out.globals = imported.globals
    if (imported.profile) out.profile = imported.profile
    if (imported.base && opts.hasBase) out.base = imported.base
    return out
  }
  if (!isRecord(parsed) || !opts.hasBase) return null
  let base: PickListDeclaration[] | undefined
  if (Array.isArray(parsed.pickLists)) {
    base = parseListsExport({ version: 1, base: parsed.pickLists })?.base
  }
  if (isRecord(parsed.base) && Array.isArray(parsed.base.pickLists)) {
    base = parseListsExport({ version: 1, base: parsed.base.pickLists })?.base
  }
  return base ? { base } : null
}

/**
 * Scan template text(s) for `from:ds.Dataclass.Attribute` inline list references.
 * Also captures optional `| top:N` and `| entityset:ID` filters.
 * Returns deduplicated specs (first occurrence for each `ds.Dataclass.Attribute` wins).
 */
export function collectInlineListRefs(texts: readonly string[]): InlineListRefSpec[] {
  const byKey = new Map<string, InlineListRefSpec>()

  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  for (const text of texts) {
    if (!text?.includes('{{')) continue
    for (const match of text.matchAll(re)) {
      const expr = parseTemplateExpression(match[1] ?? '')
      if (!expr) continue
      const fromFilter = expr.filters.find((f) => f.name.toLowerCase() === 'from')
      if (fromFilter?.args.length !== 1) continue
      const arg = fromFilter.args[0] ?? ''
      if (!isInlineListRef(arg)) continue
      if (byKey.has(arg)) continue // already collected, first occurrence wins

      const topFilter = expr.filters.find((f) => f.name.toLowerCase() === 'top')
      // Fall back to a plain numeric `count:N` so `{{$pick | from:ds.X.Y | count:10}}`
      // only fetches the values it needs (a lone `count` is otherwise ignored by $pick).
      const countFilter = expr.filters.find((f) => f.name.toLowerCase() === 'count')
      const rawTopArg =
        topFilter?.args[0] ?? (countFilter?.args.length === 1 ? countFilter.args[0] : undefined)
      const rawTop =
        rawTopArg != null && /^\d+$/.test(rawTopArg.trim()) ? parseInt(rawTopArg, 10) : undefined
      const top = rawTop != null && Number.isFinite(rawTop) && rawTop > 0 ? rawTop : undefined

      const entitySetFilter = expr.filters.find((f) => f.name.toLowerCase() === 'entityset')
      const entitySetId = entitySetFilter?.args[0]?.trim() || undefined

      const parts = parseInlineListRef(arg)
      if (!parts) continue
      byKey.set(arg, {
        key: arg,
        dataclass: parts.dataclass,
        attribute: parts.attribute,
        ...(top != null ? { top } : {}),
        ...(entitySetId ? { entitySetId } : {}),
      })
    }
  }

  return [...byKey.values()]
}
