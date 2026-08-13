/**
 * Build `$this` roots for HTTP Client, Method Executor, Query Builder, and entity forms.
 */

import type { HttpClientRequestDraft } from '~/lib/http-client'
import type { MethodScope, RuntimeArgument } from '~/store/method-executor-types'
import type { EnvTemplateThis } from './this-context'

function pairsToRecord(
  pairs: ReadonlyArray<{ key: string; value: string; enabled?: boolean }>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of pairs) {
    if (pair.enabled === false) continue
    const key = pair.key.trim()
    if (!key) continue
    out[key] = pair.value
  }
  return out
}

function joinUrl(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, '')
  if (!path) return base
  if (/^https?:\/\//i.test(path)) return path
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

/** Friendly `$this` view of an HTTP Client request draft. */
export function buildHttpThis(draft: HttpClientRequestDraft): Record<string, unknown> {
  const method = draft.method === 'CUSTOM' ? draft.customMethod.trim() || 'CUSTOM' : draft.method
  const origin = draft.targetMode === 'custom' ? draft.customOrigin.trim() : ''
  const url = joinUrl(origin, draft.path)

  const formData = draft.body.formData.map((field) => {
    if (field.kind === 'text') {
      return {
        key: field.key,
        value: field.value,
        kind: field.kind,
        enabled: field.enabled !== false,
      }
    }
    return {
      key: field.key,
      kind: field.kind,
      enabled: field.enabled !== false,
      fileName: field.fileName,
    }
  })

  return {
    method,
    customMethod: draft.customMethod,
    targetMode: draft.targetMode,
    customOrigin: draft.customOrigin,
    path: draft.path,
    url,
    params: pairsToRecord(draft.params),
    headers: pairsToRecord(draft.headers),
    body: {
      mode: draft.body.mode,
      raw: draft.body.raw,
      rawContentType: draft.body.rawContentType,
      urlencoded: pairsToRecord(draft.body.urlencoded),
      formData,
    },
    settings: { ...draft.settings },
    disabledBuiltInHeaders: [...draft.disabledBuiltInHeaders],
  }
}

export type MethodThisInput = {
  scope: MethodScope
  methodName: string
  dataClass?: string
  singletonName?: string
  key?: string | number
  entitySetId?: string
  filter?: string
  orderby?: string
  arguments?: RuntimeArgument[]
  wrapperText?: string
  wrapperEnabled?: boolean
  queryParams?: ReadonlyArray<{ key: string; value: string; enabled?: boolean }>
  headers?: ReadonlyArray<{ key: string; value: string; enabled?: boolean }>
}

function parentLabel(input: MethodThisInput): string {
  if (
    input.scope === 'dataclass' ||
    input.scope === 'entity' ||
    input.scope === 'entitySelection'
  ) {
    return input.dataClass?.trim() || input.scope
  }
  if (input.scope === 'singleton') return input.singletonName?.trim() || 'singleton'
  return 'catalog'
}

function runtimeArgSnapshot(arg: RuntimeArgument): unknown {
  switch (arg.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'date':
    case 'custom':
      return arg.value
    case 'entity':
      return { dataClass: arg.dataClass, key: arg.key }
    case 'entitysel':
      return { dataClass: arg.dataClass, entitySetId: arg.entitySetId }
    default:
      return null
  }
}

/** `$this` bag for Method Executor calls. */
export function buildMethodThis(input: MethodThisInput): Record<string, unknown> {
  const args = (input.arguments ?? []).map(runtimeArgSnapshot)
  const byName: Record<string, unknown> = {}
  for (const arg of input.arguments ?? []) {
    const name = arg.name?.trim()
    if (!name) continue
    byName[name] = runtimeArgSnapshot(arg)
  }
  return {
    scope: input.scope,
    methodName: input.methodName,
    dataClass: input.dataClass ?? null,
    singletonName: input.singletonName ?? null,
    parent: parentLabel(input),
    key: input.key ?? null,
    entitySetId: input.entitySetId ?? null,
    filter: input.filter ?? '',
    orderby: input.orderby ?? '',
    args,
    arguments: args,
    argumentsByName: byName,
    wrapperText: input.wrapperText ?? '',
    wrapperEnabled: Boolean(input.wrapperEnabled),
    queryParams: pairsToRecord(input.queryParams ?? []),
    headers: pairsToRecord(input.headers ?? []),
  }
}

export type QueryThisInput = {
  dataclassName: string
  queryOptions: {
    filter: string
    filterParams?: Array<{ type: string; value: string }>
    sort?: string
    order?: 'asc' | 'desc'
    select?: string
    top?: number
  }
  entitySetId?: string | null
}

function filterParamsView(params: Array<{ type: string; value: string }>): {
  list: unknown[]
  byIndex: Record<string, unknown>
} {
  const list = params.map((p) => p.value)
  const byIndex: Record<string, unknown> = {}
  params.forEach((p, i) => {
    byIndex[String(i + 1)] = p.value
    byIndex[String(i)] = p.value
  })
  return { list, byIndex }
}

/** `$this` bag for Query Builder / dataclass queries. */
export function buildQueryThis(input: QueryThisInput): Record<string, unknown> {
  const { list, byIndex } = filterParamsView(input.queryOptions.filterParams ?? [])
  return {
    dataclass: input.dataclassName,
    dataclassName: input.dataclassName,
    filter: input.queryOptions.filter,
    filterParams: list,
    params: byIndex,
    entitySetId: input.entitySetId ?? null,
    sort: input.queryOptions.sort ?? '',
    order: input.queryOptions.order ?? 'desc',
    select: input.queryOptions.select ?? '',
    top: input.queryOptions.top ?? 0,
  }
}

/** Entity create/edit: `$this` is the payload itself (attribute names at top level). */
export function buildEntityThis(data: Record<string, unknown>): EnvTemplateThis {
  return data
}
