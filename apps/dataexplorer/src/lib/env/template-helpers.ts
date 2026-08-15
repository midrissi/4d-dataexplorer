/**
 * Ergonomic template helpers: `$pick`, `$sample`, `$unique`, `$repeat`, `$object`, `$vector`
 * and matching `$faker.helpers.*` paths with `from` / `of` / `count` filters.
 *
 * Nested generators use bare paths (no nested braces): `of:$faker.person.firstName`.
 */

import type { EnvTemplateFilter } from '@4d/ui'
import { type DynamicGenerateOptions, getEnvFaker, resolveDynamicEnvVar } from './dynamic'
import { TRANSFORM_FILTER_NAMES } from './template-filters'
import {
  isInlineListRef,
  isListsRefKey,
  type ResolveEnvOptions,
  resolveListsRef,
} from './this-context'

export type HelperTemplateResult = {
  /** String form for text substitution (JSON for arrays/objects). */
  text: string
  /** Typed value for deep-resolve rehydration (object/array) or scalar string. */
  structured: unknown
  /** True when `structured` is a plain object or array (rehydrate in deep walk). */
  rehydrate: boolean
}

export type HelperTemplateDef = {
  key: string
  description: string
}

const ALIAS_KEYS = ['$pick', '$sample', '$unique', '$repeat', '$object', '$vector'] as const

const HELPERS_PATH_RE =
  /^\$faker\.helpers\.(arrayElement|arrayElements|multiple|uniqueArray|weightedArrayElement)$/

const RESERVED_HELPER_FILTERS = new Set(['from', 'of', 'count', 'dims', 'normalize'])

const GENERATOR_OPTION_NAMES = new Set([
  'female',
  'male',
  'min',
  'max',
  'between',
  'after',
  'before',
])

/** Soft cap so a typo like `dims:1000000` cannot freeze the UI. */
const MAX_VECTOR_DIMS = 8192

/** Completions for ergonomic helper keys (not `$faker.helpers.*`). */
export const HELPER_TEMPLATE_DEFS: readonly HelperTemplateDef[] = [
  {
    key: '$pick',
    description: 'Random item from a list (`| from:a,b,c` or `| from:$lists.name`)',
  },
  {
    key: '$sample',
    description: 'Random subset as JSON array (`| from:… | count:n` or `count:2,5`)',
  },
  {
    key: '$unique',
    description: 'Unique subset as JSON array (`| from:… | count:n` or `count:>=2`)',
  },
  {
    key: '$repeat',
    description: 'Repeat a generator as JSON array (`| of:$faker… | count:n` or `count:2,5`)',
  },
  {
    key: '$object',
    description: 'Build a JSON object (`| name:$faker… | status:draft`)',
  },
  {
    key: '$vector',
    description:
      'Random float embedding (`| dims:n` or `count:n`; optional `normalize`, `min`/`max`)',
  },
]

/** @internal — filter names offered after `|` for helper templates. */
export const HELPER_FILTER_NAMES = ['from', 'of', 'count', 'dims', 'normalize'] as const

export function isHelperTemplateKey(key: string): boolean {
  const trimmed = key.trim()
  return (ALIAS_KEYS as readonly string[]).includes(trimmed) || HELPERS_PATH_RE.test(trimmed)
}

/** Keys whose result should rehydrate from JSON in deep resolve when the leaf is exact. */
export function isStructuredHelperKey(key: string): boolean {
  const trimmed = key.trim()
  if (
    trimmed === '$sample' ||
    trimmed === '$unique' ||
    trimmed === '$repeat' ||
    trimmed === '$object' ||
    trimmed === '$vector'
  ) {
    return true
  }
  const match = HELPERS_PATH_RE.exec(trimmed)
  if (!match) return false
  const method = match[1]
  return method === 'arrayElements' || method === 'multiple' || method === 'uniqueArray'
}

