import type { HttpClient } from '../core/http-client'
import type {
  ComputeOperation,
  ComputeResult,
  DeleteResult,
  Entity,
  EntityCollection,
  OrderDirection,
  QueryOptions,
  SimpleComputeResult,
} from '../types'
import { parseDistinctResponse } from '../utils/distinct'

/** Wrap order-by expressions for 4D REST ($orderby="attr desc, attr2 asc"). */
export function normalizeOrderByExpression(expression: string): string {
  const trimmed = expression.trim()
  if (!trimmed) return trimmed

  let inner = trimmed
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    inner = trimmed.slice(1, -1)
  }

  const escaped = inner.replace(/"/g, '\\u0022')
  return `"${escaped}"`
}

/** Normalize filter for 4D REST ($filter="expression"). */
export function normalizeFilterExpression(expression: string): string {
  const trimmed = expression.trim()
  let inner = trimmed
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    inner = trimmed.slice(1, -1)
  }
  const escaped = inner.replace(/"/g, '\\u0022')
  return `"${escaped}"`
}

/**
 * Fluent query builder for 4D REST API queries
 */
export class QueryBuilder<T extends Entity = Entity> {
  private readonly http: HttpClient
  private readonly dataClassName: string
  private readonly options: QueryOptions = {}
  private filterParams: unknown[] = []

  constructor(http: HttpClient, dataClassName: string) {
    this.http = http
    this.dataClassName = dataClassName
  }

  /**
   * Clone the builder with current state
   */
  private clone(): QueryBuilder<T> {
    const builder = new QueryBuilder<T>(this.http, this.dataClassName)
    Object.assign(builder.options, this.options)
    builder.filterParams = [...this.filterParams]
    return builder
  }

  /**
   * Normalize filter for 4D REST: strip surrounding quotes from user input,
   * then wrap in double quotes. Internal " escaped as \u0022 (sent unencoded so server can interpret).
   */
  private static normalizeFilterExpression(expression: string): string {
    return normalizeFilterExpression(expression)
  }

