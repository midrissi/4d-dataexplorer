import { createKeyValuePair, type HttpKeyValuePair } from '~/store/http-client-types'

export const QUERY_EXPLAIN_PARAM_KEYS = ['$queryplan', '$querypath'] as const

export const QUERY_EXPLAIN_PARAM_IDS = {
  $queryplan: 'query-explain-$queryplan',
  $querypath: 'query-explain-$querypath',
} as const

function isTruthyParam(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1'
}

function findExplainIndex(pairs: HttpKeyValuePair[], key: string): number {
  return pairs.findIndex((pair) => pair.key.trim() === key)
}

export function areQueryExplainParamsEnabled(pairs: readonly HttpKeyValuePair[]): boolean {
  return QUERY_EXPLAIN_PARAM_KEYS.every((key) =>
    pairs.some((pair) => pair.enabled !== false && pair.key.trim() === key && isTruthyParam(pair.value))
  )
}

/** Add or enable `$queryplan=true` and `$querypath=true`, or drop/disable them. */
export function setQueryExplainParams(
  pairs: HttpKeyValuePair[],
  enabled: boolean
): HttpKeyValuePair[] {
  if (enabled) {
    const next = [...pairs]
    for (const key of QUERY_EXPLAIN_PARAM_KEYS) {
      const index = findExplainIndex(next, key)
      if (index >= 0) {
        const current = next[index]
        if (!current) continue
        next[index] = { ...current, enabled: true, value: 'true' }
        continue
      }
      next.push(
        createKeyValuePair({
          id: QUERY_EXPLAIN_PARAM_IDS[key],
          key,
          value: 'true',
          enabled: true,
        })
      )
    }
    return next
  }

  const next: HttpKeyValuePair[] = []
  for (const pair of pairs) {
    const key = pair.key.trim()
    if (key !== '$queryplan' && key !== '$querypath') {
      next.push(pair)
      continue
    }
    if (pair.id === QUERY_EXPLAIN_PARAM_IDS.$queryplan || pair.id === QUERY_EXPLAIN_PARAM_IDS.$querypath) {
      continue
    }
    next.push({ ...pair, enabled: false })
  }
  return next
}
