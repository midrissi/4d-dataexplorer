import { applyToolkitDocs } from './toolkit-docs'
import {
  DEFAULT_TOOLKIT_EMOJI,
  formatToolkitTitle,
  PLAIN_FOLDERS,
  PLAIN_LABELS,
  type ToolkitEmojiConfig,
  type ToolkitEmojiKey,
} from './toolkit-emoji'
import type {
  ToolkitBody,
  ToolkitCatalogDataClass,
  ToolkitCatalogInput,
  ToolkitCatalogMethod,
  ToolkitCategoryFlags,
  ToolkitConfig,
  ToolkitFolderNode,
  ToolkitHttpMethod,
  ToolkitInventory,
  ToolkitNode,
  ToolkitOperation,
  ToolkitPathParam,
  ToolkitQueryParam,
} from './toolkit-types'

const AUTHENTIFY = 'authentify'

type FunctionScope = 'dataclass' | 'entity' | 'entitySelection'

function slug(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function operationId(...parts: string[]): string {
  return parts.map(slug).filter(Boolean).join('_') || 'op'
}

function withEmptyQueryParamsDisabled(query: ToolkitQueryParam[]): ToolkitQueryParam[] {
  return query.map((param) => {
    if (param.disabled != null || param.value.trim()) return param
    return { ...param, disabled: true }
  })
}

function op(input: {
  id: string
  label: string
  operationId: string
  emojiKey?: ToolkitEmojiKey
  method: ToolkitHttpMethod
  path: string
  query?: ToolkitQueryParam[]
  pathParams?: ToolkitPathParam[]
  body?: ToolkitBody
  description?: string
}): ToolkitOperation {
  return {
    id: input.id,
    label: input.label,
    operationId: input.operationId,
    method: input.method,
    path: input.path,
    ...(input.emojiKey ? { emojiKey: input.emojiKey } : {}),
    ...(input.query && input.query.length > 0
      ? { query: withEmptyQueryParamsDisabled(input.query) }
      : {}),
    ...(input.pathParams && input.pathParams.length > 0 ? { pathParams: input.pathParams } : {}),
    ...(input.body ? { body: input.body } : {}),
    ...(input.description ? { description: input.description } : {}),
  }
}

function folder(
  id: string,
  name: string,
  children: ToolkitNode[],
  emojiKey?: ToolkitEmojiKey
): ToolkitFolderNode | null {
  if (children.length === 0) return null
  return { type: 'folder', id, name, children, ...(emojiKey ? { emojiKey } : {}) }
}

function applyEmojis(nodes: ToolkitNode[], emoji: ToolkitEmojiConfig): ToolkitNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      return {
        ...node,
        name: formatToolkitTitle(node.name, node.emojiKey, emoji),
        children: applyEmojis(node.children, emoji),
      }
    }
    return {
      ...node,
      operation: {
        ...node.operation,
        label: formatToolkitTitle(node.operation.label, node.operation.emojiKey, emoji),
      },
    }
  })
}

function operationNode(operation: ToolkitOperation): ToolkitNode {
  return { type: 'operation', operation }
}

function scopeFromApplyTo(applyTo?: string): FunctionScope {
  if (applyTo === 'entity') return 'entity'
  if (
    applyTo === 'entitySelection' ||
    applyTo === 'entityCollection' ||
    applyTo === 'dataClassSelection'
  ) {
    return 'entitySelection'
  }
  return 'dataclass'
}

function isMethodIncluded(method: ToolkitCatalogMethod, includeNonExposed: boolean): boolean {
  if (includeNonExposed) return true
  return method.exposed === true
}

function jsonBody(value: unknown): ToolkitBody {
  return { kind: 'json', value }
}

function formBody(fields: Array<{ key: string; value: string }>): ToolkitBody {
  return { kind: 'formdata', fields }
}

function keyParam(): ToolkitPathParam {
  return { name: 'key', example: '1', description: 'Entity primary key' }
}

function entitySetParam(): ToolkitPathParam {
  return { name: 'entitySetId', example: '', description: 'Server entity set ID' }
}

function firstStorageAttribute(dataClass: ToolkitCatalogDataClass): string {
  const storage = dataClass.attributes?.find((attr) => !attr.kind || attr.kind === 'storage')
  return storage?.name || dataClass.attributes?.[0]?.name || '{attribute}'
}

