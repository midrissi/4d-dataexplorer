/**
 * Named pick-list declarations for `$pick | from:$lists.<name>`.
 * Values are loaded asynchronously from `$distinct` and are not persisted.
 */

import { parseTemplateExpression } from '@4d/ui'
import { ENV_TEMPLATE_RE } from './resolve'
import { parseListsRefName } from './this-context'

/** Soft cap so huge dataclasses do not freeze anonymize / `$pick`. */
export const PICK_LIST_TOP = 5000

/** Persisted declaration (no values). */
export type PickListDeclaration = {
  id: string
  name: string
  dataclass: string
  attribute: string
}

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isValidPickListName(name: string): boolean {
  return NAME_RE.test(name.trim())
}

export function createPickListId(): string {
  return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyPickListDeclaration(): PickListDeclaration {
  return {
    id: createPickListId(),
    name: '',
    dataclass: '',
    attribute: '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizePickListDeclaration(raw: unknown): PickListDeclaration | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createPickListId()
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const dataclass = typeof raw.dataclass === 'string' ? raw.dataclass.trim() : ''
  const attribute = typeof raw.attribute === 'string' ? raw.attribute.trim() : ''
  return { id, name, dataclass, attribute }
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

export function stringifyDistinctValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
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
}) => Promise<PickListLoaderResult>

function cacheKey(baseId: string, dataclass: string, attribute: string): string {
  return `${baseId}\0${dataclass}\0${attribute}`
}

/**
 * Session cache for distinct values keyed by base + dataclass + attribute.
 * In-flight promises are deduplicated.
 */
export function createPickListValuesCache() {
  const ready = new Map<string, { values: readonly string[]; truncated: boolean }>()
  const inflight = new Map<string, Promise<PickListLoaderResult>>()
  const errors = new Map<string, string>()

  const invalidate = (baseId: string, dataclass: string, attribute: string) => {
    const key = cacheKey(baseId, dataclass, attribute)
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

  const getCached = (baseId: string, dataclass: string, attribute: string): PickListValuesState => {
    const key = cacheKey(baseId, dataclass, attribute)
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
    dataclass: string,
    attribute: string,
    loader: PickListDistinctLoader
  ): Promise<PickListLoaderResult> => {
    const key = cacheKey(baseId, dataclass, attribute)
    const cached = ready.get(key)
    if (cached) return { values: [...cached.values], truncated: cached.truncated }

    const pending = inflight.get(key)
    if (pending) return pending

    const promise = (async () => {
      try {
        const result = await loader({ dataclass, attribute, top: PICK_LIST_TOP })
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