function isFiniteNumber(value: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Exact length, or inclusive `{ min, max }` resolved at generate time. */
export type HelperCountSpec = number | { min: number; max: number }

/** Upper bound when only a lower bound is given (`count:>=n` / `count:>n`). */
const OPEN_COUNT_DEFAULT_MAX = 10

function normalizeCountRange(min: number, max: number): HelperCountSpec | null {
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null
  if (min < 1 || max < 1) return null
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return lo === hi ? lo : { min: lo, max: hi }
}

/**
 * Parse one `count` argument token:
 * - `n` exact
 * - `>=n` / `>n` → min..max(default 10)
 * - `<=n` / `<n` → 1..max
 */
function parseCountBoundToken(token: string): HelperCountSpec | null {
  const trimmed = token.trim()
  const bound = /^(>=|>|<=|<)(-?\d+)$/.exec(trimmed)
  if (bound) {
    const op = bound[1]
    const n = Number(bound[2])
    if (!Number.isInteger(n)) return null
    if (op === '>=') {
      if (n < 1) return null
      return normalizeCountRange(n, Math.max(n, OPEN_COUNT_DEFAULT_MAX))
    }
    if (op === '>') {
      const min = n + 1
      if (min < 1) return null
      return normalizeCountRange(min, Math.max(min, OPEN_COUNT_DEFAULT_MAX))
    }
    if (op === '<=') {
      if (n < 1) return null
      return normalizeCountRange(1, n)
    }
    // `<n`
    const max = n - 1
    if (max < 1) return null
    return normalizeCountRange(1, max)
  }

  const exact = isFiniteNumber(trimmed)
  if (exact === null || !Number.isInteger(exact) || exact < 1) return null
  return exact
}

/**
 * `count:n` | `count:min,max` | `count:>=n` | `count:>n` | `count:<=n` | `count:<n`.
 * Returns `null` when the filter is missing or invalid.
 */
function parseCount(filters: readonly EnvTemplateFilter[]): HelperCountSpec | null {
  const filter = filters.find((f) => f.name.toLowerCase() === 'count')
  if (!filter) return null
  if (filter.args.length === 1) return parseCountBoundToken(filter.args[0] ?? '')
  if (filter.args.length === 2) {
    const a = isFiniteNumber(filter.args[0] ?? '')
    const b = isFiniteNumber(filter.args[1] ?? '')
    if (a === null || b === null) return null
    return normalizeCountRange(a, b)
  }
  return null
}

/** Clamp a count spec to a source list length (`$sample` / `$unique`). */
function clampCountToList(spec: HelperCountSpec, listLen: number): HelperCountSpec | null {
  if (listLen < 1) return null
  if (typeof spec === 'number') {
    if (spec > listLen) return null
    return spec
  }
  if (spec.min > listLen) return null
  const max = Math.min(spec.max, listLen)
  if (max < spec.min) return null
  return normalizeCountRange(spec.min, max)
}

function resolveCountNumber(spec: HelperCountSpec, faker: ReturnType<typeof getEnvFaker>): number {
  if (typeof spec === 'number') return spec
  return faker.number.int({ min: spec.min, max: spec.max })
}

/**
 * Parse `| from:…` into a string list.
 * - Literals: `from:a,b,c`
 * - Named lists: single arg `$lists.<name>` resolved from `options.lists`
 */
function parseFromList(
  filters: readonly EnvTemplateFilter[],
  options?: ResolveEnvOptions
): string[] | null {
  const filter = filters.find((f) => f.name.toLowerCase() === 'from')
  if (!filter || filter.args.length === 0) return null
  if (filter.args.length === 1) {
    const arg = filter.args[0] ?? ''
    if (isListsRefKey(arg)) {
      const hit = resolveListsRef(options?.lists, arg)
      if (!hit.found) return null
      return [...hit.values]
    }
    // Inline `Dataclass.Attribute` reference — values pre-loaded into options.lists.
    if (isInlineListRef(arg)) {
      const values = options?.lists?.[arg]
      if (!values || values.length === 0) return null
      return [...values]
    }
  }
  return [...filter.args]
}

function parseOfPath(filters: readonly EnvTemplateFilter[]): string | null {
  const filter = filters.find((f) => f.name.toLowerCase() === 'of')
  if (filter?.args.length !== 1) return null
  const path = (filter.args[0] ?? '').trim()
  return path.length > 0 ? path : null
}

function extractGeneratorOptionsFromFilters(
  filters: readonly EnvTemplateFilter[]
): DynamicGenerateOptions | null {
  const options: DynamicGenerateOptions = {}
  for (const filter of filters) {
    const name = filter.name.toLowerCase()
    if (!GENERATOR_OPTION_NAMES.has(name)) continue

    if (name === 'female') {
      if (filter.args.length > 0) return null
      options.gender = 'female'
      continue
    }
    if (name === 'male') {
      if (filter.args.length > 0) return null
      options.gender = 'male'
      continue
    }
    if (name === 'min') {
      if (filter.args.length !== 1) return null
      const n = isFiniteNumber(filter.args[0] ?? '')
      if (n === null) return null
      options.min = n
      continue
    }
    if (name === 'max') {
      if (filter.args.length !== 1) return null
      const n = isFiniteNumber(filter.args[0] ?? '')
      if (n === null) return null
      options.max = n
      continue
    }
    if (name === 'between') {
      if (filter.args.length !== 2) return null
      const a = filter.args[0] ?? ''
      const b = filter.args[1] ?? ''
      const na = isFiniteNumber(a)
      const nb = isFiniteNumber(b)
      if (na !== null && nb !== null) {
        options.min = Math.min(na, nb)
        options.max = Math.max(na, nb)
        continue
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b)) {
        options.after = a <= b ? a : b
        options.before = a <= b ? b : a
        continue
      }
      return null
    }
    if (name === 'after') {
      if (filter.args.length !== 1) return null
      const d = filter.args[0] ?? ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
      options.after = d
      continue
    }
    if (name === 'before') {
      if (filter.args.length !== 1) return null
      const d = filter.args[0] ?? ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
      options.before = d
    }
  }
  return options
}