function functionQuery(options?: { filter?: boolean; entitySet?: boolean }): ToolkitQueryParam[] {
  const query: ToolkitQueryParam[] = [{ key: '$method', value: 'entityset' }]
  if (options?.filter && !options.entitySet) {
    query.push({ key: '$filter', value: '', description: 'ORDA filter expression' })
    query.push({ key: '$orderby', value: '' })
  }
  return query
}

function buildFunctionOps(options: {
  idPrefix: string
  operationIdPrefix: string[]
  method: ToolkitCatalogMethod
  postPath: string
  getPath?: string
  label: (name: string) => string
  getLabel: (name: string) => string
  emojiKey: ToolkitEmojiKey
  getEmojiKey?: ToolkitEmojiKey
  query?: ToolkitQueryParam[]
  pathParams?: ToolkitPathParam[]
  httpGetVariants: boolean
  description?: string
}): ToolkitOperation[] {
  const name = options.method.name
  const ops: ToolkitOperation[] = [
    op({
      id: `${options.idPrefix}:post`,
      label: options.label(name),
      operationId: operationId(...options.operationIdPrefix, name),
      emojiKey: options.emojiKey,
      method: 'POST',
      path: options.postPath,
      query: options.query,
      pathParams: options.pathParams,
      body: jsonBody([]),
      description: options.description ?? options.method.paramsText,
    }),
  ]

  if (options.httpGetVariants && options.method.allowedOnHTTPGET) {
    ops.push(
      op({
        id: `${options.idPrefix}:get`,
        label: options.getLabel(name),
        operationId: operationId(...options.operationIdPrefix, name, 'GET'),
        emojiKey: options.getEmojiKey ?? options.emojiKey,
        method: 'GET',
        path: options.getPath ?? options.postPath,
        query: options.query,
        pathParams: options.pathParams,
        description: options.description ?? options.method.paramsText,
      })
    )
  }

  return ops
}

function buildAuthFolder(config: ToolkitConfig): ToolkitFolderNode | null {
  if (!config.categories.auth) return null
  const children: ToolkitNode[] = []
  const { variables } = config

  if (variables.includeAccessKeyLogin && variables.accessKey.trim()) {
    children.push(
      operationNode(
        op({
          id: 'auth:login',
          label: PLAIN_LABELS.login,
          operationId: operationId('auth', 'login'),
          emojiKey: 'request.login',
          method: 'POST',
          path: '/api/login',
          body: formBody([{ key: 'accessKey', value: '{{accessKey}}' }]),
          description: 'Signs in with the collection accessKey (multipart form).',
        })
      )
    )
  }

  children.push(
    operationNode(
      op({
        id: 'auth:authentify',
        label: PLAIN_LABELS.authentify,
        operationId: operationId('auth', 'authentify'),
        emojiKey: 'request.authentify',
        method: 'POST',
        path: '/rest/$catalog/authentify',
        body: jsonBody([]),
      })
    )
  )

  if (config.categories.directoryLogin) {
    children.push(
      operationNode(
        op({
          id: 'auth:directory-login',
          label: PLAIN_LABELS.directoryLogin,
          operationId: operationId('auth', 'directory', 'login'),
          emojiKey: 'request.directoryLogin',
          method: 'POST',
          path: '/rest/$directory/login',
          body: jsonBody({
            username: '{{username}}',
            password: '{{password}}',
          }),
        })
      )
    )
  }

  return folder('folder:auth', PLAIN_FOLDERS.auth, children, 'folder.auth')
}

