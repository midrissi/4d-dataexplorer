import type { HttpClient } from '../core/http-client'
import type {
  ComputeOperation,
  ComputeResult,
  DeleteResult,
  Entity,
  EntityCollection,
  EntitySetOperator,
  QueryOptions,
  SimpleComputeResult,
} from '../types'
import { parseDistinctResponse } from '../utils/distinct'

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

  /**
   * Path with an attribute before `$entityset` (4D REST attribute selection).
   * e.g. `/Employee/salary/$entityset/{id}`
   */
  private buildAttributePath(attribute: string): string {
    return `/${this.dataClassName}/${attribute}/$entityset/${this.entitySetId}`
  }

  /**
   * Distinct values for an attribute within this entity set.
   * `GET /{dataClass}/{attribute}/$entityset/{id}?$distinct=true`
   */
  async distinct(attribute: string, options?: QueryOptions): Promise<unknown[]> {
    const { $attributes: _a, $expand: _e, $orderby: _o, $method: _m, ...rest } = options ?? {}
    const params: QueryOptions = { ...rest, $distinct: true }
    const result = await this.http.get<unknown>(this.buildAttributePath(attribute), params)
    return parseDistinctResponse(result, attribute)
  }

  /**
   * Compute aggregation on an attribute within this entity set.
   * `GET /{dataClass}/{attribute}/$entityset/{id}?$compute=$all`
   */
  async compute(
    attribute: string,
    operation: ComputeOperation = '$all'
  ): Promise<ComputeResult | SimpleComputeResult> {
    return this.http.get<ComputeResult | SimpleComputeResult>(this.buildAttributePath(attribute), {
      $compute: operation,
    })
  }
}
