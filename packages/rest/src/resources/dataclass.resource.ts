import type { HttpClient } from '../core/http-client'
import type { FunctionCallResult } from '../operations/function-call-result'
import { callDataClassFunction } from '../operations/functions'
import type {
  ComputeOperation,
  ComputeResult,
  Entity,
  EntityCollection,
  EntityMutationResult,
  SimpleComputeResult,
} from '../types'
import { normalizeEntityMutationResults } from '../utils/entity-mutation'
import { EntityResource } from './entity.resource'
import { EntitySetResource } from './entityset.resource'
import { QueryBuilder } from './query-builder'

/**
 * Resource for dataclass operations
 */
export class DataClassResource<T extends Entity = Entity> {
  private readonly http: HttpClient
  private readonly name: string

  constructor(http: HttpClient, dataClassName: string) {
    this.http = http
    this.name = dataClassName
  }

  /**
   * Get the dataclass name
   */
  get dataClassName(): string {
    return this.name
  }

  // ============ Query Builder ============

  /**
   * Start building a query for all entities
   */
  all(): QueryBuilder<T> {
    return new QueryBuilder<T>(this.http, this.name)
  }

  /**
   * Start building a query with a filter
   */
  filter(expression: string): QueryBuilder<T> {
    return this.all().filter(expression)
  }

  /**
   * Start building a query with orderBy
   */
  orderBy(attribute: string, direction?: 'asc' | 'desc'): QueryBuilder<T> {
    return this.all().orderBy(attribute, direction)
  }

  /**
   * Start building a query with attribute selection
   */
  select(...attributes: string[]): QueryBuilder<T> {
    return this.all().select(...attributes)
  }

  // ============ Single Entity Operations ============

  /**
   * Get an entity by its primary key
   */
  async get(key: string | number): Promise<T> {
    return this.http.get<T>(`/${this.name}(${key})`)
  }

  /**
   * Get an entity resource for chained operations
   */
  entity(key: string | number): EntityResource<T> {
    return new EntityResource<T>(this.http, this.name, key)
  }

  /**
   * Get entity by attribute value
   * @example dataclass.getBy('email', 'john@example.com')
   */
  async getBy(attribute: string, value: string | number): Promise<T> {
    return this.http.get<T>(`/${this.name}:${attribute}(${value})`)
  }

  // ============ CRUD Operations ============

  /**
   * Create a new entity
   */
  async create(data: Partial<T>): Promise<EntityMutationResult<T>> {
    return this.http.post<EntityMutationResult<T>>(`/${this.name}`, data, { $method: 'update' })
  }

  /**
   * Update an existing entity
   */
  async update(
    key: string | number,
    data: Partial<T> & { __STAMP?: number }
  ): Promise<EntityMutationResult<T>> {
    const body = {
      __KEY: String(key),
      ...data,
    }
    return this.http.post<EntityMutationResult<T>>(`/${this.name}`, body, { $method: 'update' })
  }

  /**
   * Update or create multiple entities at once
   */
  async updateMany(
    entities: Array<Partial<T> & { __KEY?: string; __STAMP?: number }>
  ): Promise<EntityMutationResult<T>[]> {
    const response = await this.http.post<
      EntityMutationResult<T>[] | EntityCollection<T> | EntityMutationResult<T>
    >(`/${this.name}`, entities, {
      $method: 'update',
      $asArray: entities.length > 1,
    })
    return normalizeEntityMutationResults(response)
  }

  /**
   * Delete an entity by key
   */
  async delete(key: string | number): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/${this.name}(${key})`, undefined, {
      $method: 'delete',
    })
  }

  // ============ Entity Set Operations ============

  /**
   * Get an entity set resource by ID
   */
  entitySet(entitySetId: string): EntitySetResource<T> {
    return new EntitySetResource<T>(this.http, this.name, entitySetId)
  }

  // ============ Class Functions ============

  /**
   * Call a dataclass function. Returns a {@link FunctionCallResult};
   * use `.unwrap()` for the business payload.
   */
  async call<R = unknown>(
    functionName: string,
    ...params: unknown[]
  ): Promise<FunctionCallResult<R>> {
    return callDataClassFunction<R>(this.http, this.name, functionName, params, {
      createEntitySet: false,
    })
  }

  // ============ Aggregations ============

  /**
   * Compute aggregation on an attribute
   */
  async compute(
    attribute: string,
    operation: ComputeOperation = '$all'
  ): Promise<ComputeResult | SimpleComputeResult> {
    return this.http.get<ComputeResult | SimpleComputeResult>(`/${this.name}/${attribute}`, {
      $compute: operation,
    })
  }

  /**
   * Get sum of attribute values
   */
  async sum(attribute: string): Promise<number> {
    return this.http.get<number>(`/${this.name}/${attribute}`, { $compute: 'sum' })
  }

  /**
   * Get average of attribute values
   */
  async average(attribute: string): Promise<number> {
    return this.http.get<number>(`/${this.name}/${attribute}`, { $compute: 'average' })
  }

  /**
   * Get minimum attribute value
   */
  async min(attribute: string): Promise<number | string> {
    return this.http.get<number | string>(`/${this.name}/${attribute}`, { $compute: 'min' })
  }

  /**
   * Get maximum attribute value
   */
  async max(attribute: string): Promise<number | string> {
    return this.http.get<number | string>(`/${this.name}/${attribute}`, { $compute: 'max' })
  }

  /**
   * Count all entities in the dataclass
   */
  async count(): Promise<number> {
    const result = await this.all().top(0).fetch()
    return result.__COUNT
  }

  // ============ Fetch Shortcuts ============

  /**
   * Fetch all entities (with default limit)
   */
  async fetch(): Promise<EntityCollection<T>> {
    return this.all().fetch()
  }

  /**
   * Fetch first n entities
   */
  async fetchFirst(n: number): Promise<T[]> {
    const result = await this.all().top(n).fetch()
    return result.__ENTITIES
  }

  /**
   * Fetch one entity matching criteria
   */
  async findOne(filter: string): Promise<T | null> {
    return this.filter(filter).fetchOne()
  }

  /**
   * Fetch all entities matching criteria
   */
  async findAll(filter: string): Promise<T[]> {
    return this.filter(filter).fetchAll()
  }
}
