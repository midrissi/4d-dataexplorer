/**
 * Method types for $method parameter
 */
export type QueryMethod = 'entityset' | 'delete' | 'update' | 'release' | 'subentityset'

/**
 * Compute operations
 */
export type ComputeOperation = 'sum' | 'average' | 'count' | 'min' | 'max' | '$all'

/**
 * Order direction
 */
export type OrderDirection = 'asc' | 'desc' | 'ASC' | 'DESC'

/**
 * Image format options
 */
export type ImageFormat = 'best' | 'gif' | 'png' | 'jpeg' | 'tiff'

/**
 * Query options for REST requests
 */
export interface QueryOptions extends Record<string, unknown> {
  /** Filter expression */
  $filter?: string
  /** Parameter values for placeholders in filter */
  $params?: string
  /** Order by expression */
  $orderby?: string
  /** Maximum number of entities to return */
  $top?: number
  /** Alias for $top */
  $limit?: number
  /** Number of entities to skip */
  $skip?: number
  /** Attributes to return */
  $attributes?: string
  /** Expand relations (for images/blobs) */
  $expand?: string
  /** Method to execute */
  $method?: QueryMethod
  /** Timeout for entity set (in seconds) */
  $timeout?: number
  /** Save filter for entity set recreation */
  $savedfilter?: boolean
  /** Save orderby for entity set recreation */
  $savedorderby?: boolean
  /** Compute aggregation */
  $compute?: ComputeOperation
  /** Image format */
  $imageformat?: ImageFormat
  /** Version for images */
  $version?: number
  /** Return binary data */
  $binary?: boolean
  /** Return as array */
  $asArray?: boolean
  /** Clean undefined entity references */
  $clean?: boolean
  /** Distinct values */
  $distinct?: boolean
  /** Query path info */
  $querypath?: boolean
  /** Query plan info */
  $queryplan?: boolean
  /** Atomic transaction */
  $atomic?: boolean
  /** Alias for $atomic */
  $atOnce?: boolean
}

/**
 * Entity set logical operators
 */
export type EntitySetOperator = 'AND' | 'OR' | 'EXCEPT' | 'INTERSECT'

/**
 * Entity set query options
 */
export interface EntitySetQueryOptions extends QueryOptions {
  $logicOperator?: EntitySetOperator
  $otherCollection?: string
}

/**
 * Order by entry
 */
export interface OrderByEntry {
  attribute: string
  direction: OrderDirection
}

/**
 * Filter with params
 */
export interface FilterWithParams {
  expression: string
  params: unknown[]
}
