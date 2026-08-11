import { parseTemplateExpression } from '@4d/ui'
import { resolveDynamicEnvVar } from './dynamic'
import {
  applyTransforms,
  extractGeneratorOptions,
  hasGeneratorOptionFilters,
  TRANSFORM_FILTER_NAMES,
} from './template-filters'
import {
  isHelperTemplateKey,
  isStructuredHelperKey,
  resolveHelperTemplate,
} from './template-helpers'
import {
  type EnvTemplateThis,
  isThisTemplateKey,
  type ResolveEnvOptions,
  resolveThisPath,
  stringifyThisValue,
} from './this-context'

export type { ResolveEnvOptions } from './this-context'

/** Matches `{{var_name}}` — key is non-empty, no nested braces. */
export const ENV_TEMPLATE_RE = /\{\{([^{}]+)\}\}/g

export type EnvTemplateSegment =
  | { kind: 'text'; text: string }
  | { kind: 'variable'; key: string; raw: string }

/** Split text into plain text and `{{var}}` segments (for UI highlighting). */
export function parseEnvTemplateSegments(text: string): EnvTemplateSegment[] {
  if (!text) return [{ kind: 'text', text: '' }]
  const segments: EnvTemplateSegment[] = []
  let lastIndex = 0
  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, index) })
    }
    const expr = parseTemplateExpression(match[1] ?? '')
    const key = expr?.key ?? match[1]?.trim() ?? ''
    segments.push({ kind: 'variable', key, raw: match[0] })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) })
  }
  if (segments.length === 0) return [{ kind: 'text', text }]
  return segments
}

