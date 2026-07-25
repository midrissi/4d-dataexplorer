import { type FetchFunction, HttpClient } from './core/http-client'
import { DataClassResource } from './resources/dataclass.resource'
import { type AuthConfig, AuthService } from './services/auth.service'
import { CatalogService } from './services/catalog.service'
import { InfoService } from './services/info.service'
import { type SingletonResource, SingletonService } from './services/singleton.service'
import type { Entity } from './types'

/**
 * REST Client configuration
 */
export interface RESTClientConfig {
  /** Base URL for the 4D REST server */
  baseUrl: string
  /** Authentication credentials (optional) */
  auth?: AuthConfig
  /** Custom fetch function for testing */
  fetch?: FetchFunction
  /** Request timeout in milliseconds */
  timeout?: number
  /** Default headers */
  headers?: Record<string, string>
  /** Injectable HttpClient for testing */
  httpClient?: HttpClient
}

/**
 * 4D REST API Client
 *
 * @example
 * ```typescript
 * const client = new RESTClient({
 *   baseUrl: 'http://localhost:8044',
 *   auth: { username: 'admin', password: 'pass' }
 * })
 *
 * // Query with fluent API
 * const employees = await client
 *   .dataclass<Employee>('Employee')
 *   .filter('salary > 50000')
 *   .orderBy('lastName')
 *   .select('firstName', 'lastName', 'salary')
 *   .top(10)
 *   .fetch()
 *
 * // Get single entity
 * const emp = await client.dataclass('Employee').get(42)
 *
 * // Create entity
 * const newEmp = await client.dataclass('Employee').create({
 *   firstName: 'John',
 *   lastName: 'Doe'
 * })
 * ```
 */
export class RESTClient {
  private readonly http: HttpClient
  private readonly _catalog: CatalogService
  private readonly _auth: AuthService
  private readonly _info: InfoService
  private readonly _singletons: SingletonService

  constructor(config: RESTClientConfig) {
    // Use injected HttpClient or create new one
    this.http =
      config.httpClient ??
      new HttpClient({
        baseUrl: config.baseUrl,
        fetch: config.fetch,
        timeout: config.timeout,
        headers: config.headers,
      })

    // Set auth if provided
    if (config.auth) {
      this.http.setBasicAuth(config.auth.username, config.auth.password)
    }

    // Initialize services
    this._catalog = new CatalogService(this.http)
    this._auth = new AuthService(this.http)
    this._info = new InfoService(this.http)
    this._singletons = new SingletonService(this.http)
  }

  // ============ Dataclass Access ============

  /**
   * Get a dataclass resource for querying and CRUD operations
   *
   * @example
   * ```typescript
   * // With type parameter for type-safe entities
   * interface Employee extends Entity {
   *   firstName: string
   *   lastName: string
   *   salary: number
   * }
   *
   * const employees = await client
   *   .dataclass<Employee>('Employee')
   *   .filter('salary > 50000')
   *   .fetch()
   *
   * // employees.__ENTITIES is typed as Employee[]
   * ```
   */
  dataclass<T extends Entity = Entity>(name: string): DataClassResource<T> {
    return new DataClassResource<T>(this.http, name)
  }

  // ============ Services ============

  /**
   * Catalog service for dataclass introspection
   */
  get catalog(): CatalogService {
    return this._catalog
  }

  /**
   * Authentication service
   */
  get auth(): AuthService {
    return this._auth
  }

  /**
   * Server info service
   */
  get info(): InfoService {
    return this._info
  }

  /**
   * Singletons service
   */
  get singletons(): SingletonService {
    return this._singletons
  }

  // ============ Convenience Methods ============

  /**
   * Get a singleton resource
   */
  singleton(name: string): SingletonResource {
    return this._singletons.singleton(name)
  }

  /**
   * Release an entity set from 4D Server's cache.
   * Uses GET /{dataClass}/$entityset/{entitySetID}?$method=release.
   *
   * @param dataClassName - Dataclass name (e.g. 'Employee')
   * @param entitySetId - Entity set ID to release (from __ENTITYSET or entityset creation)
   * @returns `{ ok: true }` on success; throws if entity set not found
   *
   * @example
   * ```ts
   * await client.releaseEntitySet('Employee', '4C51204DD8184B65AC7D79F09A077F24')
   * ```
   */
  async releaseEntitySet(dataClassName: string, entitySetId: string): Promise<{ ok: boolean }> {
    return this.dataclass(dataClassName).entitySet(entitySetId).release()
  }

  /**
   * Login with credentials
   */
  async login(username: string, password: string): Promise<boolean> {
    return this._auth.loginWithCredentials(username, password)
  }

  /**
   * Logout
   */
  logout(): void {
    this._auth.logout()
  }

  /**
   * Check if authenticated
   */
  get isAuthenticated(): boolean {
    return this._auth.isAuthenticated
  }

  /**
   * Get the base URL
   */
  get baseUrl(): string {
    return this.http.getBaseUrl()
  }

  /**
   * Get the underlying HTTP client (for advanced use)
   */
  getHttpClient(): HttpClient {
    return this.http
  }
}

// Re-export config type
export type { RESTClientConfig as ClientConfig }
