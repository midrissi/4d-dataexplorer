import { parseWrapperText } from '~/components/MethodExecutor/parse-wrapper-text'
import { serializeRuntimeParams } from '~/components/MethodExecutor/serialize-params'
import type { MethodExecutorSeed } from '~/store/method-executor-types'
import type { PostmanBody, PostmanItem, PostmanQueryParam } from './types'
import { buildPostmanUrl } from './url'

/** Mirrors `@4d/rest` `buildFunctionBody` (kept local so unit tests avoid the REST mock). */
function buildFunctionBody(
  params: unknown[] = [],
  wrapper?: Record<string, unknown>
): unknown[] | Record<string, unknown> {
  if (wrapper === undefined) return params
  return { params, ...wrapper }
}

/** Plain ORDA-style label for list rows / export names. */
export function methodSeedExportLabel(seed: MethodExecutorSeed): string {
  const method = seed.methodName || 'method'
  if (seed.scope === 'catalog') return `ds.${method}`
  if (seed.scope === 'singleton') {
    const name = seed.singletonName || 'Singleton'
    return `cs.${name}.${method}`
  }
  const dataClass = seed.dataClass || 'DataClass'
  if (seed.scope === 'dataclass') return `ds.${dataClass}.${method}`
  if (seed.scope === 'entity') {
    const key = seed.key === undefined || seed.key === '' ? '?' : String(seed.key)
    return `ds.${dataClass}.entity(${key}).${method}`
  }
  const selKey = seed.entitySetId?.trim() || '?'
  return `ds.${dataClass}.sel(${selKey}).${method}`
}

export function restPathForSeed(seed: MethodExecutorSeed): string {
  const fn = seed.methodName
  switch (seed.scope) {
    case 'catalog':
      return `/$catalog/${fn}`
    case 'singleton':
      return `/$singleton/${seed.singletonName || ''}/${fn}`
    case 'entity':
      return `/${seed.dataClass || ''}(${seed.key ?? ''})/${fn}`
    case 'entitySelection': {
      const dataClass = seed.dataClass || ''
      const entitySetId = seed.entitySetId?.trim()
      if (entitySetId) {
        return `/${dataClass}/${fn}/$entityset/${entitySetId}`
      }
      return `/${dataClass}/${fn}`
    }
    default:
      return `/${seed.dataClass || ''}/${fn}`
  }
}

function serializeParams(seed: MethodExecutorSeed): unknown[] {
  if (seed.arguments && seed.arguments.length > 0) {
    try {
      return serializeRuntimeParams(seed.arguments)
    } catch {
      return []
    }
  }
  return []
}

function resolveWrapper(seed: MethodExecutorSeed): Record<string, unknown> | undefined {
  if (!seed.wrapperEnabled) return undefined
  try {
    return parseWrapperText(seed.wrapperText)
  } catch {
    return undefined
  }
}

export function methodSeedToPostmanItem(
  seed: MethodExecutorSeed,
  options: { name: string; description?: string }
): PostmanItem & { request: NonNullable<Extract<PostmanItem, { request: unknown }>['request']> } {
  const wrapper = resolveWrapper(seed)
  const useGet = Boolean(seed.useGet && seed.allowedOnHTTPGET && wrapper === undefined)
  const method = useGet ? 'GET' : 'POST'
  const params = serializeParams(seed)

  const query: PostmanQueryParam[] = []
  const seedQueryParams = seed.queryParams ?? []
  // Legacy seeds without queryParams: match @4d/rest `createEntitySet` default.
  // When `$method` is present in Params (even disabled), the UI is the source of truth.
  const hasMethodParam = seedQueryParams.some((pair) => pair.key.trim() === '$method')
  if (!hasMethodParam) {
    query.push({ key: '$method', value: 'entityset' })
  }

  const hasEntitySet = Boolean(seed.entitySetId?.trim())
  if (!hasEntitySet) {
    if (seed.filter?.trim()) query.push({ key: '$filter', value: seed.filter.trim() })
    if (seed.orderby?.trim()) query.push({ key: '$orderby', value: seed.orderby.trim() })
  }

  if (useGet && params.length > 0) {
    query.push({ key: '$params', value: JSON.stringify(params) })
  }

  for (const pair of seedQueryParams) {
    if (!pair.enabled) continue
    const key = pair.key.trim()
    if (!key) continue
    const existing = query.findIndex((item) => item.key === key)
    if (existing >= 0) {
      query[existing] = { key, value: pair.value }
    } else {
      query.push({ key, value: pair.value })
    }
  }

  const path = `/rest${restPathForSeed(seed)}`
  const url = buildPostmanUrl({
    pathWithQuery: path,
    useBaseUrlVar: true,
    query,
  })

  const headers = method === 'POST' ? [{ key: 'Content-Type', value: 'application/json' }] : []
  for (const pair of seed.headers ?? []) {
    if (!pair.enabled) continue
    const key = pair.key.trim()
    if (!key) continue
    const existing = headers.findIndex((item) => item.key.toLowerCase() === key.toLowerCase())
    if (existing >= 0) {
      headers[existing] = { key, value: pair.value }
    } else {
      headers.push({ key, value: pair.value })
    }
  }

  let body: PostmanBody | undefined
  if (method === 'POST') {
    const payload = buildFunctionBody(params, wrapper)
    body = {
      mode: 'raw',
      raw: JSON.stringify(payload, null, 2),
      options: { raw: { language: 'json' } },
    }
  }

  return {
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    request: {
      method,
      header: headers,
      url,
      ...(body ? { body } : {}),
    },
  }
}
