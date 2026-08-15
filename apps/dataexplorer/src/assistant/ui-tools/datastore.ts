import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type {
  AssistantToolHandler,
  AssistantToolRegistry,
  DatastoreToolsAdapter,
} from '@4djs/assistant/tools'
import { extractEntitySetId } from '~/components/MethodExecutor/detect-method-result'
import { api } from '~/lib/api'
import { findSqlInQueryParts, SQL_NOT_SUPPORTED_HINT } from '~/lib/reject-sql-in-query'
import {
  parseQueryArgs,
  resolveCreateMode,
  resolveDeleteMode,
  resolveUpdateMode,
} from './datastore-write-args'
import { validateDataclassPath } from './validate-dataclass-path'

/** Hard cap for @datastore/query — large scans time out; use query-related instead. */
const MAX_QUERY_TOP = 500
/** Page size for related entity rows — matches EntityViewer RELATED_PAGE_SIZE. */
const RELATED_PAGE_SIZE = 20

function buildRelatedUri(dataClass: string, key: string, relation: string): string {
  return `/rest/${dataClass}[${key}]/${relation}`
}

/** Last path segment of a related URI, e.g. cars from /rest/Color[9]/cars. */
function relationFromRelatedUri(uri: string): string {
  const path = (uri.split('?')[0] ?? uri).replace(/\/+$/, '')
  return path.split('/').filter(Boolean).at(-1) ?? ''
}