function buildCatalogFolder(config: ToolkitConfig): ToolkitFolderNode | null {
  if (!config.categories.catalog) return null
  const children: ToolkitNode[] = [
    operationNode(
      op({
        id: 'catalog:list',
        label: PLAIN_LABELS.catalog,
        operationId: operationId('catalog', 'list'),
        emojiKey: 'request.catalog',
        method: 'GET',
        path: '/rest/$catalog',
      })
    ),
    operationNode(
      op({
        id: 'catalog:all',
        label: PLAIN_LABELS.catalogAll,
        operationId: operationId('catalog', 'all'),
        emojiKey: 'request.catalogAll',
        method: 'GET',
        path: '/rest/$catalog/$all',
      })
    ),
    operationNode(
      op({
        id: 'catalog:all-metadata',
        label: PLAIN_LABELS.catalogAllMetadata,
        operationId: operationId('catalog', 'all', 'metadata'),
        emojiKey: 'request.catalogAllMetadata',
        method: 'GET',
        path: '/rest/$catalog/$all',
        query: [{ key: '$metadata', value: 'full' }],
      })
    ),
  ]

  if (config.categories.compute) {
    children.push(
      operationNode(
        op({
          id: 'catalog:upload',
          label: PLAIN_LABELS.upload,
          operationId: operationId('catalog', 'upload'),
          emojiKey: 'request.upload',
          method: 'POST',
          path: '/rest/$upload',
          description: 'Upload a file / blob for later assignment on an entity.',
        })
      )
    )
  }

  return folder('folder:catalog', PLAIN_FOLDERS.catalog, children, 'folder.catalog')
}

function buildInfoFolder(categories: ToolkitCategoryFlags): ToolkitFolderNode | null {
  if (!categories.info) return null
  return folder(
    'folder:info',
    PLAIN_FOLDERS.info,
    [
      operationNode(
        op({
          id: 'info:server',
          label: PLAIN_LABELS.serverInfo,
          operationId: operationId('info', 'server'),
          emojiKey: 'request.serverInfo',
          method: 'GET',
          path: '/rest/$info',
        })
      ),
    ],
    'folder.info'
  )
}

function buildDatastoreFunctionsFolder(
  catalog: ToolkitCatalogInput,
  config: ToolkitConfig
): ToolkitFolderNode | null {
  if (!config.categories.datastoreFunctions) return null
  const skipAuthentify = config.categories.auth
  const methods = (catalog.methods ?? []).filter((method) => {
    if (skipAuthentify && method.name.toLowerCase() === AUTHENTIFY) return false
    return isMethodIncluded(method, config.categories.includeNonExposed)
  })
  if (methods.length === 0) return null

  const children: ToolkitNode[] = []
  for (const method of methods) {
    for (const operation of buildFunctionOps({
      idPrefix: `datastore:${method.name}`,
      operationIdPrefix: ['datastore', method.name],
      method,
      postPath: `/rest/$catalog/${method.name}`,
      label: PLAIN_LABELS.datastoreFn,
      getLabel: PLAIN_LABELS.classFnGet,
      emojiKey: 'request.datastoreFn',
      getEmojiKey: 'request.classFnGet',
      query: functionQuery(),
      httpGetVariants: config.categories.httpGetVariants,
      description: method.paramsText,
    })) {
      children.push(operationNode(operation))
    }
  }

  return folder(
    'folder:datastore-functions',
    PLAIN_FOLDERS.datastoreFunctions,
    children,
    'folder.datastoreFunctions'
  )
}

function buildSingletonsFolder(
  catalog: ToolkitCatalogInput,
  config: ToolkitConfig
): ToolkitFolderNode | null {
  if (!config.categories.singletons) return null
  const selected = new Set(config.selectedSingletons)
  const singletonFolders: ToolkitNode[] = []

  for (const singleton of catalog.singletons ?? []) {
    if (!selected.has(singleton.name)) continue
    const methods = (singleton.methods ?? []).filter((method) =>
      isMethodIncluded(method, config.categories.includeNonExposed)
    )
    if (methods.length === 0) continue
    const children: ToolkitNode[] = []
    for (const method of methods) {
      for (const operation of buildFunctionOps({
        idPrefix: `singleton:${singleton.name}:${method.name}`,
        operationIdPrefix: ['singleton', singleton.name, method.name],
        method,
        postPath: `/rest/$singleton/${singleton.name}/${method.name}`,
        label: PLAIN_LABELS.singletonFn,
        getLabel: PLAIN_LABELS.singletonFnGet,
        emojiKey: 'request.singletonFn',
        getEmojiKey: 'request.singletonFnGet',
        query: functionQuery(),
        httpGetVariants: config.categories.httpGetVariants,
        description: method.paramsText,
      })) {
        children.push(operationNode(operation))
      }
    }
    const node = folder(
      `folder:singleton:${singleton.name}`,
      singleton.name,
      children,
      'folder.singleton'
    )
    if (node) singletonFolders.push(node)
  }

  return folder(
    'folder:singletons',
    PLAIN_FOLDERS.singletons,
    singletonFolders,
    'folder.singletons'
  )
}

