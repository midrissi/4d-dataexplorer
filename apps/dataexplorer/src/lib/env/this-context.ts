/**
 * `$this` / `$lists` call-site context for environment templates.
 * Paths use dotted segments: `$this`, `$this.firstName`, `$lists.companyKeys`.
 */

import { stringHasEnvTemplate } from './coerce-entity-data'

export type EnvTemplateThis = unknown

export type ResolveEnvOptions = {
  /** Root object exposed as `$this` / `$this.*`. */
  this?: EnvTemplateThis
  /** Named string lists for `$pick` / `$sample` / `$unique` (`$lists.<name>`). */
  lists?: Record<string, readonly string[]>
}

const LISTS_KEY_RE = /^\$lists\.([A-Za-z_][A-Za-z0-9_]*)$/

/** True when the template / filter arg is `$lists.<name>`. */
export function isListsRefKey(key: string): boolean {
  return LISTS_KEY_RE.test(key.trim())
}

/** Extract the list name from `$lists.<name>`, or `null` when invalid. */
export function parseListsRefName(key: string): string | null {
  const match = LISTS_KEY_RE.exec(key.trim())
  return match?.[1] ?? null
}

/**
 * Inline direct-load reference: `ds.Dataclass.Attribute` in a `from:` filter.
 * Values are fetched via `$distinct` and stored in `options.lists` under
 * key `"ds.Dataclass.Attribute"` before template resolution.
 * Supports `| entityset:ID` and `| top:N` filters.
 */
const INLINE_LIST_RE = /^ds\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/

/** True when the filter arg is an inline `ds.Dataclass.Attribute` reference. */
export function isInlineListRef(key: string): boolean {
  return INLINE_LIST_RE.test(key.trim())
}

export type InlineListRefSpec = {
  /** The full key used in `options.lists`, e.g. `"ds.Employee.firstName"`. */
  key: string
  dataclass: string
  attribute: string
  /** Max distinct values to fetch (from `| top:N` filter). */
  top?: number
  /** Entity set ID to scope the $distinct query (from `| entityset:ID` filter). */
  entitySetId?: string
}

/** Parse `ds.Dataclass.Attribute` into its parts, or `null` if invalid. */
export function parseInlineListRef(key: string): { dataclass: string; attribute: string } | null {
  const match = INLINE_LIST_RE.exec(key.trim())
  if (!match) return null
  return { dataclass: match[1] ?? '', attribute: match[2] ?? '' }
}

/**
 * Resolve `$lists.<name>` from `options.lists`.
 * Returns `found: false` when the name is missing or the list is empty.
 */
export function resolveListsRef(
  lists: Record<string, readonly string[]> | undefined,
  key: string
): { values: readonly string[]; found: boolean } {
  const name = parseListsRefName(key)
  if (!name || !lists) return { values: [], found: false }
  const values = lists[name]
  if (!values || values.length === 0) return { values: [], found: false }
  return { values, found: true }
}

/** Flatten `$lists.<name>` keys for autocomplete. */
export function listListsSuggestionKeys(
  lists: Record<string, readonly string[]> | undefined,
  maxKeys = 80
): string[] {
  if (!lists) return []
  const out: string[] = []
  for (const name of Object.keys(lists)) {
    if (out.length >= maxKeys) break
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue
    if (!lists[name] || lists[name].length === 0) continue
    out.push(`$lists.${name}`)
  }
  return out
}

const THIS_KEY_RE = /^\$this(?:\.(.+))?$/

/** True when the template base key is `$this` or `$this.…`. */
export function isThisTemplateKey(key: string): boolean {
  return THIS_KEY_RE.test(key.trim())
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Walk `root` along `$this` or `$this.a.b.0.c`.
 * Object segments match case-insensitively; array segments must be integer indices.
 */
export function resolveThisPath(
  root: EnvTemplateThis,
  key: string
): { value: unknown; found: boolean } {
  const trimmed = key.trim()
  const match = THIS_KEY_RE.exec(trimmed)
  if (!match) return { value: undefined, found: false }

  const path = match[1]
  if (!path) {
    if (root === undefined) return { value: undefined, found: false }
    return { value: root, found: true }
  }

  const segments = path.split('.')
  let current: unknown = root
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return { value: undefined, found: false }
    }
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return { value: undefined, found: false }
      const index = Number(segment)
      if (index < 0 || index >= current.length) return { value: undefined, found: false }
      current = current[index]
      continue
    }
    if (isPlainObject(current)) {
      const keys = Object.keys(current)
      const exact = Object.hasOwn(current, segment) ? segment : undefined
      const ci = exact ?? keys.find((k) => k.toLowerCase() === segment.toLowerCase())
      if (ci === undefined) return { value: undefined, found: false }
      current = current[ci]
      continue
    }
    return { value: undefined, found: false }
  }
  return { value: current, found: true }
}

/** String form for text substitution. Returns `null` when the value still embeds templates. */
export function stringifyThisValue(value: unknown): string | null {
  if (value === undefined) return null
  if (value === null) return 'null'
  if (typeof value === 'string') {
    if (stringHasEnvTemplate(value)) return null
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  try {
    const json = JSON.stringify(value)
    if (json === undefined) return null
    if (stringHasEnvTemplate(json)) return null
    return json
  } catch {
    return null
  }
}

/** Flatten `$this` and `$this.*` keys for autocomplete (depth-capped). */
export function listThisSuggestionKeys(
  root: EnvTemplateThis,
  maxDepth = 3,
  maxKeys = 80
): string[] {
  const out: string[] = ['$this']
  if (root === undefined) return out
  const seen = new Set<string>(out)

  const visit = (node: unknown, prefix: string, depth: number) => {
    if (out.length >= maxKeys || depth > maxDepth) return
    if (Array.isArray(node)) {
      const limit = Math.min(node.length, 8)
      for (let i = 0; i < limit; i++) {
        const key = `${prefix}.${i}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push(key)
        }
        visit(node[i], key, depth + 1)
        if (out.length >= maxKeys) return
      }
      return
    }
    if (!isPlainObject(node)) return
    for (const [name, child] of Object.entries(node)) {
      if (out.length >= maxKeys) return
      const key = `${prefix}.${name}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(key)
      }
      visit(child, key, depth + 1)
    }
  }

  visit(root, '$this', 1)
  return out
}
