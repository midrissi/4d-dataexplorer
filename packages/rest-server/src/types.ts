/**
 * Types matching the 4D REST API structure
 */

export type AttributeKind = 'storage' | 'calculated' | 'alias' | 'relatedEntity' | 'relatedEntities'
export type AttributeType =
  | 'bool'
  | 'blob'
  | 'byte'
  | 'date'
  | 'duration'
  | 'image'
  | 'long'
  | 'long64'
  | 'number'
  | 'string'
  | 'uuid'
  | 'word'
  | 'object'
  | string

export interface DataClassAttribute {
  name: string
  kind: AttributeKind
  type: AttributeType
  scope?: 'public' | 'protected'
  indexed?: boolean
  unique?: boolean
  autosequence?: boolean
  readOnly?: boolean
  identifying?: boolean
  fieldPos?: number
  path?: string
  foreignKey?: string
  inverseName?: string
  multiLine?: boolean
  defaultFormat?: {
    format: string
  }
}

export interface DataClassKey {
  name: string
}

export interface DataClass {
  name: string
  className?: string
  collectionName: string
  tableNumber?: number
  scope?: 'public' | 'protected'
  dataURI: string
  attributes: DataClassAttribute[]
  methods?: Array<{
    name: string
    applyTo?: 'dataClass' | 'entity' | 'entitySelection'
    exposed?: boolean
    allowedOnHTTPGET?: boolean
  }>
  key?: DataClassKey[]
  defaultTopSize?: number
  extraProperties?: Record<string, unknown>
}

export interface CatalogResponse {
  __UNIQID?: string
  dataClasses: Array<{
    name: string
    uri: string
    dataURI: string
  }>
  singletons?: unknown[]
}

export interface CatalogAllResponse {
  dataClasses: DataClass[]
  singletons?: unknown[]
}

export interface Entity {
  __KEY: string
  __STAMP: number
  __TIMESTAMP?: string
  __DATACLASS?: string
  [key: string]: unknown
}

export interface EntityCollection<T extends Entity = Entity> {
  __entityModel: string
  __GlobalStamp?: number
  __COUNT: number
  __SENT: number
  __FIRST: number
  __ENTITIES: T[]
  __ENTITYSET?: string
}

export interface EntityMutationResult<_T extends Entity = Entity> extends Entity {
  __entityModel: string
  uri?: string
  __STATUS?: {
    status: number
    statusText: string
    success: boolean
  }
}

export interface LoginResponse {
  success: boolean
  isLogged: boolean
  errors?: string[]
}