function buildDataClassCrud(
  dataClass: ToolkitCatalogDataClass,
  flags: ToolkitCategoryFlags
): ToolkitNode[] {
  const name = dataClass.name
  const children: ToolkitNode[] = []
  const dcPath = `/rest/${name}`
  const entityPath = `/rest/${name}({key})`
  const entitySetPath = `/rest/${name}/$entityset/{entitySetId}`

  if (flags.catalog) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:catalog`,
          label: PLAIN_LABELS.catalogDataClass(name),
          operationId: operationId(name, 'catalog'),
          emojiKey: 'request.catalogDataClass',
          method: 'GET',
          path: `/rest/$catalog/${name}`,
        })
      )
    )
  }

  if (flags.crudList) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:list`,
          label: PLAIN_LABELS.list,
          operationId: operationId(name, 'list'),
          emojiKey: 'request.list',
          method: 'GET',
          path: dcPath,
          query: [
            { key: '$filter', value: '' },
            { key: '$top', value: '20' },
            { key: '$skip', value: '0' },
            { key: '$orderby', value: '' },
            { key: '$attributes', value: '' },
          ],
        })
      )
    )
  }

  if (flags.crudCreate) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:create`,
          label: PLAIN_LABELS.create,
          operationId: operationId(name, 'create'),
          emojiKey: 'request.create',
          method: 'POST',
          path: dcPath,
          query: [{ key: '$method', value: 'update' }],
          body: jsonBody({}),
        })
      )
    )
  }

  if (flags.crudGet) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:get`,
          label: PLAIN_LABELS.getByKey,
          operationId: operationId(name, 'get'),
          emojiKey: 'request.getByKey',
          method: 'GET',
          path: entityPath,
          pathParams: [keyParam()],
        })
      )
    )
  }

  if (flags.crudUpdate) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:update`,
          label: PLAIN_LABELS.update,
          operationId: operationId(name, 'update'),
          emojiKey: 'request.update',
          method: 'POST',
          path: dcPath,
          query: [{ key: '$method', value: 'update' }],
          body: jsonBody({ __KEY: '{{key}}', __STAMP: '{{stamp}}' }),
        })
      )
    )
  }

  if (flags.crudDeleteByKey) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:delete-key`,
          label: PLAIN_LABELS.deleteByKey,
          operationId: operationId(name, 'delete', 'key'),
          emojiKey: 'request.deleteByKey',
          method: 'POST',
          path: entityPath,
          query: [{ key: '$method', value: 'delete' }],
          pathParams: [keyParam()],
        })
      )
    )
  }

  if (flags.deleteByFilter) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:delete-filter`,
          label: PLAIN_LABELS.deleteByFilter,
          operationId: operationId(name, 'delete', 'filter'),
          emojiKey: 'request.deleteByFilter',
          method: 'POST',
          path: dcPath,
          query: [
            { key: '$filter', value: '' },
            { key: '$method', value: 'delete' },
          ],
        })
      )
    )
  }

  if (flags.deleteAll) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:delete-all`,
          label: PLAIN_LABELS.deleteAll,
          operationId: operationId(name, 'delete', 'all'),
          emojiKey: 'request.deleteAll',
          method: 'POST',
          path: dcPath,
          query: [{ key: '$method', value: 'delete' }],
          description: 'Deletes every entity in the dataclass. Destructive.',
        })
      )
    )
  }

  if (flags.entitySetCreate) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:entityset-create`,
          label: PLAIN_LABELS.createEntitySet,
          operationId: operationId(name, 'entityset', 'create'),
          emojiKey: 'request.createEntitySet',
          method: 'GET',
          path: dcPath,
          query: [
            { key: '$filter', value: '' },
            { key: '$method', value: 'entityset' },
            { key: '$timeout', value: '60' },
          ],
        })
      )
    )
  }

  if (flags.entitySetPage) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:entityset-page`,
          label: PLAIN_LABELS.pageEntitySet,
          operationId: operationId(name, 'entityset', 'page'),
          emojiKey: 'request.pageEntitySet',
          method: 'GET',
          path: entitySetPath,
          query: [
            { key: '$top', value: '20' },
            { key: '$skip', value: '0' },
          ],
          pathParams: [entitySetParam()],
        })
      )
    )
  }

  if (flags.entitySetClean) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:entityset-clean`,
          label: PLAIN_LABELS.cleanEntitySet,
          operationId: operationId(name, 'entityset', 'clean'),
          emojiKey: 'request.cleanEntitySet',
          method: 'GET',
          path: entitySetPath,
          query: [{ key: '$clean', value: 'true' }],
          pathParams: [entitySetParam()],
        })
      )
    )
  }

  if (flags.entitySetRelease) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:entityset-release`,
          label: PLAIN_LABELS.releaseEntitySet,
          operationId: operationId(name, 'entityset', 'release'),
          emojiKey: 'request.releaseEntitySet',
          method: 'GET',
          path: entitySetPath,
          query: [{ key: '$method', value: 'release' }],
          pathParams: [entitySetParam()],
        })
      )
    )
  }

  if (flags.deleteEntitySet) {
    children.push(
      operationNode(
        op({
          id: `dc:${name}:entityset-delete`,
          label: PLAIN_LABELS.deleteEntitySet,
          operationId: operationId(name, 'entityset', 'delete'),
          emojiKey: 'request.deleteEntitySet',
          method: 'POST',
          path: entitySetPath,
          query: [{ key: '$method', value: 'delete' }],
          pathParams: [entitySetParam()],
        })
      )
    )
  }

  if (flags.compute) {
    const attribute = firstStorageAttribute(dataClass)
    const attrPath =
      attribute === '{attribute}' ? `/rest/${name}/{attribute}` : `/rest/${name}/${attribute}`
    children.push(
      operationNode(
        op({
          id: `dc:${name}:compute`,
          label: PLAIN_LABELS.compute,
          operationId: operationId(name, 'compute'),
          emojiKey: 'request.compute',
          method: 'GET',
          path: attrPath,
          query: [{ key: '$compute', value: 'count' }],
          ...(attribute === '{attribute}'
            ? {
                pathParams: [
                  { name: 'attribute', example: '', description: 'Storage attribute name' },
                ],
              }
            : {}),
        })
      )
    )
  }

  return children
}

