import type { EnvTemplateFilter } from '@4d/ui'
import { md5, sha1 } from '@noble/hashes/legacy.js'
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import type { DynamicGenerateOptions } from './dynamic'

const TRANSFORM_NAMES = new Set([
  'lower',
  'upper',
  'snake',
  'camel',
  'pascal',
  'kebab',
  'trim',
  'hash',
])

const GENERATOR_OPTION_NAMES = new Set([
  'female',
  'male',
  'min',
  'max',
  'between',
  'after',
  'before',
])

const HASH_ALGORITHMS = {
  md5,
  sha1,
  sha256,
  sha384,
  sha512,
} as const

type HashAlgorithm = keyof typeof HASH_ALGORITHMS

function isHashAlgorithm(value: string): value is HashAlgorithm {
  return Object.hasOwn(HASH_ALGORITHMS, value)
}

function isFiniteNumber(value: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

function toCamel(value: string): string {
  const parts = words(value)
  if (parts.length === 0) return ''
  return parts
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join('')
}

function toPascal(value: string): string {
  return words(value)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
}

function toSnake(value: string): string {
  return words(value).join('_')
}

function toKebab(value: string): string {
  return words(value).join('-')
}

function hashHex(value: string, algorithm: HashAlgorithm): string {
  return bytesToHex(HASH_ALGORITHMS[algorithm](utf8ToBytes(value)))
}

/**
 * Split filters into generator options (for `$dynamic` generate) and transform filters.
 * Returns `null` when a filter name is unknown or args are invalid.
 */
export function extractGeneratorOptions(filters: readonly EnvTemplateFilter[]): {
  options: DynamicGenerateOptions
  transforms: EnvTemplateFilter[]
} | null {
  const options: DynamicGenerateOptions = {}
  const transforms: EnvTemplateFilter[] = []

  for (const filter of filters) {
    const name = filter.name.toLowerCase()
    if (TRANSFORM_NAMES.has(name)) {
      if (name === 'hash') {
        if (filter.args.length !== 1) return null
        const algo = (filter.args[0] ?? '').trim().toLowerCase()
        if (!isHashAlgorithm(algo)) return null
        transforms.push({ name: 'hash', args: [algo] })
        continue
      }
      if (filter.args.length > 0) return null
      transforms.push({ name, args: [] })
      continue
    }
    if (!GENERATOR_OPTION_NAMES.has(name)) {
      return null
    }

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
      // Date between: YYYY-MM-DD,YYYY-MM-DD
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
      continue
    }
    return null
  }

  return { options, transforms }
}

/**
 * Apply transform filters left-to-right.
 * Returns `null` if any filter is unknown (should not happen after extract).
 */
export function applyTransforms(
  value: string,
  filters: readonly EnvTemplateFilter[]
): string | null {
  let out = value
  for (const filter of filters) {
    const name = filter.name.toLowerCase()
    if (name === 'hash') {
      if (filter.args.length !== 1) return null
      const algo = (filter.args[0] ?? '').trim().toLowerCase()
      if (!isHashAlgorithm(algo)) return null
      out = hashHex(out, algo)
      continue
    }
    if (filter.args.length > 0) return null
    switch (name) {
      case 'lower':
        out = out.toLowerCase()
        break
      case 'upper':
        out = out.toUpperCase()
        break
      case 'snake':
        out = toSnake(out)
        break
      case 'camel':
        out = toCamel(out)
        break
      case 'pascal':
        out = toPascal(out)
        break
      case 'kebab':
        out = toKebab(out)
        break
      case 'trim':
        out = out.trim()
        break
      default:
        return null
    }
  }
  return out
}

/** True when any filter is a generator option (not a string transform). */
export function hasGeneratorOptionFilters(filters: readonly EnvTemplateFilter[]): boolean {
  return filters.some((f) => GENERATOR_OPTION_NAMES.has(f.name.toLowerCase()))
}

/** Transform filter names (case/style + hash). Exported for resolve / helpers. */
export const TRANSFORM_FILTER_NAMES = TRANSFORM_NAMES
