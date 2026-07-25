/**
 * Attribute kinds in 4D dataclass
 */
export type AttributeKind = 'storage' | 'calculated' | 'alias' | 'relatedEntity' | 'relatedEntities'

/**
 * Attribute types in 4D
 */
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
  | string // for relation types (dataclass names)

/**
 * DataClass attribute definition
 */
export interface DataClassAttribute {
  name: string
  kind: AttributeKind
  type: AttributeType
  /**
   * For calculated/alias attributes, the kind of value they resolve to (e.g. a
   * calculated attribute returning an entity selection has
   * `behavior: 'relatedEntities'`).
   */
  behavior?: 'relatedEntity' | 'relatedEntities'
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
  /**
   * Present when `type` is `object` and a class was set in the structure editor
   * (e.g. `"4D.Vector"` for embedding fields).
   */
  classID?: string
}

/**
 * DataClass method definition
 */
export interface DataClassMethod {
  name: string
  applyTo?: 'dataClass' | 'entity' | 'entitySelection' | 'entityCollection' | 'dataClassSelection'
  exposed?: boolean
  allowedOnHTTPGET?: boolean
  scope?: string
  /** Method signature (e.g. "getFullName() : Text") when available (e.g. with $metadata=full) */
  paramsText?: string
}

/**
 * DataClass key definition
 */
export interface DataClassKey {
  name: string
}

/**
 * DataClass definition from $catalog
 */
export interface DataClass {
  name: string
  className?: string
  collectionName: string
  tableNumber?: number
  scope?: 'public' | 'protected'
  dataURI: string
  attributes: DataClassAttribute[]
  methods?: DataClassMethod[]
  key?: DataClassKey[]
  defaultTopSize?: number
  extraProperties?: Record<string, unknown>
}

/**
 * Singleton method definition
 */
export interface SingletonMethod {
  name: string
  exposed: boolean
  allowedOnHTTPGET?: boolean
}

/**
 * Singleton method definition with full metadata ($metadata=full)
 */
export interface SingletonMethodFull extends SingletonMethod {
  paramsText?: string
  filePath?: string
  startingLine?: number
  endingLine?: number
}

/**
 * Singleton definition from $catalog
 */
export interface Singleton {
  name: string
  methods: SingletonMethod[]
}

/**
 * Singleton definition with full method metadata ($metadata=full)
 */
export interface SingletonFull {
  name: string
  exposed: boolean
  methods: SingletonMethodFull[]
}

/**
 * Datastore-level method (exposed on $catalog, e.g. authentify)
 */
export interface DatastoreMethod {
  name: string
  applyTo?: string
  scope?: string
  from?: string
  allowedOnHTTPGET?: boolean
  exposed: boolean
  paramsText?: string
  filePath?: string
  startingLine?: number
  endingLine?: number
}

/**
 * $catalog response (list of dataclasses)
 */
export interface CatalogResponse {
  __UNIQID?: string
  dataClasses: Array<{
    name: string
    uri: string
    dataURI: string
  }>
  singletons?: Singleton[]
}

/**
 * $catalog/$all response (full catalog with attributes)
 */
export interface CatalogAllResponse {
  dataClasses: DataClass[]
  singletons?: Singleton[]
}

/**
 * DataClass short form (name, uri, dataURI) as returned in $catalog and $catalog/$all with $metadata=full
 */
export interface DataClassRef {
  name: string
  uri: string
  dataURI: string
}

/**
 * $catalog/$all response with $metadata=full (includes __UNIQID, __BASEID, __NAME, properties, full singleton method details, datastore methods).
 * dataClasses usually include full attributes (like $catalog/$all); some servers
 * return the short form (name, uri, dataURI) instead.
 */
export interface CatalogAllMetadataResponse {
  __UNIQID?: string
  __BASEID?: string
  __NAME?: string
  properties?: Record<string, unknown>
  dataClasses: Array<DataClass | DataClassRef>
  singletons?: SingletonFull[]
  methods?: DatastoreMethod[]
}

/**
 * $catalog/{dataClass} response
 */
export interface DataClassCatalogResponse extends DataClass {}
