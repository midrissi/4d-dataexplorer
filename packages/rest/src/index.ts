// Main client
export { type ClientConfig, RESTClient, type RESTClientConfig } from './client'
export {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  RESTAPIError,
  RESTClientError,
  SessionLimitError,
  StampMismatchError,
  TimeoutError,
} from './core/errors'
// Core
export { type FetchFunction, HttpClient, type HttpClientConfig } from './core/http-client'
// Function call operations
export {
  callDataClassFunction,
  callDataStoreFunction,
  callEntityFunction,
  callEntitySelectionFunction,
  callSingletonFunction,
  type FunctionCallOptions,
} from './operations/functions'
// Resources
export { DataClassResource } from './resources/dataclass.resource'
export { EntityResource } from './resources/entity.resource'
export { EntitySetResource } from './resources/entityset.resource'
export {
  type EntitySetReference,
  normalizeFilterExpression,
  normalizeOrderByExpression,
  QueryBuilder,
} from './resources/query-builder'
export { type AuthConfig, AuthService } from './services/auth.service'
// Services
export {
  CatalogService,
  type CatalogWithMetadataExpanded,
} from './services/catalog.service'
export { InfoService } from './services/info.service'
export { SingletonResource, SingletonService } from './services/singleton.service'

// Types - re-export all from types module
export * from './types'

// Utils - formatting utilities
export * from './utils'
