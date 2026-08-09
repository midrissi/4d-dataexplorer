import {
  type OpenApiDocument,
  type OpenApiOperation,
  type OpenApiParameter,
  type OpenApiPathItem,
  type OpenApiRequestBody,
  restExportOpenApiFilename,
  serializeOpenApiDocument,
} from '~/lib/rest-export/emit-openapi'
import { REST_REQUEST_RESPONSES } from '~/lib/rest-export/toolkit-docs'
import { buildAccessKeyLoginItem } from './build-collection'
import type {
  PostmanBody,
  PostmanDescription,
  PostmanExportItemInput,
  PostmanExportVariableValues,
  PostmanItem,
  PostmanQueryParam,
  PostmanRequest,
  PostmanUrl,
} from './types'
import { baseUrlVariableHost } from './url'

export type RestCollectionExportType = 'postman' | 'openapi'

const OPENAPI_METHODS = ['get', 'put', 'post', 'patch', 'delete', 'head', 'options'] as const
type OpenApiMethod = (typeof OPENAPI_METHODS)[number]

export type EmitOpenApiFromItemsOptions = {
  name: string
  description?: string
  variables: PostmanExportVariableValues
  includeAccessKeyLogin: boolean
  items: PostmanExportItemInput[]
  defaultTag?: string
}

function descriptionText(value: PostmanDescription | undefined): string | undefined {
  if (!value) return undefined
  return typeof value === 'string' ? value : value.content
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function toOpenApiMethod(method: string): OpenApiMethod | null {
  const lower = method.trim().toLowerCase()
  return OPENAPI_METHODS.includes(lower as OpenApiMethod) ? (lower as OpenApiMethod) : null
}

function pathnameFromUrl(url: PostmanUrl): string {
  if (url.path && url.path.length > 0) {
    return `/${url.path.join('/')}`
  }
  const raw = url.raw || '/'
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname || '/'
    }
  } catch {
    // fall through
  }
  const withoutHost = raw.replace(/^\{\{baseUrl\}\}/, '')
  const q = withoutHost.indexOf('?')
  const path = q >= 0 ? withoutHost.slice(0, q) : withoutHost
  return path.startsWith('/') ? path : `/${path}`
}

function originFromUrl(url: PostmanUrl): string | undefined {
  if (url.host?.length === 1 && url.host[0] === baseUrlVariableHost()) return undefined
  const raw = url.raw || ''
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw)
      return parsed.origin
    }
  } catch {
    return undefined
  }
  return undefined
}

function toOpenApiPath(pathname: string): string {
  return pathname.replace(/\{\{([^{}]+)\}\}/g, '{$1}')
}

function pathParamNames(path: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of path.matchAll(/\{([^{}]+)\}/g)) {
    const name = match[1]
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function queryParams(query: PostmanQueryParam[] | undefined): OpenApiParameter[] {
  return (query ?? [])
    .filter((param) => !param.disabled && param.key.trim())
    .map((param) => ({
      name: param.key.trim(),
      in: 'query' as const,
      required: false,
      ...(param.description ? { description: param.description } : {}),
      schema: { type: 'string' },
      example: param.value,
    }))
}

function headerParams(request: PostmanRequest): OpenApiParameter[] {
  return (request.header ?? [])
    .filter((header) => !header.disabled && header.key.trim())
    .filter((header) => header.key.trim().toLowerCase() !== 'content-type')
    .map((header) => ({
      name: header.key.trim(),
      in: 'header' as const,
      required: false,
      ...(header.description ? { description: header.description } : {}),
      schema: { type: 'string' },
      example: header.value,
    }))
}

function contentTypeFromHeaders(request: PostmanRequest): string | undefined {
  const header = request.header?.find((item) => item.key.trim().toLowerCase() === 'content-type')
  return header?.value.trim() || undefined
}

function requestBodyFromPostman(
  body: PostmanBody | undefined,
  contentType?: string
): OpenApiRequestBody | undefined {
  if (!body) return undefined
  if (body.mode === 'urlencoded') {
    return {
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              body.urlencoded
                .filter((field) => !field.disabled && field.key.trim())
                .map((field) => [field.key.trim(), { type: 'string', example: field.value }])
            ),
          },
        },
      },
    }
  }
  if (body.mode === 'formdata') {
    return {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              body.formdata
                .filter((field) => !field.disabled && field.key.trim())
                .map((field) => [
                  field.key.trim(),
                  field.type === 'file' ? { type: 'string', format: 'binary' } : { type: 'string' },
                ])
            ),
          },
        },
      },
    }
  }
  if (body.mode === 'file') {
    return {
      required: true,
      content: {
        'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
      },
    }
  }
  const media =
    contentType ||
    (body.options?.raw.language === 'json'
      ? 'application/json'
      : body.options?.raw.language === 'xml'
        ? 'application/xml'
        : 'text/plain')
  let schema: Record<string, unknown> = { type: 'string' }
  if (body.options?.raw.language === 'json') {
    try {
      const parsed: unknown = JSON.parse(body.raw)
      schema = Array.isArray(parsed)
        ? { type: 'array', items: {} }
        : { type: 'object', additionalProperties: true }
    } catch {
      schema = { type: 'object', additionalProperties: true }
    }
  }
  return {
    required: true,
    content: { [media]: { schema } },
  }
}

