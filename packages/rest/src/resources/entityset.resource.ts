import type { HttpClient } from '../core/http-client'
import type {
  DeleteResult,
  Entity,
  EntityCollection,
  EntitySetOperator,
  QueryOptions,
} from '../types'

/**
 * Resource for entity set operations
 */
export class EntitySetResource<T extends Entity = Entity> {
  private readonly http: HttpClient
  private readonly dataClassName: string
  private readonly entitySetId: string

  constructor(http: HttpClient, dataClassName: string, entitySetId: string) {
    this.http = http
    this.dataClassName = dataClassName
    this.entitySetId = entitySetId
  }

  /**
   * Build path for entity set
   */
  private buildPath(): string {
    return `/${this.dataClassName}/$entityset/${this.entitySetId}`
  }

  /**
   * Get the entity set ID
   */
  get id(): string {
    return this.entitySetId
  }

  /**
   * Fetch entities from the entity set
   */
  async fetch(options?: QueryOptions): Promise<EntityCollection<T>> {
    return this.http.get<EntityCollection<T>>(this.buildPath(), options)
  }

  /**
   * Fetch with pagination
   */
  async fetchPage(skip: number, top: number, options?: QueryOptions): Promise<EntityCollection<T>> {
    return this.fetch({ ...options, $skip: skip, $top: top })
  }

  /**
   * Release the entity set from server cache
   */
  async release(): Promise<{ ok: boolean }> {
    return this.http.get<{ ok: boolean }>(this.buildPath(), {
      $method: 'release',
    })
  }

  /**
   * Delete all entities in the set
   */
  async delete(): Promise<DeleteResult> {
    return this.http.post<DeleteResult>(this.buildPath(), undefined, {
      $method: 'delete',
    })
  }

  /**
   * Clean undefined entity references from the set
   */
  async clean(): Promise<EntityCollection<T>> {
    return this.http.get<EntityCollection<T>>(this.buildPath(), {
      $clean: true,
    })
  }

  /**
   * Combine with another entity set using a logical operator
   */
  async combine(
    operator: EntitySetOperator,
    otherEntitySetId: string
  ): Promise<EntityCollection<T>> {
    return this.http.get<EntityCollection<T>>(this.buildPath(), {
      $logicOperator: operator,
      $otherCollection: otherEntitySetId,
    } as Record<string, unknown>)
  }

  /**
   * Combine with another entity set and create a new entity set
   */
  async combineToEntitySet(
    operator: EntitySetOperator,
    otherEntitySetId: string,
    timeout?: number
  ): Promise<EntitySetResource<T>> {
    const options: Record<string, unknown> = {
      $logicOperator: operator,
      $otherCollection: otherEntitySetId,
      $method: 'entityset',
    }
    if (timeout !== undefined) {
      options.$timeout = timeout
    }

    const result = await this.http.get<EntityCollection<T> & { __ENTITYSET: string }>(
      this.buildPath(),
      options
    )

    const parts = result.__ENTITYSET.split('/')
    const newId = parts[parts.length - 1] ?? ''
    return new EntitySetResource<T>(this.http, this.dataClassName, newId)
  }

  /**
   * Check if two entity sets intersect
   */
  async intersects(otherEntitySetId: string): Promise<boolean> {
    const result = await this.http.get<boolean>(this.buildPath(), {
      $logicOperator: 'INTERSECT',
      $otherCollection: otherEntitySetId,
    } as Record<string, unknown>)
    return result
  }

  /**
   * Get AND of two entity sets
   */
  async and(otherEntitySetId: string): Promise<EntityCollection<T>> {
    return this.combine('AND', otherEntitySetId)
  }

  /**
   * Get OR of two entity sets
   */
  async or(otherEntitySetId: string): Promise<EntityCollection<T>> {
    return this.combine('OR', otherEntitySetId)
  }

  /**
   * Get entities in this set but not in the other
   */
  async except(otherEntitySetId: string): Promise<EntityCollection<T>> {
    return this.combine('EXCEPT', otherEntitySetId)
  }
}