function buildDataClassFunctions(
  dataClass: ToolkitCatalogDataClass,
  flags: ToolkitCategoryFlags
): ToolkitFolderNode | null {
  if (!flags.functions) return null
  const methods = (dataClass.methods ?? []).filter((method) =>
    isMethodIncluded(method, flags.includeNonExposed)
  )
  if (methods.length === 0) return null

  const byScope: Record<FunctionScope, ToolkitCatalogMethod[]> = {
    dataclass: [],
    entity: [],
    entitySelection: [],
  }
  for (const method of methods) {
    byScope[scopeFromApplyTo(method.applyTo)].push(method)
  }

  const scopeFolders: ToolkitNode[] = []

  if (byScope.dataclass.length > 0) {
    const children: ToolkitNode[] = []
    for (const method of byScope.dataclass) {
      for (const operation of buildFunctionOps({
        idPrefix: `dc:${dataClass.name}:fn:dataclass:${method.name}`,
        operationIdPrefix: [dataClass.name, 'fn', 'dataclass', method.name],
        method,
        postPath: `/rest/${dataClass.name}/${method.name}`,
        label: PLAIN_LABELS.classFn,
        getLabel: PLAIN_LABELS.classFnGet,
        emojiKey: 'request.classFn',
        getEmojiKey: 'request.classFnGet',
        query: functionQuery(),
        httpGetVariants: flags.httpGetVariants,
        description: method.paramsText,
      })) {
        children.push(operationNode(operation))
      }
    }
    const node = folder(
      `folder:dc:${dataClass.name}:functions:dataclass`,
      PLAIN_FOLDERS.dataclassScope,
      children,
      'folder.dataclassScope'
    )
    if (node) scopeFolders.push(node)
  }

  if (byScope.entity.length > 0) {
    const children: ToolkitNode[] = []
    for (const method of byScope.entity) {
      for (const operation of buildFunctionOps({
        idPrefix: `dc:${dataClass.name}:fn:entity:${method.name}`,
        operationIdPrefix: [dataClass.name, 'fn', 'entity', method.name],
        method,
        postPath: `/rest/${dataClass.name}({key})/${method.name}`,
        label: PLAIN_LABELS.classFn,
        getLabel: PLAIN_LABELS.classFnGet,
        emojiKey: 'request.classFn',
        getEmojiKey: 'request.classFnGet',
        query: functionQuery(),
        pathParams: [keyParam()],
        httpGetVariants: flags.httpGetVariants,
        description: method.paramsText,
      })) {
        children.push(operationNode(operation))
      }
    }
    const node = folder(
      `folder:dc:${dataClass.name}:functions:entity`,
      PLAIN_FOLDERS.entityScope,
      children,
      'folder.entityScope'
    )
    if (node) scopeFolders.push(node)
  }

  if (byScope.entitySelection.length > 0) {
    const children: ToolkitNode[] = []
    for (const method of byScope.entitySelection) {
      for (const operation of buildFunctionOps({
        idPrefix: `dc:${dataClass.name}:fn:entitySelection:${method.name}`,
        operationIdPrefix: [dataClass.name, 'fn', 'entitySelection', method.name],
        method,
        postPath: `/rest/${dataClass.name}/${method.name}`,
        label: PLAIN_LABELS.classFn,
        getLabel: PLAIN_LABELS.classFnGet,
        emojiKey: 'request.classFn',
        getEmojiKey: 'request.classFnGet',
        query: functionQuery({ filter: true }),
        httpGetVariants: flags.httpGetVariants,
        description: method.paramsText,
      })) {
        children.push(operationNode(operation))
      }
      children.push(
        operationNode(
          op({
            id: `dc:${dataClass.name}:fn:entitySelection:${method.name}:entityset`,
            label: PLAIN_LABELS.classFnEntitySet(method.name),
            operationId: operationId(
              dataClass.name,
              'fn',
              'entitySelection',
              method.name,
              'entityset'
            ),
            emojiKey: 'request.classFnEntitySet',
            method: 'POST',
            path: `/rest/${dataClass.name}/${method.name}/$entityset/{entitySetId}`,
            query: functionQuery({ entitySet: true }),
            pathParams: [entitySetParam()],
            body: jsonBody([]),
            description: method.paramsText,
          })
        )
      )
    }
    const node = folder(
      `folder:dc:${dataClass.name}:functions:entitySelection`,
      PLAIN_FOLDERS.entitySelectionScope,
      children,
      'folder.entitySelectionScope'
    )
    if (node) scopeFolders.push(node)
  }

  return folder(
    `folder:dc:${dataClass.name}:functions`,
    PLAIN_FOLDERS.functions,
    scopeFolders,
    'folder.functions'
  )
}

