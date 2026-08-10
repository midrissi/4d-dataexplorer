import { parseTemplateExpression } from '@4d/ui'
import { resolveDynamicEnvVar } from './dynamic'
import {
  applyTransforms,
  extractGeneratorOptions,
  hasGeneratorOptionFilters,
} from './template-filters'

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

/**
 * Replace `{{key | filters}}` using `map`. Unresolved tokens are left as-is.
 * Missing keys that match Postman dynamic vars (`$timestamp`, …) are generated.
 * Returns `{ text, unresolved }` where unresolved lists unique missing expression labels.
 */
export function resolveEnvTemplates(
  text: string,
  map: ReadonlyMap<string, string> | Record<string, string>
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
    const extracted = extractGeneratorOptions(filters)
    if (!extracted) {
      const label = rawInner.trim()
      if (!seen.has(label)) {
        seen.add(label)
        unresolved.push(label)
      }
      return raw
    }

    const { options, transforms } = extracted
    let value = get(key)

    if (value !== undefined) {
      // Env values cannot use generator-only options (female, between, …).
      if (hasGeneratorOptionFilters(filters)) {
        const label = rawInner.trim()
        if (!seen.has(label)) {
          seen.add(label)
          unresolved.push(label)
        }
        return raw
      }
    } else {
      const dynamic = resolveDynamicEnvVar(key, options)
      if (dynamic === undefined) {
        const label = rawInner.trim()
        if (!seen.has(label)) {
          seen.add(label)
          unresolved.push(label)
        }
        return raw
      }
      value = dynamic
    }

    const transformed = applyTransforms(value, transforms)
    if (transformed === null) {
      const label = rawInner.trim()
      if (!seen.has(label)) {
        seen.add(label)
        unresolved.push(label)
      }
      return raw
    }
    return transformed
  })
  return { text: resolved, unresolved }
}

/** Keys / expressions referenced in text that are missing from the map. */
export function collectUnresolved(
  text: string,
  map: ReadonlyMap<string, string> | Record<string, string>
): string[] {
  return resolveEnvTemplates(text, map).unresolved
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-walk a JSON-compatible value and resolve string leaves.
 * Arrays/objects are cloned; non-string primitives are unchanged.
 */
export function resolveEnvTemplatesDeep<T>(
  value: T,
  map: ReadonlyMap<string, string> | Record<string, string>
): { value: T; unresolved: string[] } {
  const unresolved: string[] = []
  const seen = new Set<string>()

  const pushUnresolved = (keys: string[]) => {
    for (const key of keys) {
      if (seen.has(key)) continue
      seen.add(key)
      unresolved.push(key)
    }
  }

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const result = resolveEnvTemplates(node, map)
      pushUnresolved(result.unresolved)
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