/** Collect unique base variable keys referenced in text (filters stripped). */
export function collectEnvTemplateKeys(text: string): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  for (const match of text.matchAll(re)) {
    const expr = parseTemplateExpression(match[1] ?? '')
    const key = expr?.key ?? ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

function pushUnresolved(seen: Set<string>, unresolved: string[], label: string) {
  if (seen.has(label)) return
  seen.add(label)
  unresolved.push(label)
}

/**
 * Replace `{{key | filters}}` using `map`. Unresolved tokens are left as-is.
 * Missing keys that match dynamic vars (`$timestamp`, `$faker…`, `$pick`, …) are generated.
 * `$this` / `$this.*` resolve from `options.this` (reserved; not overridable by env map).
 * Returns `{ text, unresolved }` where unresolved lists unique missing expression labels.
 */
export function resolveEnvTemplates(
  text: string,
  map: ReadonlyMap<string, string> | Record<string, string>,
  options?: ResolveEnvOptions
): { text: string; unresolved: string[] } {
  if (!text?.includes('{{')) {
    return { text, unresolved: [] }
  }
  const get =
    map instanceof Map
      ? (key: string) => map.get(key)
      : (key: string) => {
          const record = map as Record<string, string>
          return Object.hasOwn(record, key) ? record[key] : undefined
        }

  const unresolved: string[] = []
  const seen = new Set<string>()
  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  const resolved = text.replace(re, (raw, rawInner: string) => {
    const expr = parseTemplateExpression(rawInner)
    if (!expr) return raw

    const { key, filters } = expr
    const label = rawInner.trim()

    // Ergonomic helpers (`$pick`, `$object`, `$faker.helpers.*`, …) before generic filters.
    if (isHelperTemplateKey(key)) {
      const helper = resolveHelperTemplate(key, filters)
      if (!helper) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      if (!helper.rehydrate) {
        const transformFilters = filters.filter((f) =>
          TRANSFORM_FILTER_NAMES.has(f.name.toLowerCase())
        )
        if (transformFilters.length > 0) {
          const transformed = applyTransforms(helper.text, transformFilters)
          if (transformed === null) {
            pushUnresolved(seen, unresolved, label)
            return raw
          }
          return transformed
        }
      }
      return helper.text
    }

    // Reserved `$this` context (not overridable by env map).
    if (isThisTemplateKey(key)) {
      const extracted = extractGeneratorOptions(filters)
      if (!extracted) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      if (hasGeneratorOptionFilters(filters)) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      const hit = resolveThisPath(options?.this, key)
      if (!hit.found) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      const asText = stringifyThisValue(hit.value)
      if (asText === null) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      const transformed = applyTransforms(asText, extracted.transforms)
      if (transformed === null) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      return transformed
    }

    const extracted = extractGeneratorOptions(filters)
    if (!extracted) {
      pushUnresolved(seen, unresolved, label)
      return raw
    }

    const { options: genOptions, transforms } = extracted
    let value = get(key)

    if (value !== undefined) {
      // Env values cannot use generator-only options (female, between, …).
      if (hasGeneratorOptionFilters(filters)) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
    } else {
      const dynamic = resolveDynamicEnvVar(key, genOptions)
      if (dynamic === undefined) {
        pushUnresolved(seen, unresolved, label)
        return raw
      }
      value = dynamic
    }

    const transformed = applyTransforms(value, transforms)
    if (transformed === null) {
      pushUnresolved(seen, unresolved, label)
      return raw
    }
    return transformed
  })
  return { text: resolved, unresolved }
}

/** Keys / expressions referenced in text that are missing from the map. */
export function collectUnresolved(
  text: string,
  map: ReadonlyMap<string, string> | Record<string, string>,
  options?: ResolveEnvOptions
): string[] {
  return resolveEnvTemplates(text, map, options).unresolved
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Resolve a string that is exactly one structured helper or `$this` leaf into a typed value.
 * Returns `null` when the string is not an exact structured leaf.
 */
function resolveExactStructuredLeaf(
  text: string,
  options?: ResolveEnvOptions
): { value: unknown; unresolved: boolean } | null {
  const trimmed = text.trim()
  const match = /^\{\{([^{}]+)\}\}$/.exec(trimmed)
  if (!match) return null
  const expr = parseTemplateExpression(match[1] ?? '')
  if (!expr) return null

  if (isThisTemplateKey(expr.key)) {
    const extracted = extractGeneratorOptions(expr.filters)
    if (!extracted || hasGeneratorOptionFilters(expr.filters)) {
      return { value: text, unresolved: true }
    }
    // Transforms require stringification — fall through to text resolve.
    if (extracted.transforms.length > 0) return null
    const hit = resolveThisPath(options?.this, expr.key)
    if (!hit.found) return { value: text, unresolved: true }
    if (typeof hit.value === 'string' && hit.value.includes('{{')) {
      return { value: text, unresolved: true }
    }
    return { value: hit.value, unresolved: false }
  }

  if (!isStructuredHelperKey(expr.key)) return null
  const helper = resolveHelperTemplate(expr.key, expr.filters)
  if (!helper) return { value: text, unresolved: true }
  if (!helper.rehydrate) return null
  return { value: helper.structured, unresolved: false }
}

/**
 * Deep-walk a JSON-compatible value and resolve string leaves.
 * Arrays/objects are cloned; non-string primitives are unchanged.
 * Exact `$object` / `$repeat` / `$sample` / `$unique` / `$vector` / `$this…` leaves rehydrate.
 */
export function resolveEnvTemplatesDeep<T>(
  value: T,
  map: ReadonlyMap<string, string> | Record<string, string>,
  options?: ResolveEnvOptions
): { value: T; unresolved: string[] } {
  const unresolved: string[] = []
  const seen = new Set<string>()

  const pushUnresolvedKeys = (keys: string[]) => {
    for (const key of keys) {
      if (seen.has(key)) continue
      seen.add(key)
      unresolved.push(key)
    }
  }

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const structured = resolveExactStructuredLeaf(node, options)
      if (structured) {
        if (structured.unresolved) {
          const inner = node.trim().slice(2, -2).trim()
          pushUnresolvedKeys([inner])
          return node
        }
        return structured.value
      }
      const result = resolveEnvTemplates(node, map, options)
      pushUnresolvedKeys(result.unresolved)
      return result.text
    }
    if (Array.isArray(node)) {
      return node.map(walk)
    }
    if (isPlainObject(node)) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v)
      }
      return out
    }
    return node
  }

  return { value: walk(value) as T, unresolved }
}

const DEFAULT_THIS_PASSES = 8

function valueStillHasTemplates(node: unknown): boolean {
  if (typeof node === 'string') return node.includes('{{')
  if (Array.isArray(node)) return node.some(valueStillHasTemplates)
  if (isPlainObject(node)) return Object.values(node).some(valueStillHasTemplates)
  return false
}

/**
 * Deep-resolve with `$this` rebuilt from the current snapshot each pass (sibling refs).
 * Stops early when stable or when no templates remain. Cyclic `$this` refs stay unresolved.
 */
export function resolveEnvTemplatesDeepWithThis<T>(
  value: T,
  map: ReadonlyMap<string, string> | Record<string, string>,
  getThis: (current: T) => EnvTemplateThis | undefined,
  maxPasses = DEFAULT_THIS_PASSES
): { value: T; unresolved: string[] } {
  let current = value
  let unresolved: string[] = []

  for (let pass = 0; pass < maxPasses; pass++) {
    if (!valueStillHasTemplates(current)) {
      return { value: current, unresolved: [] }
    }
    const thisRoot = getThis(current)
    const result = resolveEnvTemplatesDeep(current, map, { this: thisRoot })
    unresolved = result.unresolved
    const next = result.value
    if (stableDeepEqual(current, next)) {
      return { value: next, unresolved }
    }
    current = next
  }

  return { value: current, unresolved }
}

function stableDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}
