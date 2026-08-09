import {
  buildAccessKeyLoginPrerequestEvent,
  buildPostmanUrl,
  POSTMAN_COLLECTION_SCHEMA,
  type PostmanBody,
  type PostmanCollection,
  type PostmanDescription,
  type PostmanItem,
  type PostmanQueryParam,
  type PostmanVariable,
} from '~/lib/postman'
import { toPostmanPath } from './path-placeholders'
import { formatPostmanRequestDocs } from './toolkit-docs'
import type {
  ToolkitInventory,
  ToolkitNode,
  ToolkitOperation,
  ToolkitVariables,
} from './toolkit-types'

function toPostmanBody(operation: ToolkitOperation): PostmanBody | undefined {
  if (!operation.body) return undefined
  if (operation.body.kind === 'formdata') {
    return {
      mode: 'formdata',
      formdata: operation.body.fields.map((field) => ({
        key: field.key,
        value: field.value,
        type: 'text' as const,
      })),
    }
  }
  return {
    mode: 'raw',
    raw: JSON.stringify(operation.body.value, null, 2),
    options: { raw: { language: 'json' } },
  }
}

function operationToItem(operation: ToolkitOperation): PostmanItem {
  const query: PostmanQueryParam[] = (operation.query ?? []).map((param) => {
    const disabled = param.disabled ?? !param.value.trim()
    return {
      key: param.key,
      value: param.value,
      ...(disabled ? { disabled: true } : {}),
      ...(param.description ? { description: param.description } : {}),
    }
  })
  const path = toPostmanPath(operation.path)
  const headers =
    operation.method === 'POST' && operation.body?.kind === 'json'
      ? [{ key: 'Content-Type', value: 'application/json' }]
      : []
  const body = toPostmanBody(operation)

  const docs = formatPostmanRequestDocs(operation.description, operation.docsUrl)
  const description: PostmanDescription | undefined = docs
    ? { content: docs, type: 'text/markdown' }
    : undefined
  return {
    name: operation.label,
    ...(description ? { description } : {}),
    request: {
      method: operation.method,
      header: headers,
      url: buildPostmanUrl({
        pathWithQuery: path,
        useBaseUrlVar: true,
        query,
      }),
      ...(body ? { body } : {}),
      ...(description ? { description } : {}),
    },
  }
}

function nodesToItems(nodes: ToolkitNode[]): PostmanItem[] {
  return nodes.map((node) => {
    if (node.type === 'operation') return operationToItem(node.operation)
    return {
      name: node.name,
      item: nodesToItems(node.children),
    }
  })
}

function buildVariables(variables: ToolkitVariables): PostmanVariable[] {
  return [
    { key: 'baseUrl', value: variables.baseUrl.replace(/\/$/, ''), type: 'string' },
    { key: 'accessKey', value: variables.accessKey, type: 'secret' },
    { key: 'username', value: variables.username, type: 'string' },
    { key: 'password', value: variables.password, type: 'secret' },
    { key: 'key', value: '1', type: 'string' },
    { key: 'stamp', value: '1', type: 'string' },
    { key: 'entitySetId', value: '', type: 'string' },
    { key: 'attribute', value: '', type: 'string' },
  ]
}

export function emitPostmanCollection(options: {
  inventory: ToolkitInventory
  name: string
  description?: string
  variables: ToolkitVariables
}): PostmanCollection {
  const includeLogin =
    options.variables.includeAccessKeyLogin && Boolean(options.variables.accessKey.trim())

  return {
    info: {
      name: options.name,
      ...(options.description?.trim() ? { description: options.description.trim() } : {}),
      schema: POSTMAN_COLLECTION_SCHEMA,
    },
    variable: buildVariables(options.variables),
    ...(includeLogin ? { event: [buildAccessKeyLoginPrerequestEvent()] } : {}),
    item: nodesToItems(options.inventory.nodes),
  }
}

export function restExportPostmanFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'collection'}.postman_collection.json`
}
