import { api } from './api'

// =============================================================================
// Types
// =============================================================================

type AttributeSets = {
  primaryKey: string | undefined
  relationEntityAttributeNames: Set<string>
  relationEntitiesAttributeNames: Set<string>
  blobImageAttributeNames: Set<string>
  readonlyAttributeNames: Set<string>
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch schema and create sets of attribute names by type
 */
async function getAttributeSets(dataclassName: string): Promise<AttributeSets> {
  const schema = await api.getDataclassSchema(dataclassName)
  return {
    primaryKey: schema.key,
    relationEntityAttributeNames: new Set(
      schema.attributes.filter((attr) => attr.kind === 'relatedEntity').map((attr) => attr.name)
    ),
    relationEntitiesAttributeNames: new Set(
      schema.attributes.filter((attr) => attr.kind === 'relatedEntities').map((attr) => attr.name)
    ),
    blobImageAttributeNames: new Set(
      schema.attributes
        .filter((attr) => attr.type === 'blob' || attr.type === 'image')
        .map((attr) => attr.name)
    ),
    readonlyAttributeNames: new Set(
      schema.attributes.filter((attr) => attr.readOnly).map((attr) => attr.name)
    ),
  }
}

/**
 * Check if a key is a system field
 */
function isSystemField(key: string, includeId = false): boolean {
  if (key === '__TIMESTAMP' || key === '__KEY' || key === '__STAMP') {
    return true
  }
  if (includeId && key === 'id') {
    return true
  }
  return false
}

/**
 * Remove system fields from an entity (fallback when schema fetch fails)
 */
function removeSystemFields(
  entity: Record<string, unknown>,
  includeId = false
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (!isSystemField(key, includeId)) {
      filtered[key] = value
    }
  }
  return filtered
}

/**
 * Remove __STATUS field from an entity (used after updates)
 */
export function removeStatusField(entity: Record<string, unknown>): Record<string, unknown> {
  const { __STATUS: _status, ...filtered } = entity
  return filtered
}

// =============================================================================
// Public Functions
// =============================================================================

/**
 * Sanitize an entity for JSON editing.
 * Removes: __TIMESTAMP, relation attributes (relatedEntity/relatedEntities), primary key, blob and image attributes, readonly attributes
 */
export async function sanitizeForEditing(
  entity: Record<string, unknown>,
  dataclassName: string | null
): Promise<Record<string, unknown>> {
  if (!dataclassName) {
    return entity
  }

  try {
    const attributeSets = await getAttributeSets(dataclassName)

    // Create filtered copy
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(entity)) {
      // Skip system fields
      if (isSystemField(key)) continue
      // Skip primary key
      if (key === attributeSets.primaryKey) continue
      // Skip all relation attributes (relatedEntity and relatedEntities)
      if (
        attributeSets.relationEntityAttributeNames.has(key) ||
        attributeSets.relationEntitiesAttributeNames.has(key)
      ) {
        continue
      }
      // Skip blob and image attributes
      if (attributeSets.blobImageAttributeNames.has(key)) continue
      // Skip readonly attributes
      if (attributeSets.readonlyAttributeNames.has(key)) continue
      filtered[key] = value
    }

    return filtered
  } catch {
    // If schema fetch fails, still filter out __TIMESTAMP
    return removeSystemFields(entity)
  }
}

/**
 * Sanitize an entity for duplication.
 * Removes: __TIMESTAMP, __KEY, __STAMP, id, primary key, relation attributes (relatedEntity/relatedEntities), blob/image attributes, readonly attributes
 */
export async function sanitizeForDuplication(
  entity: Record<string, unknown>,
  dataclassName: string | null
): Promise<Record<string, unknown>> {
  if (!dataclassName) {
    // Fallback: just remove system fields (including id)
    return removeSystemFields(entity, true)
  }

  try {
    const attributeSets = await getAttributeSets(dataclassName)

    // Create filtered copy
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(entity)) {
      // Skip system fields (including id)
      if (isSystemField(key, true)) continue
      // Skip primary key
      if (key === attributeSets.primaryKey) continue
      // Skip all relation attributes (relatedEntity and relatedEntities)
      if (
        attributeSets.relationEntityAttributeNames.has(key) ||
        attributeSets.relationEntitiesAttributeNames.has(key)
      ) {
        continue
      }
      // Skip blob and image attributes
      if (attributeSets.blobImageAttributeNames.has(key)) continue
      // Skip readonly attributes
      if (attributeSets.readonlyAttributeNames.has(key)) continue
      filtered[key] = value
    }

    return filtered
  } catch {
    // If schema fetch fails, just remove system fields (including id)
    return removeSystemFields(entity, true)
  }
}
