import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { api } from '~/lib/api'
import { AUTO_COUNT_THRESHOLD } from '~/lib/dataclass-counts'
import { removeStatusField } from '~/lib/entitySanitizer'
import { eventBus } from '~/lib/eventBus'
import { isDataclassTab, normalizeQueryOptions, type QueryOptions, useTabsStore } from './tabs'

export type Dataclass = {
  name: string
  collectionName: string
  /** Entity count; `null` means not loaded yet. */
  count: number | null
}

export type Entity = Record<string, unknown> & {
  id: string
  __KEY: string
  __STAMP: number
}

export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Re-export QueryOptions from tabs store for backward compatibility
export type { QueryOptions } from './tabs'

/**
 * Per-tab entity view state. The top-level fields of {@link DataExplorerState}
 * mirror the active tab's slice so existing consumers keep working, while each
 * tab caches its own slice in `tabData` for instant restore on tab switch.
 */
export type EntityViewState = {
  entities: Entity[]
  pagination: Pagination | null
  selectedEntity: Entity | null
  selectedEntityId: string | null
  entitiesLoading: boolean
  entitiesError: string | null
  isEditing: boolean
  editedEntity: string | null
}

const EMPTY_VIEW: EntityViewState = {
  entities: [],
  pagination: null,
  selectedEntity: null,
  selectedEntityId: null,
  entitiesLoading: false,
  entitiesError: null,
  isEditing: false,
  editedEntity: null,
}

type DataExplorerState = {
  // Dataclasses
  dataclasses: Dataclass[]
  dataclassesLoading: boolean
  dataclassesError: string | null
  /** Names currently fetching an entity count. */
  countLoadingNames: Record<string, true>
  /** True while a batch "load all counts" is in progress. */
  countsLoadingAll: boolean

  // Selected dataclass
  selectedDataclass: string | null

  // Entities
  entities: Entity[]
  entitiesLoading: boolean
  entitiesError: string | null
  pagination: Pagination | null

  // Selected entity
  selectedEntity: Entity | null
  selectedEntityId: string | null

  // Edit mode
  isEditing: boolean
  editedEntity: string | null

  // Search/Query
  searchQuery: string

  // Per-tab cached entity view state (keyed by tab id)
  tabData: Record<string, EntityViewState>

  // Actions
  fetchDataclasses: () => Promise<void>
  /** Load entity count for one dataclass (no-op if already loading). */
  fetchDataclassCount: (name: string) => Promise<void>
  /** Load counts for all dataclasses that still have `count === null`. */
  fetchAllDataclassCounts: () => Promise<void>
  selectDataclass: (name: string | null) => void
  fetchEntities: (
    page?: number,
    queryOptions?: QueryOptions,
    options?: { createEntitySet?: boolean }
  ) => Promise<void>
  selectEntity: (entity: Entity | null) => void
  setSearchQuery: (query: string) => void
  setIsEditing: (editing: boolean) => void
  setEditedEntity: (entity: string | null) => void
  createEntity: (
    data: Record<string, unknown>,
    options?: { refresh?: boolean; count?: number }
  ) => Promise<void>
  updateEntity: (id: string, data: Record<string, unknown>) => Promise<void>
  deleteEntity: (id: string) => Promise<void>
  /** Batch delete via REST $method=delete (page keys, entity set, or all records). */
  deleteManyEntities: (options: {
    keys?: Array<string | number>
    entitySetId?: string
    /** Delete every entity in the dataclass (no filter). */
    all?: boolean
  }) => Promise<{ count: number }>
  refreshCurrentView: () => Promise<void>
  /**
   * Soft-refresh the connected app: reload catalog + current entities, then
   * remount the active dataclass tab so relation/detail UI resets.
   */
  refreshApp: () => Promise<void>
  /** Sync the top-level mirror with the active tab, restoring its cached slice instantly. */
  syncActiveTab: (activeTabId?: string | null) => void
  /** Drop a tab's cached entity view slice (e.g. when its tab is closed). */
  clearTabData: (tabId: string) => void
}

// Helper to get query options from tabs store
const getActiveTabQueryOptions = (): QueryOptions => {
  const tabsState = useTabsStore.getState()
  const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
  // Only dataclass tabs have queryOptions
  if (activeTab && isDataclassTab(activeTab)) {
    return normalizeQueryOptions(activeTab.queryOptions)
  }
  return normalizeQueryOptions({ sort: '__KEY' })
}

