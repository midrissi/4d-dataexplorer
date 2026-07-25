import type {
  JSONSchema,
  JSONSchemaCompositeKeyword,
  JSONSchemaRoot,
  JSONSchemaTypeName,
} from '../types'
import { getCompositeKeyword, isRef } from '../types'

/** Normalize value to a root document (with $defs if present) */
export function getRootSchema(value: JSONSchemaRoot | JSONSchema): JSONSchemaRoot {
  if (value === null || value === undefined) {
    return { type: 'object', properties: {}, $defs: {} }
  }
  const v = value as Record<string, unknown>
  if (v.$defs !== undefined || v.definitions !== undefined || v.type === undefined) {
    return value as JSONSchemaRoot
  }
  return { ...value, $defs: (value as JSONSchemaRoot).$defs ?? {} } as JSONSchemaRoot
}

/** Get definitions from root ($defs preferred, fallback definitions) */
export function getDefs(root: JSONSchemaRoot): Record<string, JSONSchema> {
  if (!root) return {}
  const defs =
    (root as Record<string, unknown>).$defs ?? (root as Record<string, unknown>).definitions
  return (defs as Record<string, JSONSchema>) ?? {}
}

/** Get schema at path (path = ['properties','foo'] or ['items', '0'] for tuple) */
export function getAtPath(root: unknown, path: string[]): unknown {
  let cur: unknown = root
  for (const p of path) {
    if (cur === null || cur === undefined) return undefined
    if (Array.isArray(cur) && /^\d+$/.test(p)) {
      cur = cur[Number.parseInt(p, 10)]
    } else {
      cur = (cur as Record<string, unknown>)[p]
    }
  }
  return cur
}

/** Set schema at path; returns new root (immutable) */
export function setAtPath(root: JSONSchemaRoot, path: string[], value: JSONSchema): JSONSchemaRoot {
  if (path.length === 0) {
    const out = { ...value, $defs: root.$defs, definitions: root.definitions } as JSONSchemaRoot
    return out
  }
  const updated = setAtPathInner(root, path, value)
  const out = updated as JSONSchemaRoot
  // Only preserve root $defs/definitions when we did not just update them (otherwise we'd overwrite the change)
  if (path[0] !== '$defs') out.$defs = root.$defs ?? out.$defs
  if (path[0] !== 'definitions') out.definitions = root.definitions ?? out.definitions
  return out
}

function setAtPathInner(
  obj: Record<string, unknown> | unknown[],
  path: string[],
  value: JSONSchema
): Record<string, unknown> | unknown[] {
  const [head, ...rest] = path
  if (rest.length === 0) {
    if (Array.isArray(obj)) {
      const arr = [...obj]
      const idx = Number.parseInt(head, 10)
      arr[idx] = value
      return arr
    }
    return { ...(obj as Record<string, unknown>), [head]: value }
  }
  const isArray = Array.isArray(obj)
  const key = head
  const idx = /^\d+$/.test(head) ? Number.parseInt(head, 10) : -1
  const child = isArray ? (obj as unknown[])[idx] : (obj as Record<string, unknown>)[key]
  const newChild = setAtPathInner(
    (child !== undefined && child !== null
      ? Array.isArray(child)
        ? child
        : (child as Record<string, unknown>)
      : {}) as Record<string, unknown> | unknown[],
    rest,
    value
  )
  if (Array.isArray(obj)) {
    const arr = [...obj]
    arr[idx] = newChild
    return arr
  }
  return { ...(obj as Record<string, unknown>), [key]: newChild }
}

/** Deep clone for schema (to avoid mutating when adding to $defs) */
export function cloneSchema(schema: JSONSchema): JSONSchema {
  if (schema === null || typeof schema !== 'object') return schema
  if (Array.isArray(schema)) return schema.map(cloneSchema) as unknown as JSONSchema
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema)) {
    out[k] =
      typeof v === 'object' && v !== null && !Array.isArray(v)
        ? cloneSchema(v as JSONSchema)
        : Array.isArray(v)
          ? v.map((item) =>
              typeof item === 'object' && item !== null ? cloneSchema(item as JSONSchema) : item
            )
          : v
  }
  return out as unknown as JSONSchema
}

