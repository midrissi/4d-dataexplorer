import type { HttpClient } from '../core/http-client'
import type { SingletonResponse } from '../types'

/**
 * Service for singleton operations
 */
export class SingletonService {
  private readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Call a singleton function
   */
  async call<R = unknown>(
    singletonName: string,
    functionName: string,
    ...params: unknown[]
  ): Promise<R> {
    const response = await this.http.post<SingletonResponse<R>>(
      `/$singleton/${singletonName}/${functionName}`,
      params
    )
    return response.result
  }

  /**
   * Get a singleton resource for chained operations
   */
  singleton(name: string): SingletonResource {
    return new SingletonResource(this.http, name)
  }
}

/**
 * Resource for a specific singleton
 */
export class SingletonResource {
  private readonly http: HttpClient
  private readonly name: string

  constructor(http: HttpClient, name: string) {
    this.http = http
    this.name = name
  }

  /**
   * Call a function on this singleton
   */
  async call<R = unknown>(functionName: string, ...params: unknown[]): Promise<R> {
    const response = await this.http.post<SingletonResponse<R>>(
      `/$singleton/${this.name}/${functionName}`,
      params
    )
    return response.result
  }
}