  /**
   * Set filter expression. Sent as $filter with value wrapped in double quotes;
   * surrounding quotes in the input are discarded. Internal " are escaped as \\u0022.
   * @example .filter('firstname = :1')  → $filter="firstname = :1"
   * @example .filter('lastName = :1 AND age > :2').params('Smith', 30)
   */
  filter(expression: string): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$filter = QueryBuilder.normalizeFilterExpression(expression)
    return builder
  }

  /**
   * Set parameter values for filter placeholders (:1, :2, etc.)
   */
  params(...values: unknown[]): QueryBuilder<T> {
    const builder = this.clone()
    builder.filterParams = values
    if (values.length > 0) {
      builder.options.$params = JSON.stringify(values)
    }
    return builder
  }

  /**
   * Order by attribute(s)
   * @example .orderBy('lastName')
   * @example .orderBy('lastName', 'desc')
   * @example .orderBy('lastName desc, firstName asc')
   */
  orderBy(attribute: string, direction?: OrderDirection): QueryBuilder<T> {
    const builder = this.clone()
    const expression = direction ? `${attribute} ${direction}` : attribute
    builder.options.$orderby = normalizeOrderByExpression(expression)
    return builder
  }

  /**
   * Select specific attributes to return
   * @example .select('firstName', 'lastName', 'salary')
   */
  select(...attributes: string[]): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$attributes = attributes.join(',')
    return builder
  }

  /**
   * Expand relation attributes
   * @example .expand('employer')
   * @example .expand('employer.*')
   */
  expand(...relations: string[]): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$expand = relations.join(',')
    return builder
  }

  /**
   * Limit number of entities returned
   */
  top(n: number): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$top = n
    return builder
  }

  /**
   * Alias for top()
   */
  limit(n: number): QueryBuilder<T> {
    return this.top(n)
  }

  /**
   * Skip first n entities
   */
  skip(n: number): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$skip = n
    return builder
  }

  /**
   * Set timeout for entity set (in seconds)
   */
  timeout(seconds: number): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$timeout = seconds
    return builder
  }

  /**
   * Save filter for entity set recreation
   */
  saveFilter(save = true): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$savedfilter = save
    return builder
  }

  /**
   * Save orderby for entity set recreation
   */
  saveOrderBy(save = true): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$savedorderby = save
    return builder
  }

  /**
   * Mark the query with `$distinct=true` for option building.
   * To fetch distinct values for an attribute, use {@link distinctValues}.
   */
  distinct(): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$distinct = true
    return builder
  }

  /**
   * Include query path info
   */
  withQueryPath(): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$querypath = true
    return builder
  }

  /**
   * Include query plan info
   */
  withQueryPlan(): QueryBuilder<T> {
    const builder = this.clone()
    builder.options.$queryplan = true
    return builder
  }

  /**
   * Build the query options
   */
  buildOptions(): QueryOptions {
    return { ...this.options }
  }

  /**
   * Build the path for the request
   */
  buildPath(): string {
    return `/${this.dataClassName}`
  }

  // ============ Terminal Operations ============

  /**
   * Execute query and return entity collection
   */
  async fetch(): Promise<EntityCollection<T>> {
    return this.http.get<EntityCollection<T>>(this.buildPath(), this.options)
  }

  /**
   * Execute query and return first entity or null
   */
  async fetchOne(): Promise<T | null> {
    const result = await this.top(1).fetch()
    return result.__ENTITIES[0] ?? null
  }

  /**
   * Execute query and return all entities as array
   */
  async fetchAll(): Promise<T[]> {
    const result = await this.fetch()
    return result.__ENTITIES
  }

  /**
   * Create an entity set from this query
   */
  async toEntitySet(timeoutSeconds?: number): Promise<EntitySetReference> {
    const options = { ...this.options, $method: 'entityset' as const }
    if (timeoutSeconds !== undefined) {
      options.$timeout = timeoutSeconds
    }

    const result = await this.http.get<EntityCollection<T> & { __ENTITYSET: string }>(
      this.buildPath(),
      options
    )

    const parts = result.__ENTITYSET.split('/')
    const id = parts[parts.length - 1] ?? ''

    return {
      id,
      uri: result.__ENTITYSET,
      dataClass: this.dataClassName,
      count: result.__COUNT,
      queryPlan: result.__queryPlan,
      queryPath: result.__queryPath,
    }
  }

  /**
   * Delete matching entities
   */
  async delete(): Promise<DeleteResult> {
    const options = { ...this.options, $method: 'delete' as const }
    return this.http.post<DeleteResult>(this.buildPath(), undefined, options)
  }

  /**
   * Compute aggregation on an attribute
   * @example .compute('sum', 'salary')
   * @example .compute('$all', 'salary')
   */
  async compute(
    operation: ComputeOperation,
    attribute: string
  ): Promise<ComputeResult | SimpleComputeResult> {
    const path = `/${this.dataClassName}/${attribute}`
    const options = { ...this.options, $compute: operation }
    return this.http.get<ComputeResult | SimpleComputeResult>(path, options)
  }

  /**
   * Return distinct values for an attribute.
   * Hits `GET /{dataClass}/{attribute}?$distinct=true` with current filter/params/top/skip.
   * @example .filter('name = a*').distinctValues('name')
   */
  async distinctValues(attribute: string): Promise<unknown[]> {
    const path = `/${this.dataClassName}/${attribute}`
    const { $attributes: _a, $expand: _e, $orderby: _o, $method: _m, ...rest } = this.options
    const options: QueryOptions = { ...rest, $distinct: true }
    const result = await this.http.get<unknown>(path, options)
    return parseDistinctResponse(result, attribute)
  }

  /**
   * Count matching entities
   */
  async count(): Promise<number> {
    const result = await this.top(0).fetch()
    return result.__COUNT
  }
}

/**
 * Reference to a created entity set
 */
export interface EntitySetReference {
  id: string
  uri: string
  dataClass: string
  count: number
  queryPlan?: unknown
  queryPath?: unknown
}
