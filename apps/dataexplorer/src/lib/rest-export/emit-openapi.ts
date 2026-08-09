import { pathParamNames } from './path-placeholders'
import { formatDocsDescription, REST_REQUEST_RESPONSES } from './toolkit-docs'
import type {
  ToolkitBody,
  ToolkitInventory,
  ToolkitNode,
  ToolkitOperation,
  ToolkitVariables,
} from './toolkit-types'

export type OpenApiParameter = {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  description?: string
  schema: { type: string }
  example?: string
}

export type OpenApiRequestBody = {
  required?: boolean
  content: Record<
    string,
    {
      schema: Record<string, unknown>
    }
  >
}

export type OpenApiOperation = {
  operationId: string
  summary: string
  description?: string
  externalDocs?: { url: string; description?: string }
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
  responses: Record<string, { description: string }>
  security?: Array<Record<string, string[]>>
}

export type OpenApiPathItem = {
  get?: OpenApiOperation
  put?: OpenApiOperation
  post?: OpenApiOperation
  patch?: OpenApiOperation
  delete?: OpenApiOperation
  head?: OpenApiOperation
  options?: OpenApiOperation
  servers?: Array<{ url: string }>
}

export type OpenApiDocument = {
  openapi: '3.1.0'
  info: {
    title: string
    description?: string
    version: string
  }
  servers?: Array<{ url: string }>
  tags?: Array<{ name: string }>
  paths: Record<string, OpenApiPathItem>
  components?: {
    securitySchemes?: Record<string, { type: string; in?: string; name?: string }>
  }
  security?: Array<Record<string, string[]>>
}

type TaggedOperation = {
  operation: ToolkitOperation
  tags: string[]
}

function walkTagged(nodes: ToolkitNode[], folderNames: string[], out: TaggedOperation[]): void {
  for (const node of nodes) {
    if (node.type === 'operation') {
      out.push({
        operation: node.operation,
        tags: folderNames.length > 0 ? [...folderNames] : ['API'],
      })
      continue
    }
    walkTagged(node.children, [...folderNames, node.name], out)
  }
}

function tagName(tags: string[]): string {
  if (tags.length === 0) return 'API'
  if (tags.length === 1) return tags[0] ?? 'API'
  const last = tags[tags.length - 1] ?? ''
  if (last === 'dataclass' || last === 'entity' || last === 'entitySelection') {
    const parent = tags[0] ?? 'API'
    return `${parent} · ${last}`
  }
  return tags[0] ?? 'API'
}

function jsonSchemaForBody(body: ToolkitBody): Record<string, unknown> {
  if (body.kind === 'formdata') {
    return {
      type: 'object',
      properties: Object.fromEntries(body.fields.map((field) => [field.key, { type: 'string' }])),
    }
  }
  if (Array.isArray(body.value)) {
    return { type: 'array', items: {} }
  }
  if (body.value && typeof body.value === 'object') {
    return { type: 'object', additionalProperties: true }
  }
  return { type: 'object', additionalProperties: true }
}

function requestBody(operation: ToolkitOperation): OpenApiRequestBody | undefined {
  if (!operation.body) return undefined
  const media = operation.body.kind === 'formdata' ? 'multipart/form-data' : 'application/json'
  return {
    required: true,
    content: {
      [media]: { schema: jsonSchemaForBody(operation.body) },
    },
  }
}

function parameters(operation: ToolkitOperation): OpenApiParameter[] {
  const params: OpenApiParameter[] = []
  const names = new Set(
    operation.pathParams?.map((param) => param.name) ?? pathParamNames(operation.path)
  )
  for (const name of names) {
    const extra = operation.pathParams?.find((param) => param.name === name)
    params.push({
      name,
      in: 'path',
      required: true,
      description: extra?.description,
      schema: { type: 'string' },
      ...(extra?.example ? { example: extra.example } : {}),
    })
  }
  for (const query of operation.query ?? []) {
    params.push({
      name: query.key,
      in: 'query',
      required: false,
      description: query.description,
      schema: { type: 'string' },
      example: query.value,
    })
  }
  return params
}

function toOpenApiOperation(entry: TaggedOperation): OpenApiOperation {
  const { operation, tags } = entry
  const body = requestBody(operation)
  const params = parameters(operation)
  const description = formatDocsDescription(operation.description, operation.docsUrl)
  return {
    operationId: operation.operationId,
    summary: operation.label,
    ...(description ? { description } : {}),
    ...(operation.docsUrl
      ? { externalDocs: { url: operation.docsUrl, description: '4D Docs' } }
      : {}),
    tags: [tagName(tags)],
    ...(params.length > 0 ? { parameters: params } : {}),
    ...(body ? { requestBody: body } : {}),
    responses: REST_REQUEST_RESPONSES,
  }
}

function mergeOperations(a: OpenApiOperation, b: OpenApiOperation): OpenApiOperation {
  const paramsByKey = new Map<string, OpenApiParameter>()
  for (const param of [...(a.parameters ?? []), ...(b.parameters ?? [])]) {
    const key = `${param.in}:${param.name}`
    if (!paramsByKey.has(key)) paramsByKey.set(key, param)
  }
  const tags = [...new Set([...(a.tags ?? []), ...(b.tags ?? [])])]
  return {
    ...a,
    summary: a.summary === b.summary ? a.summary : `${a.summary} / ${b.summary}`,
    description: [a.description, b.description].filter(Boolean).join('\n\n') || undefined,
    externalDocs: a.externalDocs ?? b.externalDocs,
    tags,
    parameters: [...paramsByKey.values()],
    requestBody: a.requestBody ?? b.requestBody,
  }
}

export function emitOpenApiDocument(options: {
  inventory: ToolkitInventory
  name: string
  description?: string
  variables: ToolkitVariables
}): OpenApiDocument {
  const tagged: TaggedOperation[] = []
  walkTagged(options.inventory.nodes, [], tagged)

  const paths: Record<string, OpenApiPathItem> = {}
  const tagSet = new Set<string>()

  for (const entry of tagged) {
    const method = entry.operation.method.toLowerCase() as 'get' | 'post'
    const path = entry.operation.path
    const next = toOpenApiOperation(entry)
    for (const tag of next.tags ?? []) tagSet.add(tag)

    const existing = paths[path] ?? {}
    const previous = existing[method]
    paths[path] = {
      ...existing,
      [method]: previous ? mergeOperations(previous, next) : next,
    }
  }

  const includeLogin =
    options.variables.includeAccessKeyLogin && Boolean(options.variables.accessKey.trim())

  return {
    openapi: '3.1.0',
    info: {
      title: options.name,
      ...(options.description?.trim() ? { description: options.description.trim() } : {}),
      version: '1.0.0',
    },
    servers: [{ url: options.variables.baseUrl.replace(/\/$/, '') || 'http://localhost' }],
    tags: [...tagSet].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: '4DSID',
        },
        ...(includeLogin
          ? {
              accessKey: {
                type: 'apiKey',
                in: 'cookie',
                name: 'accessKey',
              },
            }
          : {}),
      },
    },
    security: [{ sessionCookie: [] }],
  }
}

export function serializeOpenApiDocument(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

export function restExportOpenApiFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'openapi'}.openapi.json`
}
