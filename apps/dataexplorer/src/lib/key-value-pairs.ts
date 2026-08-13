import type { HttpKeyValuePair } from '~/store/http-client-types'
import { resolveEnvTemplates } from '~/lib/env'
import { mergeUnresolved } from '~/lib/env/runtime'

/** Enabled pairs with a non-empty key → plain record (last key wins). */
export function keyValuePairsToRecord(pairs: HttpKeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of pairs) {
    if (!pair.enabled) continue
    const key = pair.key.trim()
    if (!key) continue
    result[key] = pair.value
  }
  return result
}

export function resolveKeyValuePairs(
  pairs: HttpKeyValuePair[],
  map: Map<string, string>,
  thisRoot?: unknown
): { pairs: HttpKeyValuePair[]; unresolved: string[] } {
  const opts = thisRoot !== undefined ? { this: thisRoot } : undefined
  const next: HttpKeyValuePair[] = []
  let unresolved: string[] = []
  for (const pair of pairs) {
    const key = resolveEnvTemplates(pair.key, map, opts)
    const value = resolveEnvTemplates(pair.value, map, opts)
    next.push({ ...pair, key: key.text, value: value.text })
    unresolved = mergeUnresolved(unresolved, key.unresolved, value.unresolved)
  }
  return { pairs: next, unresolved }
}

/** Persist only when the editor has rows (including disabled). */
export function nonemptyKeyValuePairs(
  pairs: HttpKeyValuePair[] | undefined
): HttpKeyValuePair[] | undefined {
  return pairs && pairs.length > 0 ? pairs : undefined
}