/** Coerce a filter arg to a typed JSON-friendly value (literals or `$faker…` / clock aliases). */
export function resolveHelperArgValue(
  arg: string,
  options?: DynamicGenerateOptions
): unknown | undefined {
  const trimmed = arg.trim()
  if (!trimmed) return undefined

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  const asNumber = isFiniteNumber(trimmed)
  if (asNumber !== null) return asNumber

  if (trimmed.startsWith('$')) {
    const generated = resolveDynamicEnvVar(trimmed, options)
    if (generated === undefined) return undefined
    if (trimmed.startsWith('$faker.number.')) {
      const n = Number(generated)
      if (Number.isFinite(n)) return n
    }
    if (trimmed.startsWith('$faker.datatype.boolean')) {
      if (generated === 'true') return true
      if (generated === 'false') return false
    }
    return generated
  }

  return trimmed
}

function okScalar(value: string): HelperTemplateResult {
  return { text: value, structured: value, rehydrate: false }
}

function okStructured(value: unknown): HelperTemplateResult {
  try {
    return { text: JSON.stringify(value), structured: value, rehydrate: true }
  } catch {
    return { text: String(value), structured: value, rehydrate: false }
  }
}

function parseWeighted(from: string[]): { value: string; weight: number }[] | null {
  const out: { value: string; weight: number }[] = []
  for (const item of from) {
    const colon = item.lastIndexOf(':')
    if (colon <= 0) return null
    const value = item.slice(0, colon)
    const weightRaw = item.slice(colon + 1)
    const weight = isFiniteNumber(weightRaw)
    if (!value || weight === null || weight <= 0) return null
    out.push({ value, weight })
  }
  return out.length > 0 ? out : null
}

type HelperKind =
  | 'pick'
  | 'sample'
  | 'unique'
  | 'repeat'
  | 'object'
  | 'vector'
  | 'weighted'
  | 'uniqueArrayGen'

function helperKindForKey(key: string): HelperKind | null {
  const trimmed = key.trim()
  switch (trimmed) {
    case '$pick':
      return 'pick'
    case '$sample':
      return 'sample'
    case '$unique':
      return 'unique'
    case '$repeat':
      return 'repeat'
    case '$object':
      return 'object'
    case '$vector':
      return 'vector'
    default:
      break
  }
  const match = HELPERS_PATH_RE.exec(trimmed)
  if (!match) return null
  switch (match[1]) {
    case 'arrayElement':
      return 'pick'
    case 'arrayElements':
      return 'sample'
    case 'multiple':
      return 'repeat'
    case 'uniqueArray':
      return 'uniqueArrayGen'
    case 'weightedArrayElement':
      return 'weighted'
    default:
      return null
  }
}

/**
 * Exact dimension for `$vector`: `dims:n` or `count:n` (positive integer, capped).
 * Returns `null` when missing or invalid.
 */
function parseVectorDims(filters: readonly EnvTemplateFilter[]): number | null {
  const dimsFilter = filters.find((f) => f.name.toLowerCase() === 'dims')
  const countFilter = filters.find((f) => f.name.toLowerCase() === 'count')
  const filter = dimsFilter ?? countFilter
  if (filter?.args.length !== 1) return null
  const n = isFiniteNumber(filter.args[0] ?? '')
  if (n === null || !Number.isInteger(n) || n < 1 || n > MAX_VECTOR_DIMS) return null
  return n
}

