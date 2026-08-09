import type { ToolkitEmojiConfig, ToolkitEmojiKey } from './toolkit-emoji'

export type { ToolkitEmojiConfig, ToolkitEmojiKey }

export type RestExportType = 'postman' | 'openapi'

export type ToolkitHttpMethod = 'GET' | 'POST'

export type ToolkitQueryParam = {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export type ToolkitPathParam = {
  name: string
  example: string
  description?: string
}

export type ToolkitBody =
  | { kind: 'json'; value: unknown }
  | { kind: 'formdata'; fields: Array<{ key: string; value: string }> }

export type ToolkitOperation = {
  id: string
  /** Emoji + label for Postman name / OpenAPI summary. */
  label: string
  /** ASCII operationId without emoji. */
  operationId: string
  emojiKey?: ToolkitEmojiKey
  method: ToolkitHttpMethod
  /** Path from origin, e.g. `/rest/Company({key})` or `/api/login`. */
  path: string
  query?: ToolkitQueryParam[]
  pathParams?: ToolkitPathParam[]
  body?: ToolkitBody
  description?: string
  /** Official 4D REST documentation URL, when includeDocs is enabled. */
  docsUrl?: string
}

export type ToolkitFolderNode = {
  type: 'folder'
  id: string
  name: string
  emojiKey?: ToolkitEmojiKey
  children: ToolkitNode[]
}

export type ToolkitOperationNode = {
  type: 'operation'
  operation: ToolkitOperation
}

export type ToolkitNode = ToolkitFolderNode | ToolkitOperationNode

export type ToolkitInventory = {
  nodes: ToolkitNode[]
}

export type ToolkitCategoryFlags = {
  auth: boolean
  catalog: boolean
  info: boolean
  datastoreFunctions: boolean
  singletons: boolean
  crudList: boolean
  crudCreate: boolean
  crudGet: boolean
  crudUpdate: boolean
  crudDeleteByKey: boolean
  entitySetCreate: boolean
  entitySetPage: boolean
  entitySetClean: boolean
  entitySetRelease: boolean
  functions: boolean
  deleteAll: boolean
  deleteByFilter: boolean
  deleteEntitySet: boolean
  compute: boolean
  directoryLogin: boolean
  httpGetVariants: boolean
  includeNonExposed: boolean
}

export type ToolkitVariables = {
  baseUrl: string
  accessKey: string
  username: string
  password: string
  includeAccessKeyLogin: boolean
}

export type ToolkitConfig = {
  name: string
  description: string
  selectedDataClasses: string[]
  selectedSingletons: string[]
  categories: ToolkitCategoryFlags
  variables: ToolkitVariables
  exportType: RestExportType
  emoji: ToolkitEmojiConfig
  /** Attach official 4D REST docs (description + link) on each request. */
  includeDocs: boolean
}

export type ToolkitCatalogMethod = {
  name: string
  applyTo?: string
  exposed?: boolean
  allowedOnHTTPGET?: boolean
  paramsText?: string
  scope?: string
}

export type ToolkitCatalogDataClass = {
  name: string
  methods?: ToolkitCatalogMethod[]
  attributes?: Array<{ name: string; kind?: string }>
}

export type ToolkitCatalogSingleton = {
  name: string
  methods?: ToolkitCatalogMethod[]
}

/** Minimal catalog shape used by the inventory builder (from `api.getCatalog()`). */
export type ToolkitCatalogInput = {
  dataClasses: ToolkitCatalogDataClass[]
  singletons?: ToolkitCatalogSingleton[]
  methods?: ToolkitCatalogMethod[]
}
