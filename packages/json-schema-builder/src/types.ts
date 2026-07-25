import type { ComponentType } from 'react'

/** JSON Schema draft-07 / 2020-12 compatible type */
export type JSONSchemaTypeName =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array'

/** Composite schema keyword (no type, only one of these) */
export type JSONSchemaCompositeKeyword = 'oneOf' | 'anyOf' | 'allOf'

export interface JSONSchemaBase {
  title?: string
  description?: string
  default?: unknown
  examples?: unknown[]
  readOnly?: boolean
  writeOnly?: boolean
  deprecated?: boolean
}

export interface JSONSchemaObject extends JSONSchemaBase {
  type: 'object'
  properties?: Record<string, JSONSchema>
  required?: string[]
  additionalProperties?: boolean | JSONSchema
  patternProperties?: Record<string, JSONSchema>
  minProperties?: number
  maxProperties?: number
  propertyNames?: JSONSchema
  dependentRequired?: Record<string, string[]>
  dependentSchemas?: Record<string, JSONSchema>
  unevaluatedProperties?: boolean | JSONSchema
}

export interface JSONSchemaArray extends JSONSchemaBase {
  type: 'array'
  items?: JSONSchema | JSONSchema[]
  prefixItems?: JSONSchema[]
  additionalItems?: boolean | JSONSchema
  contains?: JSONSchema
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  minContains?: number
  maxContains?: number
  unevaluatedItems?: boolean | JSONSchema
}

export interface JSONSchemaString extends JSONSchemaBase {
  type: 'string'
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  enum?: string[]
  const?: string
}

export interface JSONSchemaNumber extends JSONSchemaBase {
  type: 'number' | 'integer'
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  enum?: number[]
  const?: number
}

export interface JSONSchemaBoolean extends JSONSchemaBase {
  type: 'boolean'
  enum?: boolean[]
  const?: boolean
}

export interface JSONSchemaNull extends JSONSchemaBase {
  type: 'null'
}

export interface JSONSchemaRef {
  $ref: string
}

export interface JSONSchemaOneOf {
  oneOf: JSONSchema[]
}

export interface JSONSchemaAnyOf {
  anyOf: JSONSchema[]
}

export interface JSONSchemaAllOf {
  allOf: JSONSchema[]
}

export type JSONSchema =
  | JSONSchemaObject
  | JSONSchemaArray
  | JSONSchemaString
  | JSONSchemaNumber
  | JSONSchemaBoolean
  | JSONSchemaNull
  | JSONSchemaRef
  | JSONSchemaOneOf
  | JSONSchemaAnyOf
  | JSONSchemaAllOf

export function isRef(schema: JSONSchema): schema is JSONSchemaRef {
  return schema !== null && typeof schema === 'object' && '$ref' in schema
}

export function isObjectSchema(schema: JSONSchema): schema is JSONSchemaObject {
  return (
    schema !== null && typeof schema === 'object' && (schema as JSONSchemaObject).type === 'object'
  )
}

export function isArraySchema(schema: JSONSchema): schema is JSONSchemaArray {
  return (
    schema !== null && typeof schema === 'object' && (schema as JSONSchemaArray).type === 'array'
  )
}

export function isCompositeSchema(
  schema: JSONSchema
): schema is JSONSchemaOneOf | JSONSchemaAnyOf | JSONSchemaAllOf {
  if (schema === null || typeof schema !== 'object') return false
  return 'oneOf' in schema || 'anyOf' in schema || 'allOf' in schema
}

export function getCompositeKeyword(schema: JSONSchema): JSONSchemaCompositeKeyword | null {
  if (schema === null || typeof schema !== 'object') return null
  if ('oneOf' in schema) return 'oneOf'
  if ('anyOf' in schema) return 'anyOf'
  if ('allOf' in schema) return 'allOf'
  return null
}

/** Root schema document: schema + optional $defs */
export interface JSONSchemaRoot {
  $schema?: string
  $id?: string
  $defs?: Record<string, JSONSchema>
  definitions?: Record<string, JSONSchema>
  [key: string]: unknown
}

/**
 * Props passed to plugin components when rendering in a spot.
 */
export interface SchemaBuilderPluginProps {
  schema: JSONSchema
  definitions: Record<string, JSONSchema>
  path: string[]
  /** Set when rendering a plugin's tab or toolbar; use with getPluginData/setPluginData to persist plugin state. */
  pluginId?: string
  /** When provided (e.g. by host app), code editors use these prefs instead of localStorage. */
  editorPrefs?: import('@4d/ui').EditorPrefs
  /** Called when user changes editor prefs (zoom, word wrap, minimap, toolbar position). */
  onEditorPrefsChange?: (partial: Partial<import('@4d/ui').EditorPrefs>) => void
}

/** Named layout spots where plugins can render. */
export type SchemaBuilderSpotId = 'toolbar' | 'tab'

/**
 * Plugin descriptor for SchemaBuilder. Layout is spot-based: plugins declare what they render in each spot.
 * - **toolbar**: optional. If provided, the plugin renders a control (e.g. Copy button) in the toolbar. No tab.
 * - **tab**: optional. If provided, the plugin gets a tab with `tabLabel` and renders `tabContent` when selected.
 * A plugin can render in one, both, or neither spot (e.g. copy-only plugin only uses toolbar).
 */
export interface SchemaBuilderPlugin {
  id: string
  /** Label for the tab (required if `tabContent` is set). */
  tabLabel?: string
  /** Render in the toolbar spot (e.g. ClickToCopy for copy schema). Return null to render nothing. */
  toolbar?: ComponentType<SchemaBuilderPluginProps>
  /** Content for the tab panel. If set, plugin gets a tab with `tabLabel`. */
  tabContent?: ComponentType<SchemaBuilderPluginProps>
}

/** Re-export from i18n for SchemaBuilder language / overrides. */
export type { SchemaBuilderLang, SchemaBuilderLangOrOverrides } from './i18n'

/** Default $schema URL used when includeSchemaAttr is true (draft 2020-12). */
export const DEFAULT_SCHEMA_DRAFT_URL = 'https://json-schema.org/draft/2020-12/schema'

/** Props for the root SchemaBuilder component */
export interface SchemaBuilderProps {
  value: JSONSchemaRoot | JSONSchema
  onChange: (value: JSONSchemaRoot | JSONSchema) => void
  plugins?: SchemaBuilderPlugin[]
  /** Show definitions sidebar by default */
  showDefinitions?: boolean
  /** When true (default), add $schema to generated/copied JSON. When false, omit it. */
  includeSchemaAttr?: boolean
  /** UI language: locale code ('en' | 'fr' | 'es') or object with optional base + partial overrides. Defaults to 'en'. */
  lang?: import('./i18n').SchemaBuilderLangOrOverrides
  /** When provided, code editors inside the builder use these prefs (e.g. from app profile). */
  editorPrefs?: import('@4d/ui').EditorPrefs
  /** Called when user changes editor prefs inside the builder. */
  onEditorPrefsChange?: (partial: Partial<import('@4d/ui').EditorPrefs>) => void
}
