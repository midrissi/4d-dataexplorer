import { parseWrapperText } from '~/components/MethodExecutor/parse-wrapper-text'
import { serializeRuntimeParams } from '~/components/MethodExecutor/serialize-params'
import { restPathForSeed } from '~/lib/postman/method-seed-to-item'
import {
  createKeyValuePair,
  type HttpClientSeed,
  type HttpKeyValuePair,
  normalizeHttpBody,
} from '~/store/http-client-types'
import type { MethodExecutorSeed } from '~/store/method-executor-types'

function buildFunctionBody(
  params: unknown[] = [],
  wrapper?: Record<string, unknown>
): unknown[] | Record<string, unknown> {
  if (wrapper === undefined) return params
  return { params, ...wrapper }
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

function buildQueryParams(seed: MethodExecutorSeed, useGet: boolean, params: unknown[]): HttpKeyValuePair[] {
  const pairs: HttpKeyValuePair[] = []
  const seedQueryParams = seed.queryParams ?? []
  const hasMethodParam = seedQueryParams.some((pair) => pair.key.trim() === '$method')
  if (!hasMethodParam) {
    pairs.push(createKeyValuePair({ key: '$method', value: 'entityset', enabled: true }))
  }

  const hasEntitySet = Boolean(seed.entitySetId?.trim())
  if (!hasEntitySet) {
    if (seed.filter?.trim()) {
      pairs.push(createKeyValuePair({ key: '$filter', value: seed.filter.trim(), enabled: true }))
    }
    if (seed.orderby?.trim()) {
      pairs.push(createKeyValuePair({ key: '$orderby', value: seed.orderby.trim(), enabled: true }))
    }
  }

  if (useGet && params.length > 0) {
    pairs.push(
      createKeyValuePair({ key: '$params', value: JSON.stringify(params), enabled: true })
    )
  }

  for (const pair of seedQueryParams) {
    if (!pair.enabled) continue
    const key = pair.key.trim()
    if (!key) continue
    const existing = pairs.findIndex((item) => item.key === key)
    const next = createKeyValuePair({ key, value: pair.value, enabled: true })
    if (existing >= 0) pairs[existing] = next
    else pairs.push(next)
  }

  return pairs
}

/**
 * Convert a Method Executor seed into an HTTP Client draft seed
 * (same path / query / body shape as Postman export).
 */
export function methodSeedToHttpSeed(seed: MethodExecutorSeed): HttpClientSeed {
  const wrapper = resolveWrapper(seed)
  const useGet = Boolean(seed.useGet && seed.allowedOnHTTPGET && wrapper === undefined)
  const method = useGet ? 'GET' : 'POST'
  const params = serializeParams(seed)
  const queryParams = buildQueryParams(seed, useGet, params)
  const path = `/rest${restPathForSeed(seed)}`

  const headers: HttpKeyValuePair[] = []
  if (method === 'POST') {
    headers.push(
      createKeyValuePair({ key: 'Content-Type', value: 'application/json', enabled: true })
    )
  }
  for (const pair of seed.headers ?? []) {
    if (!pair.enabled) continue
    const key = pair.key.trim()
    if (!key) continue
    const existing = headers.findIndex((item) => item.key.toLowerCase() === key.toLowerCase())
    const next = createKeyValuePair({ key, value: pair.value, enabled: true })
    if (existing >= 0) headers[existing] = next
    else headers.push(next)
  }

  const body =
    method === 'POST'
      ? normalizeHttpBody({
          mode: 'raw',
          raw: JSON.stringify(buildFunctionBody(params, wrapper), null, 2),
          rawLanguage: 'json',
          rawContentType: 'application/json',
        })
      : normalizeHttpBody({ mode: 'none' })

  return {
    method,
    targetMode: 'current',
    path,
    params: queryParams,
    headers,
    body,
    label: `${method} ${path}`,
  }
}