function hasNormalizeFlag(filters: readonly EnvTemplateFilter[]): boolean | null {
  const filter = filters.find((f) => f.name.toLowerCase() === 'normalize')
  if (!filter) return false
  if (filter.args.length > 0) return null
  return true
}

function generateEmbeddingVector(
  dims: number,
  options: DynamicGenerateOptions,
  normalize: boolean,
  faker: ReturnType<typeof getEnvFaker>
): number[] {
  let min = options.min ?? -1
  let max = options.max ?? 1
  if (min > max) {
    const tmp = min
    min = max
    max = tmp
  }
  const values: number[] = []
  for (let i = 0; i < dims; i++) {
    values.push(faker.number.float({ min, max }))
  }
  if (!normalize) return values

  let sumSq = 0
  for (const v of values) sumSq += v * v
  const norm = Math.sqrt(sumSq)
  if (norm <= 0) return values
  return values.map((v) => v / norm)
}

function validateHelperFilters(kind: HelperKind, filters: readonly EnvTemplateFilter[]): boolean {
  for (const filter of filters) {
    const name = filter.name.toLowerCase()
    if (TRANSFORM_FILTER_NAMES.has(name) || GENERATOR_OPTION_NAMES.has(name)) continue
    if (RESERVED_HELPER_FILTERS.has(name)) continue
    // Object fields are free-form filter names.
    if (kind === 'object') continue
    return false
  }
  return true
}

/**
 * Resolve an ergonomic helper template.
 * Returns `null` when the key is not a helper or filters/args are invalid.
 */
export function resolveHelperTemplate(
  key: string,
  filters: readonly EnvTemplateFilter[],
  resolveOptions?: ResolveEnvOptions
): HelperTemplateResult | null {
  const kind = helperKindForKey(key)
  if (!kind) return null
  if (!validateHelperFilters(kind, filters)) return null

  const options = extractGeneratorOptionsFromFilters(filters)
  if (options === null) return null

  const faker = getEnvFaker()

  try {
    if (kind === 'object') {
      const out: Record<string, unknown> = {}
      for (const filter of filters) {
        const name = filter.name.toLowerCase()
        if (
          TRANSFORM_FILTER_NAMES.has(name) ||
          GENERATOR_OPTION_NAMES.has(name) ||
          RESERVED_HELPER_FILTERS.has(name)
        ) {
          continue
        }
        if (filter.args.length !== 1) return null
        const value = resolveHelperArgValue(filter.args[0] ?? '', options)
        if (value === undefined) return null
        out[filter.name] = value
      }
      if (Object.keys(out).length === 0) return null
      return okStructured(out)
    }

    if (kind === 'vector') {
      const dims = parseVectorDims(filters)
      if (dims === null) return null
      const normalize = hasNormalizeFlag(filters)
      if (normalize === null) return null
      return okStructured(generateEmbeddingVector(dims, options, normalize, faker))
    }

    if (kind === 'pick') {
      const from = parseFromList(filters, resolveOptions)
      if (!from) return null
      return okScalar(faker.helpers.arrayElement(from))
    }

    if (kind === 'weighted') {
      const from = parseFromList(filters, resolveOptions)
      if (!from) return null
      const weighted = parseWeighted(from)
      if (!weighted) return null
      return okScalar(faker.helpers.weightedArrayElement(weighted))
    }

    if (kind === 'sample' || kind === 'unique') {
      const from = parseFromList(filters, resolveOptions)
      if (!from) return null
      const rawCount = parseCount(filters) ?? (kind === 'unique' ? from.length : 1)
      const count = clampCountToList(rawCount, from.length)
      if (count === null) return null
      return okStructured(faker.helpers.arrayElements(from, count))
    }

    if (kind === 'repeat' || kind === 'uniqueArrayGen') {
      const ofPath = parseOfPath(filters)
      if (!ofPath) return null
      const count = parseCount(filters)
      if (count === null) return null

      const generate = () => {
        const value = resolveHelperArgValue(ofPath, options)
        if (value === undefined) throw new Error('unresolved of')
        return value
      }

      if (kind === 'uniqueArrayGen') {
        // Faker uniqueArray only accepts a fixed length — resolve ranges first.
        const length = resolveCountNumber(count, faker)
        return okStructured(faker.helpers.uniqueArray(generate, length))
      }

      return okStructured(faker.helpers.multiple(generate, { count }))
    }
  } catch {
    return null
  }

  return null
}
