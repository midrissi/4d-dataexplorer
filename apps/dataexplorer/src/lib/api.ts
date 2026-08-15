import {
  type CatalogAllResponse,
  type CatalogWithMetadataExpanded,
  callDataClassFunction,
  callDataStoreFunction,
  callEntityFunction,
  callEntitySelectionFunction,
  callSingletonFunction,
  type EntitySetOperator,
  type FunctionCallResult,
  type InfoResponse,
  normalizeOrderByExpression,
  type QueryOptions,
  RESTClient,
} from '@4d/rest'
import type { MethodToolInvokeInput } from '@4djs/assistant/tools'
import { consoleService } from '~/lib/console'
import { COUNT_FETCH_CONCURRENCY, mapWithConcurrency } from '~/lib/dataclass-counts'
import { resolveEnvTemplates, resolveEnvTemplatesDeepWithThis } from '~/lib/env'
import { coerceEntityDataBySchema } from '~/lib/env/coerce-entity-data'
import { getActiveEnvMap } from '~/lib/env/runtime'
import { buildEntityThis, buildQueryThis } from '~/lib/env/this-context-builders'
import { getBaseUrl, getCustomHeaders, getLoggingFetch, getTimeout } from '~/lib/platform'
import { extractQueryExplain, mergeQueryExplain } from '~/lib/query-explain/extract'
import type { QueryExplainPayload } from '~/lib/query-explain/types'
import { getCurrentBaseId, getDataclassCustomizations, setCurrentBaseId } from '~/lib/storage'
import type { Dataclass, Entity, Pagination } from '~/store'
import { type DataclassCustomization, useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'

/** Max entities per `$method=update` array body when bulk-creating. */
export const CREATE_ENTITIES_BATCH_SIZE = 100

/**
 * Flatten an unknown thrown value (and Error.cause chain) into a readable message.
 */
export function formatThrownError(error: unknown, fallback: string): string {
  const parts: string[] = []
  if (error instanceof Error) {
    if (error.message.trim()) parts.push(error.message.trim())
    let cause: unknown = error.cause
    let depth = 0
    while (cause != null && depth < 5) {
      if (cause instanceof Error) {
        if (cause.message.trim()) parts.push(cause.message.trim())
        cause = cause.cause
      } else {
        const text = String(cause).trim()
        if (text) parts.push(text)
        break
      }
      depth += 1
    }
  } else if (typeof error === 'string' && error.trim()) {
    parts.push(error.trim())
  } else if (error && typeof error === 'object' && 'message' in error) {
    const text = String((error as { message: unknown }).message ?? '').trim()
    if (text) parts.push(text)
  }
  const unique = [...new Set(parts.filter(Boolean))]
  if (unique.length === 0) return fallback
  // Prefer "fallback: detail" when fallback is a reachability prefix and detail differs.
  if (
    fallback &&
    !unique[0].startsWith(fallback) &&
    /could not reach|unreachable/i.test(fallback)
  ) {
    return `${fallback}: ${unique.join(' — ')}`
  }
  return unique.join(' — ')
}

const TRANSPORT_ERROR_RE =
  /failed to fetch|networkerror|load failed|network request failed|fetch failed|error sending request|tcp connect|connection refused|timed out|timeout|unreachable|dns|name or service not known|nodename nor servname|could not reach/i

/** True when the failure is transport-level (server down) rather than bad credentials. */
export function isTransportError(error: unknown): boolean {
  const message = formatThrownError(error, '').toLowerCase()
  if (!message) return false
  return TRANSPORT_ERROR_RE.test(message)
}

// Initialize the REST client with the current base URL (web: origin, desktop: configured URL)
let client = new RESTClient({
  baseUrl: getBaseUrl(),
  headers: getCustomHeaders(),
  timeout: getTimeout(),
  fetch: getLoggingFetch(),
})

/**
 * Reconfigure the REST client with new connection settings.
 * Called from the desktop app when the user connects to a server.
 */
export function reconfigureClient(config: {
  baseUrl: string
  headers?: Record<string, string>
  timeout?: number
}): void {
  client = new RESTClient({
    baseUrl: config.baseUrl,
    headers: config.headers,
    timeout: config.timeout,
    fetch: getLoggingFetch(),
  })
  storageInitialized = false
  currentEntitySetByDataclass.clear()
}

// Flag to track if storage has been initialized
let storageInitialized = false

/** Current entity set per dataclass; released when query (filter/sort/select) changes */
const currentEntitySetByDataclass = new Map<string, { queryKey: string; entitySetId: string }>()

/** Default entity set cache timeout in seconds (2 hours) */
const ENTITY_SET_TIMEOUT_SEC = 7200

function normalizeEntitySetOperator(operator: string): EntitySetOperator | null {
  const normalized = operator.trim().toUpperCase()
  if (
    normalized === 'AND' ||
    normalized === 'OR' ||
    normalized === 'EXCEPT' ||
    normalized === 'INTERSECT'
  ) {
    return normalized
  }
  return null
}

/** Key for entity set reuse: only filter, sort, order, select, expand, filterParams (not page/limit). */
function getEntitiesQueryKey(params?: {
  filter?: string
  sort?: string
  order?: 'asc' | 'desc'
  select?: string[]
  expand?: string[]
  filterParams?: Array<{ type: string; value: string }>
}): string {
  const filter = params?.filter ?? ''
  const sort = params?.sort ?? ''
  const order = params?.order ?? 'desc'
  const select = (params?.select ?? []).join(',')
  const expand = (params?.expand ?? []).join(',')
  const filterParams = JSON.stringify(params?.filterParams ?? [])
  return `${filter}|${sort}|${order}|${select}|${expand}|${filterParams}`
}

/** Coerce UI filter params to API values (:1, :2, ...). */
export function coerceFilterParams(
  filterParams: Array<{ type: string; value: string }>,
  thisRoot?: unknown
): unknown[] {
  const map = getActiveEnvMap()
  const opts = thisRoot !== undefined ? { this: thisRoot } : undefined
  const unresolved: string[] = []
  const coerced = filterParams.map((p) => {
    const resolved = resolveEnvTemplates(p.value, map, opts)
    for (const key of resolved.unresolved) {
      if (!unresolved.includes(key)) unresolved.push(key)
    }
    const value = resolved.text
    if (p.type === 'number') {
      const n = Number(value)
      return Number.isNaN(n) ? value : n
    }
    if (p.type === 'boolean') {
      const v = value.toLowerCase()
      return v === 'true' || v === '1'
    }
    if (p.type === 'date') {
      return value.trim() || null
    }
    if (p.type === 'json') {
      const trimmed = value.trim()
      if (!trimmed) return null
      try {
        return JSON.parse(trimmed)
      } catch {
        return value
      }
    }
    return value
  })
  if (unresolved.length > 0) {
    consoleService.warn(`Unresolved environment variables: ${unresolved.join(', ')}`)
  }
  return coerced
}

type EntityQueryParams = {
  filter?: string
  sort?: string
  order?: 'asc' | 'desc'
  select?: string[]
  expand?: string[]
  filterParams?: Array<{ type: string; value: string }>
  /** Request `$queryplan` and `$querypath` on the REST call. */
  explain?: boolean
}

/** Build $orderby/$attributes/$expand for entity-set page fetches.
 * Do not re-apply $filter/$params — they were already applied when the set was created.
 * Re-sending placeholders (e.g. `ID in :1`) on `/$entityset/{id}` can yield
 * "The query placeholder :1 is missing or null" (seen especially via Tauri HTTP).
 */
function buildEntitySetPageOptions(params?: EntityQueryParams): QueryOptions {
  const options: QueryOptions = {}

  if (params?.sort) {
    options.$orderby = normalizeOrderByExpression(
      params.order ? `${params.sort} ${params.order}` : params.sort
    )
  }

  if (params?.select?.length) {
    options.$attributes = params.select.join(',')
  }

  if (params?.expand?.length) {
    options.$expand = params.expand.join(',')
  }

  if (params?.explain) {
    options.$queryplan = true
    options.$querypath = true
  }

  return options
}

/** Build a query builder from filter/sort/select/expand options (shared by getEntities and createEntitySet). */
function buildDataclassQuery(dataclassName: string, params?: EntityQueryParams) {
  let baseQuery = client.dataclass(dataclassName).all()
  if (params?.filter) {
    const thisRoot = buildQueryThis({
      dataclassName,
      queryOptions: {
        filter: params.filter,
        filterParams: params.filterParams ?? [],
        sort: params.sort ?? '',
        order: params.order ?? 'desc',
        select: params.select?.join(',') ?? '',
        top: 0,
      },
    })
    const filterResolved = resolveEnvTemplates(params.filter, getActiveEnvMap(), { this: thisRoot })
    if (filterResolved.unresolved.length > 0) {
      consoleService.warn(
        `Unresolved environment variables: ${filterResolved.unresolved.join(', ')}`
      )
    }
    baseQuery = baseQuery.filter(filterResolved.text)
    const paramValues = params?.filterParams?.length
      ? coerceFilterParams(params.filterParams, thisRoot)
      : []
    if (paramValues.length > 0) {
      baseQuery = baseQuery.params(...paramValues)
    }
  }
  if (params?.sort) {
    baseQuery = baseQuery.orderBy(params.sort, params.order ?? 'desc')
  }
  if (params?.select?.length) {
    baseQuery = baseQuery.select(...params.select)
  }
  if (params?.expand?.length) {
    baseQuery = baseQuery.expand(...params.expand)
  }
  if (params?.explain) {
    baseQuery = baseQuery.withQueryPlan().withQueryPath()
  }
  return baseQuery
}

function explainFromCollection(
  collection: { __queryPlan?: unknown; __queryPath?: unknown },
  requested: boolean,
  extra?: { queryPlan?: unknown; queryPath?: unknown }
): QueryExplainPayload | null {
  const fromBody = extractQueryExplain(collection, requested)
  if (!requested || !extra) return fromBody
  return mergeQueryExplain(
    fromBody,
    extractQueryExplain(
      {
        __queryPlan: extra.queryPlan,
        __queryPath: extra.queryPath,
      },
      true
    )
  )
}

async function releaseEntitySetOnServer(dataclassName: string, entitySetId: string): Promise<void> {
  const cached = currentEntitySetByDataclass.get(dataclassName)
  if (cached?.entitySetId === entitySetId) {
    currentEntitySetByDataclass.delete(dataclassName)
  }
  try {
    await client.releaseEntitySet(dataclassName, entitySetId)
  } catch {
    // Entity set may already be released or expired
  }
}

function detachEntitySetFromTabs(dataclassName: string, entitySetId: string): number {
  const tabsStore = useTabsStore.getState()
  let detachedTabs = 0
  const tabs = tabsStore.tabs.map((tab) => {
    if (tab.type !== 'dataclass') return tab
    if (tab.entitySetId !== entitySetId || tab.dataclassName !== dataclassName) return tab
    detachedTabs += 1
    return { ...tab, entitySetId: null }
  })
  if (detachedTabs > 0) {
    useTabsStore.setState({ tabs })
  }
  return detachedTabs
}

function detachEntitySetsFromTabs(
  entitySets: Array<{ dataClass: string; entitySetId: string }>
): number {
  const releaseKeys = new Set(
    entitySets.map(({ dataClass, entitySetId }) => `${dataClass}:${entitySetId}`)
  )
  const tabsStore = useTabsStore.getState()
  let detachedTabs = 0
  const tabs = tabsStore.tabs.map((tab) => {
    if (tab.type !== 'dataclass' || !tab.entitySetId || !tab.dataclassName) return tab
    const key = `${tab.dataclassName}:${tab.entitySetId}`
    if (!releaseKeys.has(key)) return tab
    detachedTabs += 1
    return { ...tab, entitySetId: null }
  })
  if (detachedTabs > 0) {
    useTabsStore.setState({ tabs })
  }
  return detachedTabs
}

export type EntitySetReleaseInput = {
  dataClass: string
  entitySetId: string
}

function normalizeEntitySetReleaseInput(
  dataClass: string,
  entitySetId: string
): EntitySetReleaseInput {
  const normalizedDataClass = dataClass.trim()
  const id = entitySetId.trim()
  if (!normalizedDataClass) throw new Error('dataClass is required')
  if (!id) throw new Error('entitySetId is required')
  return { dataClass: normalizedDataClass, entitySetId: id }
}

/**
 * Initialize storage with the base BASEID
 * This should be called once when the catalog is first fetched
 */
async function initializeStorage(): Promise<void> {
  if (storageInitialized) {
    return
  }

  // Fetch catalog with metadata (includes __UNIQID, __BASEID, __NAME, properties, full singletons/methods)
  const catalog = await client.catalog.getAllWithMetadataCached()
  const baseId = catalog.__BASEID ?? catalog.__UNIQID
  if (baseId) {
    setCurrentBaseId(baseId)
    // Rehydrate tabs from storage after BASEID is set
    useTabsStore.getState().rehydrateTabs()
    // Load dataclass customizations from base settings (merge runs before base BASEID is set)
    const customizations = getDataclassCustomizations() as Record<string, DataclassCustomization>
    useSettingsStore.setState({ dataclassCustomizations: customizations })
  }

  storageInitialized = true
}

/**
 * API layer for the Data Explorer
 * Maps the 4D REST API to the dataexplorer's needs
 */
/**
 * Clear entity set cache (for testing only). Ensures getEntities creates a fresh entity set.
 */
export function clearEntitySetCache(): void {
  currentEntitySetByDataclass.clear()
}

/**
 * Clear the in-memory REST catalog cache so the next catalog read hits the network.
 * Prefer this for user-triggered reloads; use {@link clearCatalogCacheAndStorage}
 * after auth/session changes that also need storage re-init.
 */
export function clearCatalogCache(): void {
  client.catalog.clearCache()
}

/**
 * Clear catalog cache and storage init flag so the next initializeStorage() refetches the catalog.
 * Call after successful access key login so subsequent requests use the new session.
 */
export function clearCatalogCacheAndStorage(): void {
  clearCatalogCache()
  storageInitialized = false
}

export const api = {
  /**
   * Initialize storage with base BASEID (call before using tabs)
   */
  initializeStorage,

  /**
   * Clear the in-memory REST catalog cache so the next catalog read hits the network.
   */
  clearCatalogCache,

  /**
   * Login with access key via /api/login (multipart form with accessKey).
   * On success the server typically sets a session cookie used by subsequent REST requests.
   */
  loginWithAccessKey: async (accessKey: string): Promise<void> => {
    const formData = new FormData()
    formData.append('accessKey', accessKey)
    const loginUrl = `${getBaseUrl()}/api/login`
    const platformFetch = getLoggingFetch()
    let response: Response
    try {
      response = await platformFetch(loginUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
    } catch (error) {
      throw new Error(formatThrownError(error, `Could not reach ${getBaseUrl()}`), {
        cause: error instanceof Error ? error : undefined,
      })
    }

    let data: {
      success?: boolean
      isLogged?: boolean
      errors?: string[]
      message?: string
    }
    try {
      data = (await response.json()) as typeof data
    } catch (error) {
      throw new Error(
        formatThrownError(
          error,
          `Login failed: ${response.status} ${response.statusText || 'invalid response'}`.trim()
        ),
        { cause: error instanceof Error ? error : undefined }
      )
    }

    if (!response.ok) {
      const message = data.errors?.[0] ?? data.message ?? `Login failed: ${response.status}`
      throw new Error(message)
    }
    if (data.isLogged === false || (Array.isArray(data.errors) && data.errors.length > 0)) {
      throw new Error(data.errors?.[0] ?? 'Invalid access key')
    }
  },

  /**
   * Get server info from /rest/$info (cache, entity sets, sessions, privileges)
   */
  getServerInfo: async (): Promise<InfoResponse> => {
    return client.info.getInfo()
  },

  /**
   * Catalog names only — no entity counts (fast connect path for large schemas).
   */
  getDataclassList: async (): Promise<Dataclass[]> => {
    const catalog = await client.catalog.getAllWithMetadataCached()
    if (!catalog.dataClasses || catalog.dataClasses.length === 0) {
      return []
    }
    return catalog.dataClasses.map((dc) => ({
      name: dc.name,
      collectionName: dc.collectionName,
      count: null,
    }))
  },

  /**
   * Entity count for one dataclass (`$top=0` → `__COUNT`).
   * Failed counts resolve to `0` so the UI can show a loaded value.
   */
  getDataclassCount: async (name: string): Promise<number> => {
    try {
      return await client.dataclass(name).count()
    } catch {
      return 0
    }
  },

  /**
   * Fetch counts for many dataclasses with bounded concurrency.
   */
  getDataclassCounts: async (
    names: readonly string[],
    options?: { concurrency?: number }
  ): Promise<Map<string, number>> => {
    const concurrency = options?.concurrency ?? COUNT_FETCH_CONCURRENCY
    const pairs = await mapWithConcurrency(names, concurrency, async (name) => {
      const count = await api.getDataclassCount(name)
      return [name, count] as const
    })
    return new Map(pairs)
  },

  /**
   * Catalog list + all entity counts (pooled). Prefer list + selective counts for UI.
   */
  getDataclasses: async (): Promise<Dataclass[]> => {
    const list = await api.getDataclassList()
    if (list.length === 0) return []
    const counts = await api.getDataclassCounts(list.map((dc) => dc.name))
    return list.map((dc) => ({
      ...dc,
      count: counts.get(dc.name) ?? 0,
    }))
  },

  /**
   * Get full catalog metadata (cached by REST client).
   */
  getCatalog: async (): Promise<CatalogAllResponse> => {
    return client.catalog.getAllWithMetadataCached()
  },

  /**
   * Database identity from catalog metadata (`$metadata=full`).
   */
  getDatabaseIdentity: async (): Promise<{
    uniqId: string | null
    baseId: string | null
    name: string | null
  }> => {
    const catalog: CatalogWithMetadataExpanded = await client.catalog.getAllWithMetadataCached()
    return {
      uniqId: catalog.__UNIQID ?? null,
      baseId: catalog.__BASEID ?? getCurrentBaseId(),
      name: catalog.__NAME ?? null,
    }
  },

  /**
   * Get dataclass schema (attributes)
   */
  getDataclassSchema: async (dataclassName: string) => {
    const catalog = await client.catalog.getAllWithMetadataCached()
    const dc = catalog.dataClasses.find((d) => d.name === dataclassName)

    if (!dc) {
      throw new Error(`Dataclass ${dataclassName} not found in catalog`)
    }

    return {
      dataclass: dc.name,
      attributes: (dc.attributes || []).map((attr) => ({
        name: attr.name,
        type: attr.type,
        kind: attr.kind,
        behavior: attr.behavior,
        indexed: attr.indexed ?? false,
        unique: attr.unique ?? false,
        readOnly: attr.readOnly ?? false,
        autosequence: (attr as { autosequence?: boolean }).autosequence ?? false,
        // Relation metadata — used by null relatedEntity display
        foreignKey: attr.foreignKey,
        inverseName: attr.inverseName,
        path: attr.path,
        scope: attr.scope,
      })),
      key: dc.key?.[0]?.name,
    }
  },

  /**
   * Create a cached entity set on the server from filter/sort/select options.
   */
  createEntitySet: async (
    dataclassName: string,
    params?: EntityQueryParams
  ): Promise<{ id: string; uri: string; dataclass: string; count: number }> => {
    const baseQuery = buildDataclassQuery(dataclassName, params)
    const ref = await baseQuery.toEntitySet(ENTITY_SET_TIMEOUT_SEC)
    return {
      id: ref.id,
      uri: ref.uri,
      dataclass: dataclassName,
      count: ref.count,
    }
  },

  /**
   * Combine two cached entity sets on the same dataclass ($logicOperator + $otherCollection).
   * AND/OR/EXCEPT create a new entity set; INTERSECT returns whether they share any entity.
   */
  combineEntitySets: async (
    dataclassName: string,
    params: {
      entitySetId: string
      otherEntitySetId: string
      operator: string
    }
  ): Promise<
    | {
        dataclass: string
        operator: 'INTERSECT'
        entitySetId: string
        otherEntitySetId: string
        intersects: boolean
      }
    | {
        dataclass: string
        operator: 'AND' | 'OR' | 'EXCEPT'
        entitySetId: string
        sourceEntitySetIds: [string, string]
        uri: string
        count: number
      }
  > => {
    const operator = normalizeEntitySetOperator(params.operator)
    if (!operator) {
      throw new Error('operator must be AND, OR, EXCEPT, or INTERSECT')
    }

    const entitySetId = params.entitySetId.trim()
    const otherEntitySetId = params.otherEntitySetId.trim()
    if (!entitySetId || !otherEntitySetId) {
      throw new Error('entitySetId and otherEntitySetId are required')
    }

    const entitySet = client.dataclass(dataclassName).entitySet(entitySetId)

    if (operator === 'INTERSECT') {
      const intersects = await entitySet.intersects(otherEntitySetId)
      return {
        dataclass: dataclassName,
        operator,
        entitySetId,
        otherEntitySetId,
        intersects,
      }
    }

    const combined = await entitySet.combineToEntitySet(
      operator,
      otherEntitySetId,
      ENTITY_SET_TIMEOUT_SEC
    )
    const preview = await combined.fetch({ $top: 0 })
    const baseUrl = client.getHttpClient().getBaseUrl()
    return {
      dataclass: dataclassName,
      operator,
      entitySetId: combined.id,
      sourceEntitySetIds: [entitySetId, otherEntitySetId],
      uri: `${baseUrl}/rest/${dataclassName}/$entityset/${combined.id}`,
      count: preview.__COUNT,
    }
  },

  /**
   * Get entities from a dataclass with pagination and filtering.
   * By default fetches via an entity set: reuses it when only page/limit change; when
   * filter/sort/select change, releases the previous entity set and creates a new one.
   * Pass entitySetId to load from an existing server-side entity set (skips creation).
   * Pass createEntitySet: false to query the dataclass directly without creating an entity set.
   */
  getEntities: async (
    dataclassName: string,
    params?: {
      page?: number
      top?: number
      /** @deprecated use top */
      limit?: number
      sort?: string
      order?: 'asc' | 'desc'
      filter?: string
      select?: string[]
      /** Relation attributes to expand ($expand), e.g. ['employer'] or ['employer.*'] */
      expand?: string[]
      filterParams?: Array<{ type: string; value: string }>
      entitySetId?: string
      /** When false, query without creating/reusing an entity set. Default true when no entitySetId. */
      createEntitySet?: boolean
      /** Include `$queryplan` and `$querypath` in the REST request. */
      explain?: boolean
    }
  ): Promise<{
    dataclass: string
    entities: Entity[]
    pagination: Pagination
    entitySetId: string
    queryExplain: QueryExplainPayload | null
  }> => {
    const page = params?.page ?? 1
    const top = params?.top ?? params?.limit ?? 20
    const skip = (page - 1) * top
    const explainRequested = params?.explain === true

    // Load from an existing entity set (e.g. tab opened by entity set ID)
    if (params?.entitySetId) {
      const queryOptions = buildEntitySetPageOptions(params)
      const result = await client
        .dataclass(dataclassName)
        .entitySet(params.entitySetId)
        .fetchPage(skip, top, queryOptions)
      const total = result.__COUNT
      const totalPages = Math.ceil(total / top)
      return {
        dataclass: dataclassName,
        entities: result.__ENTITIES.map((e) => ({ ...e, id: e.__KEY })),
        pagination: {
          page,
          limit: top,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        entitySetId: params.entitySetId,
        queryExplain: explainFromCollection(result, explainRequested),
      }
    }

    // Direct dataclass query — no server entity set
    if (params?.createEntitySet === false) {
      const result = await buildDataclassQuery(dataclassName, params).skip(skip).top(top).fetch()
      const total = result.__COUNT
      const totalPages = Math.ceil(total / top)
      return {
        dataclass: dataclassName,
        entities: result.__ENTITIES.map((e) => ({ ...e, id: e.__KEY })),
        pagination: {
          page,
          limit: top,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        entitySetId: '',
        queryExplain: explainFromCollection(result, explainRequested),
      }
    }

    const queryKey = getEntitiesQueryKey(params)

    // Reuse existing entity set when only page/limit changed (same filter/sort/select/expand)
    const existing = currentEntitySetByDataclass.get(dataclassName)
    if (existing?.queryKey === queryKey) {
      const result = await client
        .dataclass(dataclassName)
        .entitySet(existing.entitySetId)
        .fetchPage(skip, top, buildEntitySetPageOptions(params))
      const total = result.__COUNT
      const totalPages = Math.ceil(total / top)
      return {
        dataclass: dataclassName,
        entities: result.__ENTITIES.map((e) => ({ ...e, id: e.__KEY })),
        pagination: {
          page,
          limit: top,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        entitySetId: existing.entitySetId,
        queryExplain: explainFromCollection(result, explainRequested),
      }
    }

    const baseQuery = buildDataclassQuery(dataclassName, params)

    // Release previous entity set for this dataclass when no tab still references it
    if (existing) {
      currentEntitySetByDataclass.delete(dataclassName)
      const tabs = useTabsStore.getState().tabs
      const stillUsedByTab = tabs.some(
        (t) => t.type === 'dataclass' && t.entitySetId === existing.entitySetId
      )
      if (!stillUsedByTab) {
        await releaseEntitySetOnServer(dataclassName, existing.entitySetId)
      }
    }

    // Create entity set and fetch page from it
    const ref = await baseQuery.toEntitySet(ENTITY_SET_TIMEOUT_SEC)
    currentEntitySetByDataclass.set(dataclassName, { queryKey, entitySetId: ref.id })

    const entitySet = client.dataclass(dataclassName).entitySet(ref.id)
    const result = await entitySet.fetchPage(skip, top, buildEntitySetPageOptions(params))

    const total = result.__COUNT
    const totalPages = Math.ceil(total / top)

    return {
      dataclass: dataclassName,
      entities: result.__ENTITIES.map((e) => ({
        ...e,
        id: e.__KEY,
      })),
      pagination: {
        page,
        limit: top,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      entitySetId: ref.id,
      queryExplain: explainFromCollection(result, explainRequested, {
        queryPlan: ref.queryPlan,
        queryPath: ref.queryPath,
      }),
    }
  },

  /**
   * Get a single entity by key
   */
  getEntity: async (dataclassName: string, key: string) => {
    const entity = await client.dataclass(dataclassName).get(key)
    return {
      dataclass: dataclassName,
      entity: { ...entity, id: entity.__KEY },
    }
  },

  /**
   * Fetch a deferred relation (related entity or related entity set) by its
   * 4D REST `__deferred.uri`. Returns the raw JSON: a single entity object for
   * relatedEntity, or an entity collection ({ __ENTITIES, __COUNT, ... }) for
   * relatedEntities. Optional paging via top/skip applies to entity sets.
   * Set `subEntitySet` to append `$method=subentityset` when loading a related
   * (sub) entity set — always includes `$expand=<relation>` (required by 4D REST).
   */
  fetchRelated: async (
    uri: string,
    params?: {
      top?: number
      skip?: number
      subEntitySet?: boolean
      /** Relation name for `$expand` (defaults to last path segment when subEntitySet). */
      expand?: string
      sort?: string
      order?: 'asc' | 'desc'
    }
  ): Promise<Record<string, unknown>> => {
    // Deferred URIs are absolute REST paths (e.g. "/rest/Company(1)/employees?$expand=employees").
    // Strip leading "/rest" and any query string so we control $expand/$method/$top.
    const withoutRest = uri.replace(/^\/rest/, '')
    const path = withoutRest.split('?')[0] ?? withoutRest
    const queryParams: Record<string, unknown> = {}
    if (params?.subEntitySet) {
      queryParams.$method = 'subentityset'
      const expand = params.expand?.trim() || path.split('/').filter(Boolean).at(-1) || undefined
      if (expand) queryParams.$expand = expand
    } else if (params?.expand?.trim()) {
      queryParams.$expand = params.expand.trim()
    }
    if (params?.top != null) queryParams.$top = params.top
    if (params?.skip != null) queryParams.$skip = params.skip
    if (params?.sort) queryParams.$orderby = `${params.sort} ${params.order ?? 'asc'}`
    return client.getHttpClient().get<Record<string, unknown>>(path, queryParams)
  },

  /**
   * Create a new entity
   */
  createEntity: async (dataclassName: string, data: Record<string, unknown>) => {
    const resolved = resolveEnvTemplatesDeepWithThis(data, getActiveEnvMap(), (current) =>
      buildEntityThis(current as Record<string, unknown>)
    )
    if (resolved.unresolved.length > 0) {
      consoleService.warn(`Unresolved environment variables: ${resolved.unresolved.join(', ')}`)
    }
    const schema = await api.getDataclassSchema(dataclassName)
    const value = coerceEntityDataBySchema(
      resolved.value as Record<string, unknown>,
      schema.attributes
    )
    const result = await client.dataclass(dataclassName).create(value)
    return {
      dataclass: dataclassName,
      entity: { ...result, id: result.__KEY },
      created: true,
    }
  },

  /**
   * Update an existing entity
   */
  updateEntity: async (dataclassName: string, key: string, data: Record<string, unknown>) => {
    const thisRoot = buildEntityThis(data)
    const keyResolved = resolveEnvTemplates(key, getActiveEnvMap(), { this: thisRoot })
    const resolved = resolveEnvTemplatesDeepWithThis(data, getActiveEnvMap(), (current) =>
      buildEntityThis(current as Record<string, unknown>)
    )
    const unresolved = [...keyResolved.unresolved]
    for (const u of resolved.unresolved) {
      if (!unresolved.includes(u)) unresolved.push(u)
    }
    if (unresolved.length > 0) {
      consoleService.warn(`Unresolved environment variables: ${unresolved.join(', ')}`)
    }
    const schema = await api.getDataclassSchema(dataclassName)
    const value = coerceEntityDataBySchema(
      resolved.value as Record<string, unknown>,
      schema.attributes
    )
    const result = await client.dataclass(dataclassName).update(keyResolved.text, value)
    return {
      dataclass: dataclassName,
      entity: { ...result, id: result.__KEY },
      updated: true,
    }
  },

  /**
   * Delete an entity
   */
  deleteEntity: async (dataclassName: string, key: string) => {
    await client.dataclass(dataclassName).delete(key)
    return {
      dataclass: dataclassName,
      id: key,
      deleted: true,
    }
  },

  /**
   * Delete many entities in one REST request ($method=delete on keys, filter, or entity set).
   * Omit filter/keys/entitySetId to delete all entities in the dataclass.
   * @see https://developer.4d.com/docs/REST/method#methoddelete
   */
  deleteManyEntities: async (
    dataclassName: string,
    params?: EntityQueryParams & {
      entitySetId?: string
      /** Delete these entity keys via `__KEY in :1` (one REST request). */
      keys?: Array<string | number>
    }
  ) => {
    if (params?.entitySetId) {
      const entitySet = client.dataclass(dataclassName).entitySet(params.entitySetId)
      const preview = await entitySet.fetch({ $top: 0 })
      await entitySet.delete()
      return {
        dataclass: dataclassName,
        deleted: true,
        count: preview.__COUNT,
        entitySetId: params.entitySetId,
      }
    }

    if (params?.keys?.length) {
      const keys = params.keys.map((key) => {
        const raw = String(key)
        return /^-?\d+$/.test(raw) ? Number(raw) : raw
      })
      const keyParams: EntityQueryParams = {
        filter: '__KEY in :1',
        filterParams: [{ type: 'json', value: JSON.stringify(keys) }],
      }
      const preview = await buildDataclassQuery(dataclassName, keyParams).top(0).fetch()
      await buildDataclassQuery(dataclassName, keyParams).delete()
      return {
        dataclass: dataclassName,
        deleted: true,
        count: preview.__COUNT,
        keys: params.keys.map(String),
      }
    }

    const query = buildDataclassQuery(dataclassName, params)
    const preview = await query.top(0).fetch()
    await buildDataclassQuery(dataclassName, params).delete()
    return {
      dataclass: dataclassName,
      deleted: true,
      count: preview.__COUNT,
      filter: params?.filter,
    }
  },

  /**
   * Create multiple entities via REST `$method=update` (array body).
   * Resolves env templates per entity, then sends in batches of {@link CREATE_ENTITIES_BATCH_SIZE}.
   */
  createManyEntities: async (dataclassName: string, entities: Record<string, unknown>[]) => {
    if (entities.length === 0) {
      return {
        dataclass: dataclassName,
        created: true,
        count: 0,
        entities: [] as Array<Record<string, unknown> & { id: unknown }>,
      }
    }

    const schema = await api.getDataclassSchema(dataclassName)
    const prepared: Record<string, unknown>[] = []
    const unresolved: string[] = []
    for (const entity of entities) {
      const resolved = resolveEnvTemplatesDeepWithThis(entity, getActiveEnvMap(), (current) =>
        buildEntityThis(current as Record<string, unknown>)
      )
      for (const key of resolved.unresolved) {
        if (!unresolved.includes(key)) unresolved.push(key)
      }
      prepared.push(
        coerceEntityDataBySchema(resolved.value as Record<string, unknown>, schema.attributes)
      )
    }
    if (unresolved.length > 0) {
      consoleService.warn(`Unresolved environment variables: ${unresolved.join(', ')}`)
    }

    const allResults = []
    for (let offset = 0; offset < prepared.length; offset += CREATE_ENTITIES_BATCH_SIZE) {
      const chunk = prepared.slice(offset, offset + CREATE_ENTITIES_BATCH_SIZE)
      const results = await client.dataclass(dataclassName).updateMany(chunk)
      allResults.push(...results)
    }

    return {
      dataclass: dataclassName,
      created: true,
      count: allResults.length,
      entities: allResults.map((entity) => ({ ...entity, id: entity.__KEY })),
    }
  },

  /**
   * Update multiple entities in one REST request ($method=update with an array body).
   * Each item must include __KEY and __STAMP from a prior query.
   */
  updateManyEntities: async (dataclassName: string, entities: Record<string, unknown>[]) => {
    const results = await client.dataclass(dataclassName).updateMany(entities)
    return {
      dataclass: dataclassName,
      updated: true,
      count: results.length,
      entities: results.map((entity) => ({ ...entity, id: entity.__KEY })),
    }
  },

  /**
   * Release a cached entity set from the server ($method=release).
   */
  releaseEntitySet: async (dataclassName: string, entitySetId: string) => {
    const { dataClass, entitySetId: id } = normalizeEntitySetReleaseInput(
      dataclassName,
      entitySetId
    )
    const detachedTabs = detachEntitySetFromTabs(dataClass, id)
    await releaseEntitySetOnServer(dataClass, id)
    return {
      dataclass: dataClass,
      entitySetId: id,
      released: true,
      detachedTabs,
    }
  },

  /**
   * Release multiple cached entity sets ($method=release).
   */
  releaseEntitySets: async (entitySets: EntitySetReleaseInput[]) => {
    if (!Array.isArray(entitySets) || entitySets.length === 0) {
      throw new Error('entitySets must be a non-empty array')
    }

    const normalized = entitySets.map((item) =>
      normalizeEntitySetReleaseInput(item.dataClass, item.entitySetId)
    )
    const detachedTabs = detachEntitySetsFromTabs(normalized)
    const results = []

    for (const { dataClass, entitySetId } of normalized) {
      await releaseEntitySetOnServer(dataClass, entitySetId)
      results.push({
        dataclass: dataClass,
        entitySetId,
        released: true,
      })
    }

    return {
      count: results.length,
      detachedTabs,
      results,
    }
  },

  /**
   * Call an exposed 4D class function (dataclass, entity, entity selection, singleton, or catalog).
   * Optional `wrapper` is merged into the POST body as `{ params: [...], ...wrapper }`.
   */
  callMethod: async (
    input: MethodToolInvokeInput & {
      wrapper?: Record<string, unknown>
      signal?: AbortSignal
      headers?: Record<string, string>
      query?: Record<string, string>
      /**
       * When false, skip the built-in `$method=entityset` query flag
       * (Method Executor sends `$method` via Advanced → Params instead).
       */
      createEntitySet?: boolean
    }
  ): Promise<FunctionCallResult> => {
    const http = client.getHttpClient()
    const params = input.params ?? []
    const fnOptions = {
      method: (input.allowedOnHTTPGET ? 'GET' : 'POST') as 'GET' | 'POST',
      filter: input.filter,
      orderby: input.orderby,
      entitySetId: input.entitySetId,
      wrapper: input.wrapper,
      signal: input.signal,
      headers: input.headers,
      query: input.query,
      createEntitySet: input.createEntitySet,
    }

    switch (input.scope) {
      case 'catalog':
        return callDataStoreFunction(http, input.methodName, params, fnOptions)
      case 'singleton':
        if (!input.singletonName) throw new Error('singletonName is required')
        return callSingletonFunction(http, input.singletonName, input.methodName, params, fnOptions)
      case 'entity':
        if (!input.dataClass) throw new Error('dataClass is required')
        if (input.key === undefined) throw new Error('key is required for entity methods')
        return callEntityFunction(
          http,
          input.dataClass,
          input.key,
          input.methodName,
          params,
          fnOptions
        )
      case 'entitySelection':
        if (!input.dataClass) throw new Error('dataClass is required')
        return callEntitySelectionFunction(
          http,
          input.dataClass,
          input.methodName,
          params,
          fnOptions
        )
      default:
        if (!input.dataClass) throw new Error('dataClass is required')
        return callDataClassFunction(http, input.dataClass, input.methodName, params, fnOptions)
    }
  },

  /**
   * Upload a file (image or binary) to the server
   * Returns the upload ID that can be used to update entity attributes
   */
  uploadFile: async (file: File, isImage: boolean): Promise<{ ID: string }> => {
    const httpClient = client.getHttpClient()
    const baseUrl = httpClient.getBaseUrl()
    const url = `${baseUrl}/rest/$upload?${isImage ? '$rawPict=true' : '$binary=true'}`

    // Create form data or use blob directly
    const platformFetch = getLoggingFetch()
    const response = await platformFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': isImage ? 'image/png' : 'application/octet-stream',
      },
      body: file,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    return result as { ID: string }
  },

  /**
   * Fetch a binary (BLOB/picture) payload from a deferred REST URI. Routes
   * through the platform fetch so desktop auth/cookies are applied, and returns
   * the decoded bytes plus the server-reported content type.
   */
  fetchBinary: async (uri: string): Promise<{ bytes: Uint8Array; contentType: string | null }> => {
    const url = /^https?:\/\//.test(uri)
      ? uri
      : `${getBaseUrl()}${uri.startsWith('/') ? '' : '/'}${uri}`
    const platformFetch = getLoggingFetch()
    const response = await platformFetch(url, {
      method: 'GET',
      headers: { ...getCustomHeaders() },
    })
    if (!response.ok) {
      throw new Error(`Failed to load binary: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    return { bytes: new Uint8Array(buffer), contentType: response.headers.get('content-type') }
  },
}

// Export the client for advanced usage
export { client }
