import type { Entity, EntityCollection, EntityMutationResult } from '../types'

type EntityMutationResponse<T extends Entity> =
  | EntityMutationResult<T>[]
  | EntityCollection<T>
  | EntityMutationResult<T>
  | null
  | undefined

/** Normalize 4D REST bulk create/update responses to a flat entity array. */
export function normalizeEntityMutationResults<T extends Entity = Entity>(
  response: EntityMutationResponse<T>
): EntityMutationResult<T>[] {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (
    typeof response === 'object' &&
    '__ENTITIES' in response &&
    Array.isArray(response.__ENTITIES)
  ) {
    return response.__ENTITIES as unknown as EntityMutationResult<T>[]
  }
  if (typeof response === 'object' && '__KEY' in response) {
    return [response as EntityMutationResult<T>]
  }
  return []
}
