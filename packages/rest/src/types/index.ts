// Entity types

// Catalog types
export type {
  AttributeKind,
  AttributeType,
  CatalogAllMetadataResponse,
  CatalogAllResponse,
  CatalogResponse,
  DataClass,
  DataClassAttribute,
  DataClassCatalogResponse,
  DataClassKey,
  DataClassMethod,
  DataClassRef,
  DatastoreMethod,
  Singleton,
  SingletonFull,
  SingletonMethod,
  SingletonMethodFull,
} from './catalog'
export type {
  ComputeResult,
  DeferredRelation,
  DeleteResult,
  Entity,
  EntityCollection,
  EntityMutationResult,
  EntityResponse,
  EntitySetInfo,
  EntityStatus,
  SimpleComputeResult,
} from './entity'

// Query types
export type {
  ComputeOperation,
  EntitySetOperator,
  EntitySetQueryOptions,
  FilterWithParams,
  ImageFormat,
  OrderByEntry,
  OrderDirection,
  QueryMethod,
  QueryOptions,
} from './query'

// Response types
export type {
  APIResponse,
  AuthResponse,
  EntitySetCacheInfo,
  ErrorResponse,
  FunctionResponse,
  InfoResponse,
  LoginResponse,
  ProgressInfo,
  RESTError,
  SessionInfo,
  SingletonResponse,
  UploadResponse,
  VersionResponse,
} from './responses'

export { isErrorResponse } from './responses'
