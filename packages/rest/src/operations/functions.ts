import type { HttpClient } from '../core/http-client'
import { normalizeOrderByExpression } from '../resources/query-builder'
import type { FunctionResponse } from '../types'

export interface FunctionCallOptions {
  method?: 'GET' | 'POST'
  filter?: string
  orderby?: string
  entitySetId?: string
  /**
   * When true (default), append `$method=entityset` so entity-selection results
   * are cached on the server and include `__ENTITYSET` in the response.
   */
  createEntitySet?: boolean
}

function buildFunctionQuery(
  params: unknown,
  options: FunctionCallOptions
): Record<string, string | number | boolean | undefined> {
  const query: Record<string, string | number | boolean | undefined> = {}
  if (options.createEntitySet !== false) query.$method = 'entityset'
  if (options.filter) query.$filter = options.filter
  if (options.orderby) query.$orderby = normalizeOrderByExpression(options.orderby)
  if (options.method === 'GET' && params !== undefined) {
    query.$params = JSON.stringify(params)
  }
  return query
}

/**
 * Class functions normally return `{ result: T }`. When `$method=entityset` is
 * used and the function returns an entity selection, 4D may return the entity
 * set payload directly (with `__ENTITYSET` / `__ENTITIES`) instead.
 */
function unwrapFunctionResult<T>(response: FunctionResponse<T> | T): T {
  if (
    response !== null &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'result' in response
  ) {
    return (response as FunctionResponse<T>).result
  }
  return response as T
}

export async function callDataStoreFunction<T = unknown>(
  http: HttpClient,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<T> {
  const method = options.method ?? 'POST'
  const path = `/$catalog/${functionName}`
  const query = buildFunctionQuery(params, options)

  if (method === 'GET') {
    const response = await http.get<FunctionResponse<T>>(path, query)
    return unwrapFunctionResult(response)
  }

  const response = await http.post<FunctionResponse<T>>(path, params, query)
  return unwrapFunctionResult(response)
}

export async function callDataClassFunction<T = unknown>(
  http: HttpClient,
  dataClass: string,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<T> {
  const method = options.method ?? 'POST'
  const path = `/${dataClass}/${functionName}`
  const query = buildFunctionQuery(params, options)

  if (method === 'GET') {
    const response = await http.get<FunctionResponse<T>>(path, query)
    return unwrapFunctionResult(response)
  }

  const response = await http.post<FunctionResponse<T>>(path, params, query)
  return unwrapFunctionResult(response)
}

export async function callEntityFunction<T = unknown>(
  http: HttpClient,
  dataClass: string,
  key: string | number,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<T> {
  const method = options.method ?? 'POST'
  const path = `/${dataClass}(${key})/${functionName}`
  const query = buildFunctionQuery(params, options)

  if (method === 'GET') {
    const response = await http.get<FunctionResponse<T>>(path, query)
    return unwrapFunctionResult(response)
  }

  const response = await http.post<FunctionResponse<T>>(path, params, query)
  return unwrapFunctionResult(response)
}

export async function callEntitySelectionFunction<T = unknown>(
  http: HttpClient,
  dataClass: string,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<T> {
  const method = options.method ?? 'POST'
  let path = `/${dataClass}/${functionName}`
  // When targeting an existing entity set, ignore filter/orderby — the set is the selection
  const queryOptions =
    options.entitySetId != null && options.entitySetId !== ''
      ? { ...options, filter: undefined, orderby: undefined }
      : options
  if (queryOptions.entitySetId) {
    path = `/${dataClass}/${functionName}/$entityset/${queryOptions.entitySetId}`
  }
  const query = buildFunctionQuery(params, queryOptions)

  if (method === 'GET') {
    const response = await http.get<FunctionResponse<T>>(path, query)
    return unwrapFunctionResult(response)
  }

  const response = await http.post<FunctionResponse<T>>(path, params, query)
  return unwrapFunctionResult(response)
}

export async function callSingletonFunction<T = unknown>(
  http: HttpClient,
  singleton: string,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<T> {
  const method = options.method ?? 'POST'
  const path = `/$singleton/${singleton}/${functionName}`
  const query = buildFunctionQuery(params, options)

  if (method === 'GET') {
    const response = await http.get<FunctionResponse<T>>(path, query)
    return unwrapFunctionResult(response)
  }

  const response = await http.post<FunctionResponse<T>>(path, params, query)
  return unwrapFunctionResult(response)
}
