import type { CatalogWithMetadataExpanded } from '@4d/rest'
import {
  type MethodArgumentSchema,
  migrateParamsSchemaToArguments,
  parseMethodArguments,
} from '@4djs/assistant/tools'
import { filterAssistantExposedMethods } from './assistant-exposed-method'

export const ASSISTANT_METADATA_VERSION = 1 as const

export type { MethodArgumentSchema }

export interface MethodMetadata {
  description?: string
  /** Positional parameter schemas (4D REST passes a JSON array) */
  arguments?: MethodArgumentSchema[]
}

export interface DataclassMetadata {
  description?: string
  attributes?: Record<string, { description?: string }>
  methods?: Record<string, MethodMetadata>
}

export interface SingletonMetadata {
  description?: string
  methods?: Record<string, MethodMetadata>
}

export interface CatalogMethodMetadata extends MethodMetadata {}

export interface AssistantMetadataSchema {
  version: typeof ASSISTANT_METADATA_VERSION
  databaseName?: string
  updatedAt: string
  dataClasses: Record<string, DataclassMetadata>
  singletons: Record<string, SingletonMetadata>
  catalogMethods: Record<string, CatalogMethodMetadata>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function mergeMethodMetadata(existing: MethodMetadata | undefined, _name: string): MethodMetadata {
  return {
    description: existing?.description,
    arguments: existing?.arguments,
  }
}

function mergeDataclassMetadata(
  dc: CatalogWithMetadataExpanded['dataClasses'][number],
  existing: DataclassMetadata | undefined
): DataclassMetadata {
  const attributes: Record<string, { description?: string }> = {}
  for (const attr of dc.attributes ?? []) {
    attributes[attr.name] = {
      description: existing?.attributes?.[attr.name]?.description,
    }
  }

  const methods: Record<string, MethodMetadata> = {}
  for (const method of filterAssistantExposedMethods(dc.methods)) {
    if (!method.name) continue
    methods[method.name] = mergeMethodMetadata(existing?.methods?.[method.name], method.name)
  }

  return {
    description: existing?.description,
    attributes,
    methods,
  }
}

function mergeSingletonMetadata(
  singleton: NonNullable<CatalogWithMetadataExpanded['singletons']>[number],
  existing: SingletonMetadata | undefined
): SingletonMetadata {
  const methods: Record<string, MethodMetadata> = {}
  for (const method of filterAssistantExposedMethods(singleton.methods)) {
    if (!method.name) continue
    methods[method.name] = mergeMethodMetadata(existing?.methods?.[method.name], method.name)
  }

  return {
    description: existing?.description,
    methods,
  }
}

export function createEmptyMetadata(databaseName?: string): AssistantMetadataSchema {
  return {
    version: ASSISTANT_METADATA_VERSION,
    databaseName,
    updatedAt: new Date().toISOString(),
    dataClasses: {},
    singletons: {},
    catalogMethods: {},
  }
}

export function mergeCatalogIntoMetadata(
  catalog: CatalogWithMetadataExpanded,
  existing: AssistantMetadataSchema | null | undefined
): AssistantMetadataSchema {
  const databaseName = catalog.__NAME ?? existing?.databaseName
  const dataClasses: Record<string, DataclassMetadata> = {}

  for (const dc of catalog.dataClasses ?? []) {
    dataClasses[dc.name] = mergeDataclassMetadata(dc, existing?.dataClasses?.[dc.name])
  }

  const singletons: Record<string, SingletonMetadata> = {}
  for (const singleton of catalog.singletons ?? []) {
    singletons[singleton.name] = mergeSingletonMetadata(
      singleton,
      existing?.singletons?.[singleton.name]
    )
  }

  const catalogMethods: Record<string, CatalogMethodMetadata> = {}
  for (const method of filterAssistantExposedMethods(catalog.methods)) {
    if (!method.name) continue
    catalogMethods[method.name] = mergeMethodMetadata(
      existing?.catalogMethods?.[method.name],
      method.name
    )
  }

  return {
    version: ASSISTANT_METADATA_VERSION,
    databaseName,
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
    dataClasses,
    singletons,
    catalogMethods,
  }
}

function parseMethodMetadata(value: unknown): MethodMetadata | null {
  if (!isPlainObject(value)) return null
  const result: MethodMetadata = {}
  if (typeof value.description === 'string') result.description = value.description

  const directArgs = parseMethodArguments(value.arguments)
  if (directArgs) {
    result.arguments = directArgs
  } else if (isPlainObject(value.paramsSchema)) {
    const migrated = migrateParamsSchemaToArguments(value.paramsSchema)
    if (migrated) result.arguments = migrated
  }

  return result
}

function parseDataclassMetadata(value: unknown): DataclassMetadata | null {
  if (!isPlainObject(value)) return null
  const result: DataclassMetadata = {}
  if (typeof value.description === 'string') result.description = value.description

  if (isPlainObject(value.attributes)) {
    const attributes: Record<string, { description?: string }> = {}
    for (const [name, attr] of Object.entries(value.attributes)) {
      if (!isPlainObject(attr)) continue
      attributes[name] = {
        description: typeof attr.description === 'string' ? attr.description : undefined,
      }
    }
    result.attributes = attributes
  }

  if (isPlainObject(value.methods)) {
    const methods: Record<string, MethodMetadata> = {}
    for (const [name, method] of Object.entries(value.methods)) {
      const parsed = parseMethodMetadata(method)
      if (parsed) methods[name] = parsed
    }
    result.methods = methods
  }

  return result
}

function parseSingletonMetadata(value: unknown): SingletonMetadata | null {
  if (!isPlainObject(value)) return null
  const result: SingletonMetadata = {}
  if (typeof value.description === 'string') result.description = value.description

  if (isPlainObject(value.methods)) {
    const methods: Record<string, MethodMetadata> = {}
    for (const [name, method] of Object.entries(value.methods)) {
      const parsed = parseMethodMetadata(method)
      if (parsed) methods[name] = parsed
    }
    result.methods = methods
  }

  return result
}

export function parseMetadataSchema(json: unknown): AssistantMetadataSchema | null {
  if (!isPlainObject(json)) return null
  if (json.version !== ASSISTANT_METADATA_VERSION) return null

  const dataClasses: Record<string, DataclassMetadata> = {}
  if (isPlainObject(json.dataClasses)) {
    for (const [name, dc] of Object.entries(json.dataClasses)) {
      const parsed = parseDataclassMetadata(dc)
      if (parsed) dataClasses[name] = parsed
    }
  }

  const singletons: Record<string, SingletonMetadata> = {}
  if (isPlainObject(json.singletons)) {
    for (const [name, s] of Object.entries(json.singletons)) {
      const parsed = parseSingletonMetadata(s)
      if (parsed) singletons[name] = parsed
    }
  }

  const catalogMethods: Record<string, CatalogMethodMetadata> = {}
  if (isPlainObject(json.catalogMethods)) {
    for (const [name, method] of Object.entries(json.catalogMethods)) {
      const parsed = parseMethodMetadata(method)
      if (parsed) catalogMethods[name] = parsed
    }
  }

  return {
    version: ASSISTANT_METADATA_VERSION,
    databaseName: typeof json.databaseName === 'string' ? json.databaseName : undefined,
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : new Date().toISOString(),
    dataClasses,
    singletons,
    catalogMethods,
  }
}

function stripEmptyMethods(
  methods: Record<string, MethodMetadata>
): Record<string, MethodMetadata> | undefined {
  const result: Record<string, MethodMetadata> = {}
  for (const [name, method] of Object.entries(methods)) {
    const entry: MethodMetadata = {}
    if (method.description?.trim()) entry.description = method.description.trim()
    if (method.arguments?.length) entry.arguments = method.arguments
    if (Object.keys(entry).length > 0) result[name] = entry
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function compactMetadataForPrompt(
  metadata: AssistantMetadataSchema
): Record<string, unknown> | null {
  const dataClasses: Record<string, unknown> = {}
  for (const [name, dc] of Object.entries(metadata.dataClasses)) {
    const entry: Record<string, unknown> = {}
    if (dc.description?.trim()) entry.description = dc.description.trim()

    const attributes: Record<string, string> = {}
    for (const [attrName, attr] of Object.entries(dc.attributes ?? {})) {
      if (attr.description?.trim()) attributes[attrName] = attr.description.trim()
    }
    if (Object.keys(attributes).length > 0) entry.attributes = attributes

    const methods = stripEmptyMethods(dc.methods ?? {})
    if (methods) entry.methods = methods

    if (Object.keys(entry).length > 0) dataClasses[name] = entry
  }

  const singletons: Record<string, unknown> = {}
  for (const [name, s] of Object.entries(metadata.singletons)) {
    const entry: Record<string, unknown> = {}
    if (s.description?.trim()) entry.description = s.description.trim()
    const methods = stripEmptyMethods(s.methods ?? {})
    if (methods) entry.methods = methods
    if (Object.keys(entry).length > 0) singletons[name] = entry
  }

  const catalogMethods = stripEmptyMethods(metadata.catalogMethods)
  const compact: Record<string, unknown> = {}
  if (Object.keys(dataClasses).length > 0) compact.dataClasses = dataClasses
  if (Object.keys(singletons).length > 0) compact.singletons = singletons
  if (catalogMethods) compact.catalogMethods = catalogMethods
  if (metadata.databaseName) compact.databaseName = metadata.databaseName

  return Object.keys(compact).length > 0 ? compact : null
}

export function hasMetadataContent(metadata: AssistantMetadataSchema | null | undefined): boolean {
  if (!metadata) return false
  return compactMetadataForPrompt(metadata) !== null
}

export function formatMetadataForSystemPrompt(
  metadata: AssistantMetadataSchema | null | undefined
): string {
  if (!metadata) return ''
  const compact = compactMetadataForPrompt(metadata)
  if (!compact) return ''

  return `

## Database metadata

User-authored documentation for this database. Prefer these descriptions and method \`arguments\` schemas over guessing. Use \`@datastore/catalog\` for live entity counts and any fields not documented here.

\`\`\`json
${JSON.stringify(compact, null, 2)}
\`\`\``
}

export function sanitizeMetadataFilename(name: string): string {
  const trimmed = name.trim() || 'database'
  const sanitized = trimmed
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return sanitized || 'database'
}

export function touchMetadata(metadata: AssistantMetadataSchema): AssistantMetadataSchema {
  return {
    ...metadata,
    updatedAt: new Date().toISOString(),
  }
}
