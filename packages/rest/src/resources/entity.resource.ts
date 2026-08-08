import type { HttpClient } from '../core/http-client'
import type { FunctionCallResult } from '../operations/function-call-result'
import { callEntityFunction } from '../operations/functions'
import type { DeleteResult, Entity, EntityMutationResult } from '../types'

/**
 * Resource for single entity operations
 */
export class EntityResource<T extends Entity = Entity> {
  private readonly http: HttpClient
  private readonly dataClassName: string
  private readonly entityKey: string | number

  constructor(http: HttpClient, dataClassName: string, key: string | number) {
    this.http = http
    this.dataClassName = dataClassName
    this.entityKey = key
  }

  /**
   * Build path for entity
   */
  private buildPath(suffix = ''): string {
    return `/${this.dataClassName}(${this.entityKey})${suffix}`
  }

  /**
   * Get the entity
   */
  async get(): Promise<T> {
    return this.http.get<T>(this.buildPath())
  }

  /**
   * Get specific attributes of the entity
   */
  async select(...attributes: string[]): Promise<T> {
    return this.http.get<T>(this.buildPath(), {
      $attributes: attributes.join(','),
    })
  }

  /**
   * Get attribute value
   */
  async getAttribute<V = unknown>(attribute: string): Promise<V> {
    return this.http.get<V>(this.buildPath(`/${attribute}`))
  }

  /**
   * Update the entity
   */
  async update(data: Partial<T> & { __STAMP?: number }): Promise<EntityMutationResult<T>> {
    const body = {
      __KEY: String(this.entityKey),
      ...data,
    }
    return this.http.post<EntityMutationResult<T>>(`/${this.dataClassName}`, body, {
      $method: 'update',
    })
  }

  /**
   * Delete the entity
   */
  async delete(): Promise<DeleteResult> {
    return this.http.post<DeleteResult>(this.buildPath(), undefined, {
      $method: 'delete',
    })
  }

  /**
   * Call an entity method. Returns a {@link FunctionCallResult};
   * use `.unwrap()` for the business payload.
   */
  async call<R = unknown>(
    methodName: string,
    ...params: unknown[]
  ): Promise<FunctionCallResult<R>> {
    return callEntityFunction<R>(
      this.http,
      this.dataClassName,
      this.entityKey,
      methodName,
      params,
      {
        createEntitySet: false,
      }
    )
  }

  /**
   * Lock the entity for editing
   */
  async lock(): Promise<{ success: boolean }> {
    return this.http.get<{ success: boolean }>(this.buildPath(), {
      $lock: true,
    } as Record<string, unknown>)
  }

  /**
   * Unlock the entity
   */
  async unlock(): Promise<{ success: boolean }> {
    return this.http.get<{ success: boolean }>(this.buildPath(), {
      $lock: false,
    } as Record<string, unknown>)
  }

  /**
   * Get related entity
   */
  async getRelated<R extends Entity = Entity>(relation: string): Promise<R> {
    return this.http.get<R>(this.buildPath(`/${relation}`), {
      $expand: relation,
    })
  }

  /**
   * Get related entities
   */
  async getRelatedMany<R extends Entity = Entity>(relation: string): Promise<R[]> {
    interface RelatedResponse {
      __ENTITIES: R[]
    }
    const response = await this.http.get<RelatedResponse>(this.buildPath(`/${relation}`), {
      $expand: relation,
    })
    return response.__ENTITIES
  }
}