function buildDataClassFolder(
  dataClass: ToolkitCatalogDataClass,
  flags: ToolkitCategoryFlags
): ToolkitFolderNode | null {
  const children = [
    ...buildDataClassCrud(dataClass, flags),
    ...((): ToolkitNode[] => {
      const fnFolder = buildDataClassFunctions(dataClass, flags)
      return fnFolder ? [fnFolder] : []
    })(),
  ]
  return folder(`folder:dc:${dataClass.name}`, dataClass.name, children, 'folder.dataclass')
}

export function buildToolkitInventory(
  catalog: ToolkitCatalogInput,
  config: ToolkitConfig
): ToolkitInventory {
  const selectedNames = new Set(config.selectedDataClasses)
  const selectedClasses = catalog.dataClasses.filter((dc) => selectedNames.has(dc.name))

  const nodes: ToolkitNode[] = []
  const auth = buildAuthFolder(config)
  const catalogFolder = buildCatalogFolder(config)
  const info = buildInfoFolder(config.categories)
  const datastore = buildDatastoreFunctionsFolder(catalog, config)
  const singletons = buildSingletonsFolder(catalog, config)

  if (auth) nodes.push(auth)
  if (catalogFolder) nodes.push(catalogFolder)
  if (info) nodes.push(info)
  if (datastore) nodes.push(datastore)
  if (singletons) nodes.push(singletons)

  for (const dataClass of selectedClasses) {
    const dcFolder = buildDataClassFolder(dataClass, config.categories)
    if (dcFolder) nodes.push(dcFolder)
  }

  const withEmojis = applyEmojis(nodes, config.emoji ?? DEFAULT_TOOLKIT_EMOJI)
  return { nodes: applyToolkitDocs(withEmojis, config.includeDocs !== false) }
}
