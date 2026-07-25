/**
 * Base entity interface - all 4D entities have these properties
 */
export interface Entity {
  __KEY: string
  __STAMP: number
  __TIMESTAMP?: string
  __DATACLASS?: string
}

/**
 * Deferred relation reference
 */
export interface DeferredRelation {
  __deferred: {
    uri: string
    __KEY?: string
    image?: boolean
  }
}

/**
 * Entity collection returned from queries
 */
export interface EntityCollection<T extends Entity = Entity> {
  __entityModel: string
  __GlobalStamp?: number
  __COUNT: number
  __SENT: number
  __FIRST: number
  __ENTITIES: T[]
  __ENTITYSET?: string
}

/**
 * Entity set information
 */
export interface EntitySetInfo {
  __ENTITYSET: string
  __entityModel: string
  __COUNT: number
  __SENT: number
  __FIRST: number
}

/**
 * Single entity response
 */
export interface EntityResponse<_T extends Entity = Entity> extends Entity {
  __entityModel: string
  uri?: string
}

/**
 * Entity status after update operations
 */
export interface EntityStatus {
  __STATUS?: {
    status: number
    statusText: string
    success: boolean
  }
}

/**
 * Result of update/create operations
 */
export interface EntityMutationResult<T extends Entity = Entity>
  extends EntityResponse<T>,
    EntityStatus {}

/**
 * Delete operation result
 */
export interface DeleteResult {
  ok: boolean
}

/**
 * Compute result for aggregations
 */
export interface ComputeResult {
  [attribute: string]: {
    count?: number
    sum?: number
    average?: number
    min?: number | string
    max?: number | string
  }
}

/**
 * Simple compute result (single value)
 */
export type SimpleComputeResult = number | string