export function registerNamespacedDatastoreTools(
  registry: AssistantToolRegistry,
  adapter: DatastoreToolsAdapter
): void {
  const handlers: AssistantToolHandler[] = [
    {
      definition: {
        name: '@datastore/catalog',
        description:
          'Return the 4D REST catalog: dataclasses, attributes, methods, and entity counts. Use entityCount to plan relation analysis (start from the smaller side) before fetching rows.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => toolResultOk(await adapter.getCatalog()),
    },
    {
      definition: {
        name: '@datastore/server-info',
        description: 'Return server info: cache, entity sets, sessions, and privileges.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => toolResultOk(await adapter.getServerInfo()),
    },
    {
      definition: {
        name: '@datastore/query',
        description:
          'Query entities from a dataclass with optional 4D/ORDA filter, sort, pagination, and $attributes. REQUIRED: call @datastore/validate-path before any dotted attribute/filter path — never invent field names (use catalog names exactly, e.g. Color.label not name). Bare relation attributes only return deferred stubs. Do not set top above 500. For charts/distributions across relations: get counts first (top:0), start from the smaller side, and use @datastore/query-related with top:0 for per-parent counts instead of scanning the child table. SQL is not supported.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string', description: 'Dataclass name' },
            filter: {
              type: 'string',
              description:
                '4D/ORDA filter expression (no SQL). Prefer relation paths when available, e.g. manager.lastname = :1. FK example: ID_color = :1. Validate dotted paths with @datastore/validate-path first.',
            },
            filterParams: {
              type: 'array',
              items: {},
              description:
                'Values for :1, :2, … placeholders. Scalars: "12", "A@". For ORDA `in`, pass one nested array: filterParams: [[9, 13, 4]] for "ID in :1". Never SQL subqueries.',
            },
            sort: {
              type: 'string',
              description: 'Attribute name to sort by (pass direction separately in order)',
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort direction for sort attribute (default desc)',
            },
            top: {
              type: 'number',
              description: `REST $top — max entities per request (default 100, max ${MAX_QUERY_TOP}). Use 0 for count-only. Never request tens of thousands of rows.`,
            },
            limit: { type: 'number', description: 'Deprecated alias for top' },
            page: { type: 'number', description: 'Page number (default 1)' },
            attributes: {
              type: 'array',
              items: { type: 'string' },
              description:
                'REST $attributes — must use exact catalog names. Call @datastore/validate-path for every dotted path before querying. Bare relations (e.g. "color") return only __deferred stubs. Good: ["color.label"] after validate-path succeeds.',
            },
            select: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Alias for attributes ($attributes). Prefer attributes. Same rules: validate dotted paths first.',
            },
            expand: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Optional $expand relations (e.g. ["employer"]). Prefer attributes with dotted paths when you only need specific related fields.',
            },
          },
          required: ['dataClass'],
        },
      },
      invoke: async (args) => {
        const parsed = parseQueryArgs(args)
        if (!parsed.dataClass.trim()) {
          return toolResultErr(
            'dataClass is required. For opening a table tab, use @navigation/open-tab with type "dataclass".'
          )
        }
        const top = parsed.top ?? 100
        if (top > MAX_QUERY_TOP) {
          return toolResultErr(
            `top=${top} exceeds max ${MAX_QUERY_TOP}. Do not scan large tables. Plan first: get entity counts (top:0), start from the smaller side of the relation, then use @datastore/query-related (dataClass + key + relation, top:0) for per-parent counts.`
          )
        }
        const sqlIssue = findSqlInQueryParts({
          filter: parsed.filter,
          filterParams: parsed.filterParams,
        })
        if (sqlIssue) {
          return toolResultErr(`${sqlIssue}. ${SQL_NOT_SUPPORTED_HINT}`)
        }
        const dottedPaths = [
          ...(parsed.select ?? []).filter((a) => a.includes('.')),
          ...(parsed.expand ?? []).filter((a) => a.includes('.')),
          ...(parsed.filter
            ? [...parsed.filter.matchAll(/\b([A-Za-z_][\w]*(?:\.[A-Za-z_][\w*]*)+)/g)].map(
                (m) => m[1]
              )
            : []),
        ]
        if (dottedPaths.length > 0) {
          try {
            const catalog = await api.getCatalog()
            for (const path of dottedPaths) {
              const result = validateDataclassPath(catalog, parsed.dataClass, path)
              if (!result.valid) {
                return toolResultErr(
                  `${result.error}. Call @datastore/validate-path before using dotted paths, and use exact catalog attribute names (never invent fields like colorName/hexValue).`
                )
              }
            }
          } catch (error) {
            return toolResultErr(error instanceof Error ? error.message : String(error))
          }
        }
        return toolResultOk(await adapter.queryEntities(parsed))
      },
    },
    {
      definition: {
        name: '@datastore/validate-path',
        description:
          'REQUIRED before any dotted attribute/relation path in @datastore/query filters or attributes (e.g. color.label on Car). Do not guess related field names — catalog first, then validate-path. Returns which segment failed and available attributes on that dataclass.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: {
              type: 'string',
              description: 'Root dataclass name (e.g. Car)',
            },
            path: {
              type: 'string',
              description:
                'Dotted path to validate (e.g. "agency.manager.firstname", "color.label", "employer.*")',
            },
          },
          required: ['dataClass', 'path'],
        },
      },
      invoke: async (args) => {
        const dataClass = String(args.dataClass ?? args.dataclassName ?? '').trim()
        const path = String(args.path ?? '').trim()
        if (!dataClass) return toolResultErr('dataClass is required')
        if (!path) return toolResultErr('path is required (e.g. "agency.manager.firstname")')
        try {
          const catalog = await api.getCatalog()
          const result = validateDataclassPath(catalog, dataClass, path)
          if (!result.valid) return toolResultErr(result.error)
          return toolResultOk(result)
        } catch (error) {
          return toolResultErr(error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      definition: {
        name: '@datastore/query-related',
        description:
          'Fetch a related entity selection via REST with $expand=<relation>&$method=subentityset (same as EntityViewer). Prefer this over scanning a large child table. For counts only, use top:0. Example: Color key 9 relation cars → GET /rest/Color[9]/cars?$expand=cars&$method=subentityset&$top=20&$skip=0. Optimized chart flow: compare parent vs child entity counts first, query the smaller parent side, then query-related per row with top:0 for counts (e.g. few Users × cars counts — not all Cars).',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: {
              type: 'string',
              description: 'Parent dataclass name (e.g. Color)',
            },
            key: {
              description: 'Parent entity primary key (__KEY or ID)',
            },
            relation: {
              type: 'string',
              description: 'Relation attribute on the parent (e.g. cars). Also used as $expand.',
            },
            uri: {
              type: 'string',
              description:
                'Optional full deferred URI (e.g. "/rest/Color[1]/cars?$expand=cars"). When set, dataClass/key/relation are ignored; relation is inferred from the path for $expand.',
            },
            top: {
              type: 'number',
              description: `Max related entities to return (default 0 = count only). When fetching rows, max ${RELATED_PAGE_SIZE} (paginate with skip).`,
            },
            skip: { type: 'number', description: 'Offset (default 0)' },
            sort: { type: 'string', description: 'Sort attribute on the related dataclass' },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort direction (default asc)',
            },
          },
          additionalProperties: false,
        },
      },
      invoke: async (args) => {
        const uriArg = typeof args.uri === 'string' ? args.uri.trim() : ''
        const dataClass = String(args.dataClass ?? args.dataclassName ?? '').trim()
        const key = args.key != null ? String(args.key).trim() : ''
        let relation = String(args.relation ?? '').trim()
        let top =
          typeof args.top === 'number' && Number.isFinite(args.top) ? Math.max(0, args.top) : 0
        const skip =
          typeof args.skip === 'number' && Number.isFinite(args.skip) ? Math.max(0, args.skip) : 0

        // Cap page size to EntityViewer RELATED_PAGE_SIZE; top:0 stays count-only.
        if (top > RELATED_PAGE_SIZE) top = RELATED_PAGE_SIZE

        let uri = uriArg
        if (!uri) {
          if (!dataClass) return toolResultErr('dataClass is required when uri is omitted')
          if (!key) return toolResultErr('key is required when uri is omitted')
          if (!relation) {
            return toolResultErr(
              'relation is required when uri is omitted (e.g. "cars" for Color → Car)'
            )
          }
          uri = buildRelatedUri(dataClass, key, relation)
        } else if (!relation) {
          relation = relationFromRelatedUri(uri)
        }

        const pathOnly = uri.split('?')[0] ?? uri
        const expand = relation || relationFromRelatedUri(pathOnly)

        try {
          const data = await api.fetchRelated(pathOnly, {
            top,
            skip,
            subEntitySet: true,
            expand: expand || undefined,
            sort: typeof args.sort === 'string' ? args.sort : undefined,
            order: args.order === 'desc' ? 'desc' : 'asc',
          })
          const entities = (data.__ENTITIES as Record<string, unknown>[] | undefined) ?? []
          const count = (data.__COUNT as number | undefined) ?? entities.length
          return toolResultOk({
            uri: pathOnly,
            expand: expand || null,
            count,
            entities: entities.map((e) => ({ ...e, id: e.__KEY })),
            entitySetId: extractEntitySetId(data.__ENTITYSET) ?? null,
            entityModel: typeof data.__entityModel === 'string' ? data.__entityModel : null,
            pagination: {
              top,
              skip,
              total: count,
              hasNext: skip + entities.length < count,
            },
          })
        } catch (error) {
          return toolResultErr(error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      definition: {
        name: '@datastore/get',
        description:
          'Get a single entity by primary key. Do not call repeatedly to resolve related entities from a query list — use @datastore/query with attributes (e.g. ["model.brandModelString"] or ["model.*"]) instead.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string' },
            key: { type: 'string', description: 'Entity primary key' },
          },
          required: ['dataClass', 'key'],
        },
      },
      invoke: async (args) =>
        toolResultOk(await adapter.getEntity(String(args.dataClass ?? ''), String(args.key ?? ''))),
    },
    {
      definition: {
        name: '@datastore/create',
        description:
          'Create one or many entities in one REST request. Pass data for a single record or entities for multiple — never loop this tool per row.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string' },
            data: { type: 'object', description: 'Attribute values for one new entity' },
            entities: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of attribute objects for multiple new records (no __KEY/__STAMP)',
            },
          },
          required: ['dataClass'],
        },
      },
      invoke: async (args) => {
        const writeError = adapter.assertWritable?.() ?? null
        if (writeError) return toolResultErr(writeError)
        const dataClass = String(args.dataClass ?? '').trim()
        if (!dataClass) return toolResultErr('dataClass is required')
        const mode = resolveCreateMode(args)
        if ('error' in mode) return toolResultErr(mode.error)
        if (mode.mode === 'many') {
          return toolResultOk(await api.createManyEntities(dataClass, mode.entities))
        }
        return toolResultOk(await adapter.createEntity(dataClass, mode.data))
      },
    },
    {
      definition: {
        name: '@datastore/update',
        description:
          'Update one or many entities in one REST request. Pass key+data for one record or entities (each with __KEY and __STAMP from @datastore/query) for bulk — never loop per key.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string' },
            key: { type: 'string', description: 'Primary key when updating one entity' },
            data: { type: 'object', description: 'Fields to update when using key' },
            entities: {
              type: 'array',
              items: { type: 'object' },
              description: 'Array of objects with __KEY, __STAMP, and fields to update',
            },
          },
          required: ['dataClass'],
        },
      },
      invoke: async (args) => {
        const writeError = adapter.assertWritable?.() ?? null
        if (writeError) return toolResultErr(writeError)
        const dataClass = String(args.dataClass ?? '').trim()
        if (!dataClass) return toolResultErr('dataClass is required')
        const mode = resolveUpdateMode(args)
        if ('error' in mode) return toolResultErr(mode.error)
        if (mode.mode === 'many') {
          return toolResultOk(await api.updateManyEntities(dataClass, mode.entities))
        }
        return toolResultOk(await adapter.updateEntity(dataClass, mode.key, mode.data))
      },
    },
    {
      definition: {
        name: '@datastore/delete',
        description:
          'Delete one or many entities. Pass key for one record, or filter (+ optional filterParams) / entitySetId for bulk. Omit filter to delete ALL entities in the dataclass — never loop per key.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string' },
            key: { type: 'string', description: 'Primary key when deleting one entity' },
            filter: {
              type: 'string',
              description:
                '4D filter for bulk delete; omit to delete every entity in the dataclass',
            },
            filterParams: {
              type: 'array',
              items: {},
              description: 'Values for :1, :2, … placeholders in the filter',
            },
            entitySetId: {
              type: 'string',
              description: 'Delete all entities in an existing entity set instead of using filter',
            },
          },
          required: ['dataClass'],
        },
      },
      invoke: async (args) => {
        const writeError = adapter.assertWritable?.() ?? null
        if (writeError) return toolResultErr(writeError)
        const mode = resolveDeleteMode(args)
        if ('error' in mode) return toolResultErr(mode.error)
        if (mode.mode === 'single') {
          const dataClass = String(args.dataClass ?? '').trim()
          if (!dataClass) return toolResultErr('dataClass is required')
          return toolResultOk(await adapter.deleteEntity(dataClass, mode.key))
        }
        return toolResultOk(
          await api.deleteManyEntities(mode.dataClass, {
            ...mode.parsed,
            entitySetId: mode.entitySetId,
          })
        )
      },
    },
    {
      definition: {
        name: '@datastore/create-entityset',
        description:
          'Create a cached entity set on the server from filter/sort/select/expand options. Returns entitySetId for opening in a tab.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string', description: 'Dataclass name' },
            filter: { type: 'string', description: '4D filter expression' },
            filterParams: {
              type: 'array',
              items: {},
              description: 'Values for :1, :2, … placeholders in the filter',
            },
            sort: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
            attributes: {
              type: 'array',
              items: { type: 'string' },
              description:
                'REST $attributes. Use dotted paths (e.g. "model.brandModelString", "model.*") to expand related fields — bare relation names return deferred stubs only.',
            },
            select: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alias for attributes ($attributes). Prefer attributes.',
            },
            expand: {
              type: 'array',
              items: { type: 'string' },
              description: 'Relation attributes to expand via $expand (e.g. ["employer"])',
            },
          },
          required: ['dataClass'],
        },
      },
      invoke: async (args) => {
        const parsed = parseQueryArgs(args)
        if (!parsed.dataClass) return toolResultErr('dataClass is required')
        return toolResultOk(await api.createEntitySet(parsed.dataClass, parsed))
      },
    },
    {
      definition: {
        name: '@datastore/combine-entityset',
        description:
          'Combine two cached entity sets on the same dataclass using 4D REST $logicOperator (AND, OR, EXCEPT) or test overlap with INTERSECT. AND/OR/EXCEPT create a new entity set and return entitySetId; INTERSECT returns intersects: true|false without creating a set.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string', description: 'Dataclass name (both sets must use it)' },
            entitySetId: { type: 'string', description: 'First entity set ID' },
            otherEntitySetId: {
              type: 'string',
              description: 'Second entity set ID ($otherCollection)',
            },
            operator: {
              type: 'string',
              enum: ['AND', 'OR', 'EXCEPT', 'INTERSECT'],
              description:
                'AND = entities in both sets; OR = union; EXCEPT = first set minus second; INTERSECT = boolean overlap test',
            },
          },
          required: ['dataClass', 'entitySetId', 'otherEntitySetId', 'operator'],
        },
      },
      invoke: async (args) => {
        const dataClass = String(args.dataClass ?? '')
        if (!dataClass) return toolResultErr('dataClass is required')
        const entitySetId = String(args.entitySetId ?? '')
        const otherEntitySetId = String(args.otherEntitySetId ?? '')
        const operator = String(args.operator ?? '')
        if (!entitySetId || !otherEntitySetId || !operator) {
          return toolResultErr('entitySetId, otherEntitySetId, and operator are required')
        }
        try {
          return toolResultOk(
            await api.combineEntitySets(dataClass, {
              entitySetId,
              otherEntitySetId,
              operator,
            })
          )
        } catch (error) {
          return toolResultErr(error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      definition: {
        name: '@datastore/release-entityset',
        description:
          'Release one or more cached entity sets from the 4D server ($method=release). Frees server cache memory. Detaches any open tabs bound to those entitySetIds. Use @datastore/server-info to list active entity sets.',
        inputSchema: {
          type: 'object',
          properties: {
            entitySets: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  dataClass: { type: 'string', description: 'Dataclass the entity set belongs to' },
                  entitySetId: { type: 'string', description: 'Entity set ID to release' },
                },
                required: ['dataClass', 'entitySetId'],
              },
              description: 'Entity sets to release',
            },
          },
          required: ['entitySets'],
        },
      },
      invoke: async (args) => {
        if (!Array.isArray(args.entitySets) || args.entitySets.length === 0) {
          return toolResultErr('entitySets must be a non-empty array')
        }

        const entitySets = args.entitySets.map((item, index) => {
          if (!item || typeof item !== 'object') {
            throw new Error(`entitySets[${index}] must be an object`)
          }
          const record = item as Record<string, unknown>
          return {
            dataClass: String(record.dataClass ?? ''),
            entitySetId: String(record.entitySetId ?? ''),
          }
        })

        try {
          const result = await api.releaseEntitySets(entitySets)
          return toolResultOk(result)
        } catch (error) {
          return toolResultErr(error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      definition: {
        name: '@datastore/distinct',
        description:
          'Return distinct values for one attribute via REST $distinct. Pass entitySetId to scope to a cached set, or filter (+ optional filterParams) for a query. Optional top/skip for paging.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string' },
            attribute: { type: 'string', description: 'Attribute name (path segment)' },
            entitySetId: { type: 'string' },
            filter: { type: 'string' },
            filterParams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['type', 'value'],
              },
            },
            top: { type: 'number' },
            skip: { type: 'number' },
          },
          required: ['dataClass', 'attribute'],
        },
      },
      invoke: async (args) => {
        try {
          const result = await api.getDistinctValues({
            dataclass: String(args.dataClass ?? ''),
            attribute: String(args.attribute ?? ''),
            entitySetId:
              typeof args.entitySetId === 'string' && args.entitySetId.trim()
                ? args.entitySetId.trim()
                : undefined,
            filter: typeof args.filter === 'string' ? args.filter : undefined,
            filterParams: Array.isArray(args.filterParams)
              ? (args.filterParams as Array<{ type: string; value: string }>)
              : undefined,
            top: typeof args.top === 'number' ? args.top : undefined,
            skip: typeof args.skip === 'number' ? args.skip : undefined,
          })
          return toolResultOk(result)
        } catch (error) {
          return toolResultErr(error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      definition: {
        name: '@datastore/compute',
        description:
          'Aggregate an attribute via REST $compute (sum, average, count, min, max, or $all). Pass entitySetId or filter to scope the selection.',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string' },
            attribute: { type: 'string' },
            operation: {
              type: 'string',
              enum: ['sum', 'average', 'count', 'min', 'max', '$all'],
              description: 'Defaults to $all',
            },
            entitySetId: { type: 'string' },
            filter: { type: 'string' },
            filterParams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['type', 'value'],
              },
            },
          },
          required: ['dataClass', 'attribute'],
        },
      },
      invoke: async (args) => {
        try {
          const op = args.operation
          const operation =
            op === 'sum' ||
            op === 'average' ||
            op === 'count' ||
            op === 'min' ||
            op === 'max' ||
            op === '$all'
              ? op
              : '$all'
          const result = await api.computeAttribute({
            dataclass: String(args.dataClass ?? ''),
            attribute: String(args.attribute ?? ''),
            operation,
            entitySetId:
              typeof args.entitySetId === 'string' && args.entitySetId.trim()
                ? args.entitySetId.trim()
                : undefined,
            filter: typeof args.filter === 'string' ? args.filter : undefined,
            filterParams: Array.isArray(args.filterParams)
              ? (args.filterParams as Array<{ type: string; value: string }>)
              : undefined,
          })
          return toolResultOk(result)
        } catch (error) {
          return toolResultErr(error instanceof Error ? error.message : String(error))
        }
      },
    },
  ]

  for (const handler of handlers) {
    registry.register(handler)
  }
}