export const useDataExplorerStore = create<DataExplorerState>()(
  devtools(
    (set, get) => {
      /**
       * Write an entity-view patch to BOTH the top-level mirror (read by external
       * consumers and the active tab's components) AND the active tab's cached
       * slice in `tabData`, so switching tabs can restore the slice instantly.
       */
      const setView = (patch: Partial<EntityViewState>) => {
        const activeId = useTabsStore.getState().activeTabId
        set((state) => {
          const slice: EntityViewState = {
            entities: patch.entities ?? state.entities,
            pagination: patch.pagination !== undefined ? patch.pagination : state.pagination,
            selectedEntity:
              patch.selectedEntity !== undefined ? patch.selectedEntity : state.selectedEntity,
            selectedEntityId:
              patch.selectedEntityId !== undefined
                ? patch.selectedEntityId
                : state.selectedEntityId,
            entitiesLoading:
              patch.entitiesLoading !== undefined ? patch.entitiesLoading : state.entitiesLoading,
            entitiesError:
              patch.entitiesError !== undefined ? patch.entitiesError : state.entitiesError,
            isEditing: patch.isEditing !== undefined ? patch.isEditing : state.isEditing,
            editedEntity:
              patch.editedEntity !== undefined ? patch.editedEntity : state.editedEntity,
          }
          return {
            ...patch,
            tabData: activeId ? { ...state.tabData, [activeId]: slice } : state.tabData,
          }
        })
      }

      return {
        // Initial state
        dataclasses: [],
        dataclassesLoading: false,
        dataclassesError: null,
        countLoadingNames: {},
        countsLoadingAll: false,
        selectedDataclass: null,
        entities: [],
        entitiesLoading: false,
        entitiesError: null,
        pagination: null,
        selectedEntity: null,
        selectedEntityId: null,
        isEditing: false,
        editedEntity: null,
        searchQuery: '',
        tabData: {},

        // Actions
        fetchDataclasses: async () => {
          set({
            dataclassesLoading: true,
            dataclassesError: null,
            countLoadingNames: {},
            countsLoadingAll: false,
          })
          try {
            // Drop cached /$catalog/$all so schema/dataclass changes appear on web reload.
            api.clearCatalogCache()
            const dataclasses = await api.getDataclassList()
            set({ dataclasses, dataclassesLoading: false })
            eventBus.emit('catalog-reloaded')
            if (dataclasses.length > 0 && dataclasses.length < AUTO_COUNT_THRESHOLD) {
              void get().fetchAllDataclassCounts()
            }
          } catch (error) {
            set({
              dataclassesError:
                error instanceof Error ? error.message : 'Failed to fetch dataclasses',
              dataclassesLoading: false,
            })
          }
        },

        fetchDataclassCount: async (name) => {
          const { countLoadingNames, dataclasses } = get()
          if (countLoadingNames[name]) return
          const existing = dataclasses.find((dc) => dc.name === name)
          if (!existing) return

          set({ countLoadingNames: { ...countLoadingNames, [name]: true } })
          try {
            const count = await api.getDataclassCount(name)
            set((state) => {
              const nextLoading = { ...state.countLoadingNames }
              delete nextLoading[name]
              return {
                dataclasses: state.dataclasses.map((dc) =>
                  dc.name === name ? { ...dc, count } : dc
                ),
                countLoadingNames: nextLoading,
              }
            })
          } catch {
            set((state) => {
              const nextLoading = { ...state.countLoadingNames }
              delete nextLoading[name]
              return {
                dataclasses: state.dataclasses.map((dc) =>
                  dc.name === name ? { ...dc, count: 0 } : dc
                ),
                countLoadingNames: nextLoading,
              }
            })
          }
        },

        fetchAllDataclassCounts: async () => {
          const { dataclasses, countsLoadingAll } = get()
          if (countsLoadingAll) return
          const names = dataclasses.filter((dc) => dc.count === null).map((dc) => dc.name)
          if (names.length === 0) return

          const loadingPatch = Object.fromEntries(names.map((n) => [n, true as const]))
          set({
            countsLoadingAll: true,
            countLoadingNames: { ...get().countLoadingNames, ...loadingPatch },
          })
          try {
            const counts = await api.getDataclassCounts(names)
            set((state) => {
              const nextLoading = { ...state.countLoadingNames }
              for (const name of names) delete nextLoading[name]
              return {
                dataclasses: state.dataclasses.map((dc) =>
                  counts.has(dc.name) ? { ...dc, count: counts.get(dc.name) ?? 0 } : dc
                ),
                countLoadingNames: nextLoading,
                countsLoadingAll: false,
              }
            })
          } catch {
            set((state) => {
              const nextLoading = { ...state.countLoadingNames }
              for (const name of names) delete nextLoading[name]
              return { countLoadingNames: nextLoading, countsLoadingAll: false }
            })
          }
        },

        selectDataclass: (name) => {
          setView({
            entities: [],
            pagination: null,
            selectedEntity: null,
            selectedEntityId: null,
            isEditing: false,
            editedEntity: null,
          })
          set({ selectedDataclass: name, searchQuery: '' })
          // Fetch entities if a dataclass is selected
          if (name) {
            get().fetchEntities()
          }
        },

        syncActiveTab: (activeTabIdArg) => {
          const tabsState = useTabsStore.getState()
          const activeId = activeTabIdArg !== undefined ? activeTabIdArg : tabsState.activeTabId
          const activeTab = tabsState.tabs.find((t) => t.id === activeId)
          if (!activeTab || !isDataclassTab(activeTab)) {
            // Non-dataclass tab (home/settings/graph/...): clear the active mirror but
            // keep cached slices so returning to a dataclass tab restores instantly.
            set({ selectedDataclass: null, ...EMPTY_VIEW })
            return
          }
          const slice = activeId ? get().tabData[activeId] : undefined
          if (slice) {
            // Restore the active tab's cached slice instantly (no refetch).
            set({ selectedDataclass: activeTab.dataclassName, ...slice })
          } else {
            // First activation: set the dataclass and fetch its first/last page.
            set({ selectedDataclass: activeTab.dataclassName, ...EMPTY_VIEW })
            get().fetchEntities(activeTab.entitiesPage || 1)
          }
        },

        clearTabData: (tabId) => {
          set((state) => {
            if (!(tabId in state.tabData)) return state
            const next = { ...state.tabData }
            delete next[tabId]
            return { tabData: next }
          })
        },

        fetchEntities: async (
          page = 1,
          queryOptionsOverride?: QueryOptions,
          options?: { createEntitySet?: boolean }
        ) => {
          const { selectedDataclass } = get()
          if (!selectedDataclass) return

          const tabsState = useTabsStore.getState()
          const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
          const forceCreateEntitySet = options?.createEntitySet === true
          const forceQueryOnly = options?.createEntitySet === false

          // Use override or get from tabs store
          const queryOptions = queryOptionsOverride ?? getActiveTabQueryOptions()

          // Explicit run modes clear any bound selection first (create replaces; query unbinds)
          if (
            (forceCreateEntitySet || forceQueryOnly) &&
            activeTab &&
            isDataclassTab(activeTab) &&
            activeTab.entitySetId
          ) {
            tabsState.setEntitySetId(activeTab.id, null)
          }

          const boundEntitySetId =
            forceCreateEntitySet || forceQueryOnly
              ? null
              : activeTab && isDataclassTab(activeTab)
                ? activeTab.entitySetId
                : null

          setView({ entitiesLoading: true, entitiesError: null })
          try {
            // Determine which attributes to request. The per-tab field selection
            // (table + card fields, possibly dotted relation paths) takes
            // precedence; when no fields are explicitly selected, fall back to
            // the advanced comma-separated `select` from the query builder.
            const fieldConfig =
              activeTab && isDataclassTab(activeTab) ? activeTab.fieldConfig : undefined
            const selectedFields =
              fieldConfig && (fieldConfig.table.length > 0 || fieldConfig.cards.length > 0)
                ? Array.from(new Set([...fieldConfig.table, ...fieldConfig.cards]))
                : queryOptions.select
                  ? queryOptions.select
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : undefined
            const select = selectedFields

            const result = await api.getEntities(selectedDataclass, {
              page,
              top: queryOptions.top,
              sort: queryOptions.sort || undefined,
              order: queryOptions.order,
              filter: queryOptions.filter || undefined,
              select: select?.length ? select : undefined,
              filterParams:
                queryOptions.filterParams?.length > 0 ? queryOptions.filterParams : undefined,
              entitySetId: boundEntitySetId ?? undefined,
              // Unbound tabs query directly; only "Run as selection" creates a set
              createEntitySet: forceCreateEntitySet ? true : boundEntitySetId ? undefined : false,
            })

            if (activeTab && isDataclassTab(activeTab)) {
              tabsState.setEntitySetId(activeTab.id, result.entitySetId || null)
              tabsState.setEntitiesPage(activeTab.id, page)
              tabsState.setSelectionCount(activeTab.id, result.pagination.total)
            }

            // Rehydrate the in-memory selected entity from the tab's persisted
            // selectedEntityId after reload (tabs persist; entity payloads do not).
            // Skip when the store already has a matching selection so update/create
            // refresh paths keep the entity they just wrote.
            const entities = result.entities as Entity[]
            const tabSelectedId =
              activeTab && isDataclassTab(activeTab) ? activeTab.selectedEntityId : null
            const { selectedEntity: currentEntity, selectedEntityId: currentId } = get()
            const needsRehydrate =
              !!tabSelectedId && (!currentId || currentId !== tabSelectedId || !currentEntity)

            if (needsRehydrate) {
              const matched = entities.find(
                (entity) =>
                  String(entity.id) === tabSelectedId || String(entity.__KEY) === tabSelectedId
              )
              setView({
                entities,
                pagination: result.pagination,
                entitiesLoading: false,
                selectedEntityId: tabSelectedId,
                selectedEntity: matched ?? null,
                isEditing: false,
                editedEntity: matched ? JSON.stringify(matched, null, 2) : null,
              })
            } else {
              setView({
                entities,
                pagination: result.pagination,
                entitiesLoading: false,
              })
            }
          } catch (error) {
            setView({
              entitiesError: error instanceof Error ? error.message : 'Failed to fetch entities',
              entitiesLoading: false,
            })
          }
        },

        selectEntity: (entity) => {
          setView({
            selectedEntity: entity,
            selectedEntityId: entity ? entity.id : null,
            isEditing: false,
            editedEntity: entity ? JSON.stringify(entity, null, 2) : null,
          })
        },

        setSearchQuery: (query) => {
          set({ searchQuery: query })
        },

        setIsEditing: (editing) => {
          const { selectedEntity } = get()
          setView({
            isEditing: editing,
            editedEntity:
              editing && selectedEntity ? JSON.stringify(selectedEntity, null, 2) : null,
          })
        },

        setEditedEntity: (entity) => {
          setView({ editedEntity: entity })
        },

        createEntity: async (data, options) => {
          const { selectedDataclass } = get()
          if (!selectedDataclass) return

          const count =
            typeof options?.count === 'number' && Number.isFinite(options.count)
              ? Math.max(1, Math.trunc(options.count))
              : 1

          if (count === 1) {
            await api.createEntity(selectedDataclass, data)
          } else {
            // Same template N times — createManyEntities resolves templates per item, then batches.
            const templates = Array.from({ length: count }, () => data)
            await api.createManyEntities(selectedDataclass, templates)
          }

          if (options?.refresh === false) return
          await get().fetchDataclassCount(selectedDataclass)
          await get().fetchEntities()
        },

        updateEntity: async (id, data) => {
          const { selectedDataclass } = get()
          if (!selectedDataclass) return

          const updated = await api.updateEntity(selectedDataclass, id, data)
          // Remove __STATUS field from the updated entity
          const sanitizedEntity = removeStatusField(updated.entity) as Entity
          setView({
            selectedEntity: sanitizedEntity,
            selectedEntityId: sanitizedEntity.id,
            isEditing: false,
            editedEntity: JSON.stringify(sanitizedEntity, null, 2),
          })
          await get().fetchEntities(get().pagination?.page || 1)
        },

        deleteEntity: async (id) => {
          const { selectedDataclass, pagination } = get()
          if (!selectedDataclass) return

          await api.deleteEntity(selectedDataclass, id)
          setView({
            selectedEntity: null,
            selectedEntityId: null,
            isEditing: false,
            editedEntity: null,
          })
          await get().fetchDataclassCount(selectedDataclass)
          await get().fetchEntities(pagination?.page || 1)
        },

        deleteManyEntities: async (options) => {
          const { selectedDataclass } = get()
          if (!selectedDataclass) return { count: 0 }

          const tabsState = useTabsStore.getState()
          const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
          const clearBoundSet = Boolean(options.entitySetId || options.all)

          let result: { count?: number }
          if (options.all) {
            result = await api.deleteManyEntities(selectedDataclass)
          } else if (options.entitySetId) {
            result = await api.deleteManyEntities(selectedDataclass, {
              entitySetId: options.entitySetId,
            })
          } else if (options.keys?.length) {
            result = await api.deleteManyEntities(selectedDataclass, { keys: options.keys })
          } else {
            return { count: 0 }
          }

          if (clearBoundSet && activeTab && isDataclassTab(activeTab)) {
            // Entity set was deleted (or dataclass emptied) — unbind before refetch.
            tabsState.setEntitySetId(activeTab.id, null)
            tabsState.setSelectionCount(activeTab.id, null)
          }

          if (activeTab && isDataclassTab(activeTab)) {
            tabsState.setSelectedEntityId(activeTab.id, null)
          }

          setView({
            selectedEntity: null,
            selectedEntityId: null,
            isEditing: false,
            editedEntity: null,
          })
          await get().fetchDataclassCount(selectedDataclass)
          await get().fetchEntities(1)
          return { count: result.count ?? 0 }
        },

        refreshCurrentView: async () => {
          await get().fetchDataclasses()
          const { selectedDataclass, pagination } = get()
          if (selectedDataclass) {
            await get().fetchEntities(pagination?.page || 1)
          }
        },

        refreshApp: async () => {
          await get().refreshCurrentView()
          eventBus.emit('refresh-view', { skipFetch: true })
        },
      }
    },
    {
      name: 'DataExplorer',
      enabled: !!import.meta.env.DEV,
    }
  )
)
