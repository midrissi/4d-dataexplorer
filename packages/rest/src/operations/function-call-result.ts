import type { HttpResponse } from '../core/http-client'
import type { FunctionNotification, FunctionResponse, FunctionWebform } from '../types'

export type FunctionCallResultInit = {
  body: unknown
  status?: number
  statusText?: string
  headers?: Headers | Record<string, string>
  durationMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Business payload: `result` when present, otherwise the body (entity-set passthrough). */
export function unwrapFunctionBody<T = unknown>(body: unknown): T {
  if (isRecord(body) && 'result' in body) {
    return (body as unknown as FunctionResponse<T>).result
  }
  return body as T
}

export function webformFromBody(body: unknown): FunctionWebform | undefined {
  if (!isRecord(body) || !isRecord(body.__WEBFORM)) return undefined
  return body.__WEBFORM as FunctionWebform
}

/**
 * Developer-friendly wrapper around a 4D class-function HTTP response.
 *
 * ```ts
 * const res = await client.dataclass('City').call('getCity', 'Aguada')
 * res.unwrap()        // business payload
 * res.time()          // duration ms
 * res.notifications() // __WEBFORM.__NOTIFICATION
 * ```
 */
export class FunctionCallResult<T = unknown> {
  readonly body: unknown
  private readonly _status: number
  private readonly _statusText: string
  private readonly _headers: Headers
  private readonly _durationMs: number

  constructor(init: FunctionCallResultInit) {
    this.body = init.body
    this._status = init.status ?? 200
    this._statusText = init.statusText ?? 'OK'
    this._headers =
      init.headers instanceof Headers
        ? init.headers
        : new Headers(init.headers ?? { 'Content-Type': 'application/json' })
    this._durationMs = init.durationMs ?? 0
  }

  static fromHttp<T>(httpResponse: HttpResponse<FunctionResponse<T> | T>): FunctionCallResult<T> {
    return new FunctionCallResult<T>({
      body: httpResponse.data,
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      durationMs: httpResponse.durationMs,
    })
  }

  unwrap(): T {
    return unwrapFunctionBody<T>(this.body)
  }

  result(): T {
    return this.unwrap()
  }

  time(): number {
    return this._durationMs
  }

  status(): number {
    return this._status
  }

  statusText(): string {
    return this._statusText
  }

  headers(): Headers {
    return this._headers
  }

  header(name: string): string | null {
    return this._headers.get(name)
  }

  webform(): FunctionWebform | undefined {
    return webformFromBody(this.body)
  }

  notifications(): FunctionNotification | undefined {
    const notification = this.webform()?.__NOTIFICATION
    if (!isRecord(notification)) return undefined
    return notification as FunctionNotification
  }
}
