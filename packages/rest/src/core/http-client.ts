import type { ErrorResponse, QueryOptions } from '../types'
import { isErrorResponse } from '../types'
import {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  RESTAPIError,
  RESTClientError,
  SessionLimitError,
  StampMismatchError,
  TimeoutError,
} from './errors'

/**
 * Fetch function type for dependency injection
 */
export type FetchFunction = typeof globalThis.fetch

/**
 * Request middleware function
 */
export type RequestMiddleware = (request: Request) => Request | Promise<Request>

/**
 * Response middleware function
 */
export type ResponseMiddleware = (response: Response) => Response | Promise<Response>

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Base URL for the REST API (e.g., http://localhost:8044) */
  baseUrl: string
  /** Custom fetch function for testing/mocking */
  fetch?: FetchFunction
  /** Default headers to include in all requests */
  headers?: Record<string, string>
  /** Request timeout in milliseconds */
  timeout?: number
  /** Request middleware */
  requestMiddleware?: RequestMiddleware[]
  /** Response middleware */
  responseMiddleware?: ResponseMiddleware[]
}

/**
 * HTTP request options
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  params?: QueryOptions | Record<string, unknown>
  timeout?: number
}

/**
 * Injectable HTTP client for 4D REST API
 */
export class HttpClient {
  private readonly baseUrl: string
  private readonly fetchFn: FetchFunction
  private readonly defaultHeaders: Record<string, string>
  private readonly timeout: number
  private readonly requestMiddleware: RequestMiddleware[]
  private readonly responseMiddleware: ResponseMiddleware[]

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis)
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
    this.timeout = config.timeout ?? 30000
    this.requestMiddleware = config.requestMiddleware ?? []
    this.responseMiddleware = config.responseMiddleware ?? []
  }

  /**
   * Keys whose values must not be URL-encoded so escape sequences (e.g. \u0022) reach the server as-is.
   */
  private static readonly RAW_QUERY_KEYS = new Set(['$filter', '$orderby'])

  /**
   * Encode only characters that would break query parsing (& and =). Leaves \u0022 etc. unencoded.
   */
  private static minimalEncode(value: string): string {
    return value.replace(/&/g, '%26').replace(/=/g, '%3D')
  }

  /**
   * Build URL with query parameters. $filter is appended without full URL-encoding so \u0022 stays literal.
   */
  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}/rest${path}`)
    let rawAppend = ''

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue
        const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
        if (HttpClient.RAW_QUERY_KEYS.has(key)) {
          rawAppend += `${(rawAppend ? '&' : '') + key}=${HttpClient.minimalEncode(str)}`
        } else {
          url.searchParams.set(key, str)
        }
      }
    }

    const base = url.toString()
    if (rawAppend) {
      return base + (base.includes('?') ? '&' : '?') + rawAppend
    }
    return base
  }

  /**
   * Execute a request with middleware
   */
  private async executeRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, params, timeout = this.timeout } = options

    const url = this.buildUrl(path, params)
    const methodUpper = method.toUpperCase()
    // POST/PUT/PATCH without a payload still need a body so clients send
    // Content-Length. Prefer `{}` over an empty string: application/json +
    // zero-length body is rejected by some servers (4D returns 411), and some
    // HTTP stacks omit Content-Length: 0 entirely.
    const isBodyMethod = methodUpper === 'POST' || methodUpper === 'PUT' || methodUpper === 'PATCH'
    const requestBody = body !== undefined ? JSON.stringify(body) : isBodyMethod ? '{}' : undefined

    // Create initial request
    let request = new Request(url, {
      method,
      headers: {
        ...this.defaultHeaders,
        ...headers,
      },
      body: requestBody,
    })

    // Apply request middleware
    for (const middleware of this.requestMiddleware) {
      request = await middleware(request)
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      let response = await this.fetchFn(request, {
        signal: controller.signal,
      })

      // Apply response middleware
      for (const middleware of this.responseMiddleware) {
        response = await middleware(response)
      }

      return await this.handleResponse<T>(response)
    } catch (error) {
      // Re-throw REST client errors (they should propagate)
      if (
        error instanceof AuthenticationError ||
        error instanceof SessionLimitError ||
        error instanceof NotFoundError ||
        error instanceof RESTAPIError ||
        error instanceof RESTClientError ||
        error instanceof TimeoutError ||
        error instanceof StampMismatchError
      ) {
        throw error
      }
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new RESTClientError('Request timed out', 408)
        }
        throw new NetworkError(error.message, error)
      }
      throw new NetworkError('Unknown network error')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Handle response and convert to appropriate type or error
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle non-OK responses
    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) {
      return undefined as T
    }

    // Parse JSON response
    try {
      const data = JSON.parse(text)

      // Check for error in response body
      if (isErrorResponse(data)) {
        throw RESTAPIError.fromResponse(data, response.status)
      }

      return data as T
    } catch (error) {
      if (error instanceof RESTAPIError) {
        throw error
      }
      // Return raw text if not JSON
      return text as T
    }
  }

  /**
   * Handle error responses based on status code
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: ErrorResponse | null = null

    try {
      const text = await response.text()
      if (text) {
        errorData = JSON.parse(text)
      }
    } catch {
      // Ignore JSON parse errors
    }

    if (errorData && isErrorResponse(errorData)) {
      throw RESTAPIError.fromResponse(errorData, response.status)
    }

    switch (response.status) {
      case 401:
        throw new AuthenticationError()
      case 402:
        throw new SessionLimitError()
      case 404:
        throw new NotFoundError()
      default:
        throw new RESTClientError(
          response.statusText
            ? `HTTP ${response.status} ${response.statusText}`
            : `HTTP ${response.status}`,
          response.status
        )
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, params?: QueryOptions | Record<string, unknown>): Promise<T> {
    return this.executeRequest<T>(path, { method: 'GET', params })
  }

  /**
   * POST request
   */
  async post<T>(
    path: string,
    body?: unknown,
    params?: QueryOptions | Record<string, unknown>
  ): Promise<T> {
    return this.executeRequest<T>(path, { method: 'POST', body, params })
  }

  /**
   * PUT request
   */
  async put<T>(
    path: string,
    body?: unknown,
    params?: QueryOptions | Record<string, unknown>
  ): Promise<T> {
    return this.executeRequest<T>(path, { method: 'PUT', body, params })
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, params?: QueryOptions | Record<string, unknown>): Promise<T> {
    return this.executeRequest<T>(path, { method: 'DELETE', params })
  }

  /**
   * Set authorization header
   */
  setAuthorization(type: 'Basic' | 'Bearer', credentials: string): void {
    this.defaultHeaders.Authorization = `${type} ${credentials}`
  }

  /**
   * Set Basic auth from username/password
   */
  setBasicAuth(username: string, password: string): void {
    const encoded = btoa(`${username}:${password}`)
    this.setAuthorization('Basic', encoded)
  }

  /**
   * Clear authorization header
   */
  clearAuthorization(): void {
    delete this.defaultHeaders.Authorization
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }
}
