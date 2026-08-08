import type { HttpClient } from '../core/http-client'
import type { FunctionCallResult } from '../operations/function-call-result'
import { callSingletonFunction } from '../operations/functions'

/**
 * Service for singleton operations
 */
export class SingletonService {
  private readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Call a singleton function. Returns a {@link FunctionCallResult};
   * use `.unwrap()` for the business payload.
   */
  async call<R = unknown>(
    singletonName: string,
    functionName: string,
    ...params: unknown[]
  ): Promise<FunctionCallResult<R>> {
    return callSingletonFunction<R>(this.http, singletonName, functionName, params, {
      createEntitySet: false,
    })
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
   * Call a function on this singleton. Returns a {@link FunctionCallResult};
   * use `.unwrap()` for the business payload.
   */
  async call<R = unknown>(
    functionName: string,
    ...params: unknown[]
  ): Promise<FunctionCallResult<R>> {
    return callSingletonFunction<R>(this.http, this.name, functionName, params, {
      createEntitySet: false,
    })
  }
}
