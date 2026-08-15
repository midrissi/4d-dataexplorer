import type { QueryExplainPayload } from './types'

const PLAN_KEYS = ['__queryPlan', 'queryPlan', '__queryplan'] as const
const PATH_KEYS = ['__queryPath', 'queryPath', '__querypath'] as const

function readKeyed(record: Record<string, unknown>, keys: readonly string[]): unknown | null {
  for (const key of keys) {
    if (key in record && record[key] != null) return record[key]
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function looksLikePath(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (Array.isArray(value.steps)) return true
  return typeof value.description === 'string' && ('time' in value || 'recordsfounds' in value)
}

function looksLikePlan(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.item === 'string') return true
  for (const key of Object.keys(value)) {
    if (/^(and|or|not|except)$/i.test(key) && Array.isArray(value[key])) return true
  }
  return false
}

/**
 * Pull `__queryPlan` / `__queryPath` (and aliases) from a 4D REST body.
 * Also accepts a bare plan or path object as the body (e.g. `GET /rest/$querypath`).
 */
export function extractQueryExplain(
  body: unknown,
  requested = true
): QueryExplainPayload | null {
  if (!requested) return null
  if (!isRecord(body)) {
    return { requested: true, plan: null, path: null }
  }

  let plan = readKeyed(body, PLAN_KEYS)
  let path = readKeyed(body, PATH_KEYS)

  const nested = isRecord(body.result) ? body.result : null
  if (nested) {
    plan ??= readKeyed(nested, PLAN_KEYS)
    path ??= readKeyed(nested, PATH_KEYS)
  }

  if (plan == null && path == null) {
    if (looksLikePath(body)) path = body
    else if (looksLikePlan(body)) plan = body
  }

  return { requested: true, plan: plan ?? null, path: path ?? null }
}

export function queryExplainHasData(payload: QueryExplainPayload | null | undefined): boolean {
  return payload != null && (payload.plan != null || payload.path != null)
}

export function mergeQueryExplain(
  primary: QueryExplainPayload | null | undefined,
  fallback: QueryExplainPayload | null | undefined
): QueryExplainPayload | null {
  if (!primary?.requested && !fallback?.requested) return null
  const plan = primary?.plan ?? fallback?.plan ?? null
  const path = primary?.path ?? fallback?.path ?? null
  return { requested: true, plan, path }
}