/** Default schema for a given type */
export function defaultSchemaForType(type: JSONSchemaTypeName): JSONSchema {
  switch (type) {
    case 'string':
      return { type: 'string' }
    case 'number':
      return { type: 'number' }
    case 'integer':
      return { type: 'integer' }
    case 'boolean':
      return { type: 'boolean' }
    case 'null':
      return { type: 'null' }
    case 'object':
      return { type: 'object', properties: {} }
    case 'array':
      return { type: 'array', items: { type: 'string' } }
    default:
      return { type: 'object', properties: {} }
  }
}

/** Default schema for composite keyword */
export function defaultSchemaForComposite(keyword: JSONSchemaCompositeKeyword): JSONSchema {
  return { [keyword]: [{ type: 'string' }] } as unknown as JSONSchema
}

/** Check if array schema uses tuple items (items is array) */
export function isTupleItems(schema: JSONSchema): boolean {
  if (!schema || typeof schema !== 'object' || (schema as { type?: string }).type !== 'array')
    return false
  const items = (schema as { items?: JSONSchema | JSONSchema[] }).items
  return Array.isArray(items)
}

/** Convert node at path to a definition and replace with $ref */
export function convertToDefinition(
  root: JSONSchemaRoot,
  path: string[],
  definitionId: string
): JSONSchemaRoot {
  const defs = getDefs(root)
  const schemaAtPath = getAtPath(root, path) as JSONSchema
  if (schemaAtPath === undefined) return root
  const cloned = cloneSchema(schemaAtPath)
  const newDefs = { ...defs, [definitionId]: cloned }
  const refSchema: JSONSchema = { $ref: `#/$defs/${definitionId}` }
  const newRoot = setAtPath(root, path, refSchema)
  ;(newRoot as Record<string, unknown>).$defs = newDefs
  return newRoot
}

const ROOT_META_KEYS = new Set(['$defs', 'definitions', '$schema', '$id'])

/** Convert the root schema body to a definition and replace root with $ref to it */
export function convertRootToDefinition(
  root: JSONSchemaRoot,
  definitionId: string
): JSONSchemaRoot {
  const defs = getDefs(root)
  const rootRecord = root as Record<string, unknown>
  const schemaPart: Record<string, unknown> = {}
  for (const key of Object.keys(rootRecord)) {
    if (ROOT_META_KEYS.has(key)) continue
    schemaPart[key] = rootRecord[key]
  }
  if (Object.keys(schemaPart).length === 0) return root
  const cloned = cloneSchema(schemaPart as unknown as JSONSchema)
  const newDefs = { ...defs, [definitionId]: cloned }
  const newRoot: JSONSchemaRoot = {
    $ref: `#/$defs/${definitionId}`,
    $defs: newDefs,
  } as JSONSchemaRoot
  if (rootRecord.definitions !== undefined)
    (newRoot as Record<string, unknown>).definitions = rootRecord.definitions
  return newRoot
}

/** Get schema type for display (type field, $ref, or oneOf/anyOf/allOf) */
export function getSchemaType(
  schema: JSONSchema
): 'ref' | JSONSchemaTypeName | JSONSchemaCompositeKeyword | null {
  if (!schema || typeof schema !== 'object') return null
  if (isRef(schema)) return 'ref'
  const composite = getCompositeKeyword(schema)
  if (composite) return composite
  const t = (schema as { type?: string }).type
  if (typeof t === 'string') return t as JSONSchemaTypeName
  return null
}

/** Create next available definition id */
export function nextDefinitionId(defs: Record<string, JSONSchema>): string {
  let n = 0
  while (`Definition_${n}` in defs) n++
  return `Definition_${n}`
}
