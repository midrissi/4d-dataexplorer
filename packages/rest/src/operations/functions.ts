import type { HttpClient } from '../core/http-client'
import { normalizeOrderByExpression } from '../resources/query-builder'
import type { FunctionResponse } from '../types'
import { FunctionCallResult } from './function-call-result'

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
  /**
   * Extra properties merged into the POST body with `params`.
   * When set, the body is `{ params: [...], ...wrapper }` instead of a bare array.
   * Ignored for GET (params stay in `?$params=`).
   */
  wrapper?: Record<string, unknown>
  /** AbortSignal to cancel the in-flight function call. */
  signal?: AbortSignal
  timeout?: number
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

/** POST body: bare params array, or `{ params, ...wrapper }` when a wrapper is provided. */
export function buildFunctionBody(
  params: unknown[] = [],
  wrapper?: Record<string, unknown>
): unknown[] | Record<string, unknown> {
  if (wrapper === undefined) return params
  return { params, ...wrapper }
}

async function invokeFunction<T>(
  http: HttpClient,
  path: string,
  params: unknown[],
  options: FunctionCallOptions
): Promise<FunctionCallResult<T>> {
  const method = options.method ?? 'POST'
  const query = buildFunctionQuery(params, options)
  const requestOptions = {
    signal: options.signal,
    timeout: options.timeout,
  }
  const meta =
    method === 'GET'
      ? await http.getWithMeta<FunctionResponse<T> | T>(path, query, requestOptions)
      : await http.postWithMeta<FunctionResponse<T> | T>(
          path,
          buildFunctionBody(params, options.wrapper),
          query,
          requestOptions
        )
  return FunctionCallResult.fromHttp<T>(meta)
}

export async function callDataStoreFunction<T = unknown>(
  http: HttpClient,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<FunctionCallResult<T>> {
  return invokeFunction<T>(http, `/$catalog/${functionName}`, params, options)
}

export async function callDataClassFunction<T = unknown>(
  http: HttpClient,
  dataClass: string,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<FunctionCallResult<T>> {
  return invokeFunction<T>(http, `/${dataClass}/${functionName}`, params, options)
}

export async function callEntityFunction<T = unknown>(
  http: HttpClient,
  dataClass: string,
  key: string | number,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<FunctionCallResult<T>> {
  return invokeFunction<T>(http, `/${dataClass}(${key})/${functionName}`, params, options)
}

export async function callEntitySelectionFunction<T = unknown>(
  http: HttpClient,
  dataClass: string,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<FunctionCallResult<T>> {
  let path = `/${dataClass}/${functionName}`
  // When targeting an existing entity set, ignore filter/orderby — the set is the selection
  const queryOptions =
    options.entitySetId != null && options.entitySetId !== ''
      ? { ...options, filter: undefined, orderby: undefined }
      : options
  if (queryOptions.entitySetId) {
    path = `/${dataClass}/${functionName}/$entityset/${queryOptions.entitySetId}`
  }
  return invokeFunction<T>(http, path, params, queryOptions)
}

export async function callSingletonFunction<T = unknown>(
  http: HttpClient,
  singleton: string,
  functionName: string,
  params: unknown[] = [],
  options: FunctionCallOptions = {}
): Promise<FunctionCallResult<T>> {
  return invokeFunction<T>(http, `/$singleton/${singleton}/${functionName}`, params, options)
}
