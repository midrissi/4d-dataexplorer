import { createKeyValuePair, type HttpKeyValuePair } from '~/store/http-client-types'

/** Stable id so default rows compare equal across apply/reset. */
export const DEFAULT_METHOD_METHOD_PARAM_ID = 'method-default-$method'

/**
 * Default Advanced → Params rows for Method Executor.
 * Mirrors `@4d/rest` function callers (`createEntitySet` → `$method=entityset`).
 */
export function createDefaultMethodQueryParams(): HttpKeyValuePair[] {
  return [
    createKeyValuePair({
      id: DEFAULT_METHOD_METHOD_PARAM_ID,
      key: '$method',
      value: 'entityset',
      enabled: true,
    }),
  ]
}

/** Use seed params when present; otherwise the `$method=entityset` default. */
export function resolveMethodQueryParams(pairs?: HttpKeyValuePair[]): HttpKeyValuePair[] {
  return pairs ?? createDefaultMethodQueryParams()
}

import { QUERY_EXPLAIN_PARAM_KEYS } from '~/lib/query-explain/params'

function isDefaultMethodParam(pair: HttpKeyValuePair): boolean {
  return pair.key.trim() === '$method' && pair.value === 'entityset' && pair.enabled !== false
}

function isExplainParam(pair: HttpKeyValuePair): boolean {
  const key = pair.key.trim()
  return QUERY_EXPLAIN_PARAM_KEYS.includes(key as (typeof QUERY_EXPLAIN_PARAM_KEYS)[number])
}

/**
 * True when params go beyond the built-in `$method=entityset` default
 * (used so Advanced stays collapsed for an untouched default).
 */
export function hasExtraMethodQueryParams(pairs?: HttpKeyValuePair[]): boolean {
  if (!pairs?.length) return false
  return pairs.some((pair) => !isDefaultMethodParam(pair) && !isExplainParam(pair))
}