function tagForItem(item: PostmanExportItemInput, fallback: string): string {
  const tag = item.tags?.find((value) => value.trim())?.trim()
  return tag || fallback
}

function requestFromItem(item: PostmanItem): PostmanRequest | null {
  return 'request' in item ? item.request : null
}

function toOperation(
  item: PostmanExportItemInput,
  request: PostmanRequest,
  path: string,
  defaultTag: string
): OpenApiOperation {
  const params: OpenApiParameter[] = [
    ...pathParamNames(path).map((name) => ({
      name,
      in: 'path' as const,
      required: true,
      schema: { type: 'string' },
    })),
    ...queryParams(request.url.query),
    ...headerParams(request),
  ]
  const body = requestBodyFromPostman(request.body, contentTypeFromHeaders(request))
  const tag = tagForItem(item, defaultTag)
  const docs = descriptionText(item.description) || descriptionText(request.description)
  return {
    operationId: slug(`${request.method}_${item.name}_${path}`) || 'op',
    summary: item.name,
    ...(docs ? { description: docs } : {}),
    tags: [tag],
    ...(params.length > 0 ? { parameters: params } : {}),
    ...(body ? { requestBody: body } : {}),
    responses: REST_REQUEST_RESPONSES,
  }
}

export function emitOpenApiFromPostmanItems(options: EmitOpenApiFromItemsOptions): OpenApiDocument {
  const defaultTag = options.defaultTag?.trim() || 'API'
  const paths: Record<string, OpenApiPathItem> = {}
  const tagSet = new Set<string>()
  const includeLogin = options.includeAccessKeyLogin && Boolean(options.variables.accessKey.trim())

  const requests: Array<{ item: PostmanExportItemInput; request: PostmanRequest }> = []
  for (const item of options.items) {
    const request = requestFromItem(item.item)
    if (request) requests.push({ item, request })
  }
  if (includeLogin) {
    const login = buildAccessKeyLoginItem()
    const request = requestFromItem(login)
    if (request) {
      requests.unshift({
        item: {
          id: 'auth:login',
          name: login.name,
          description: descriptionText('description' in login ? login.description : undefined),
          item: login as PostmanExportItemInput['item'],
        },
        request,
      })
    }
  }

  for (const { item, request } of requests) {
    const method = toOpenApiMethod(request.method)
    if (!method) continue
    const openApiPath = toOpenApiPath(pathnameFromUrl(request.url))
    const operation = toOperation(item, request, openApiPath, defaultTag)
    for (const tag of operation.tags ?? []) tagSet.add(tag)
    const customOrigin = originFromUrl(request.url)
    const existing = paths[openApiPath] ?? {}
    paths[openApiPath] = {
      ...existing,
      [method]: operation,
      ...(customOrigin ? { servers: [{ url: customOrigin }] } : {}),
    }
  }

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
        sessionCookie: { type: 'apiKey', in: 'cookie', name: '4DSID' },
      },
    },
    security: [{ sessionCookie: [] }],
  }
}

export { restExportOpenApiFilename as openApiDocumentFilename, serializeOpenApiDocument }
