import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import {
  releaseEntitySetIfOrphaned,
  releaseEntitySetsFromRemovedTabs,
} from '~/lib/entity-set-lifecycle'
import {
  columnPresetTableNames,
  getBaseSettings,
  getColumnPreset,
  getCurrentBaseId,
  saveBaseSettings,
} from '~/lib/storage'
import type { HttpClientSeed } from './http-client-types'
import type { MethodExecutorSeed } from './method-executor-types'
import { useSettingsStore } from './settings'

// =============================================================================
// Custom Storage Adapter
// =============================================================================

/**
 * Raw storage functions for tabs (used for manual rehydration)
 */
const tabsRawStorage = {
  getItem: (): string | null => {
    // Only return stored data if we have a base BASEID
    if (!getCurrentBaseId()) {
      return null
    }
    const settings = getBaseSettings()
    if (!settings.tabs || settings.tabs.length === 0) {
      return null
    }
    return JSON.stringify({
      state: {
        tabs: settings.tabs,
        activeTabId: settings.activeTabId,
      },
    })
  },
  setItem: (_name: string, value: string): void => {
    // Only save if we have a base BASEID
    if (!getCurrentBaseId()) {
      return
    }
    try {
      const parsed = JSON.parse(value)
      if (parsed.state) {
        saveBaseSettings({
          tabs: parsed.state.tabs ?? [],
          activeTabId: parsed.state.activeTabId ?? null,
        })
      }
    } catch {
      // Ignore parse errors
    }
  },
  removeItem: (): void => {
    if (!getCurrentBaseId()) {
      return
    }
    saveBaseSettings({ tabs: [], activeTabId: null })
  },
}

/**
 * Create zustand storage wrapper for tabs
 */
const createTabsStorage = () => createJSONStorage(() => tabsRawStorage)

// =============================================================================
// Tab Types - Using discriminated unions for type safety
// =============================================================================

/** Static tab ID for Release Notes */
export const RELEASE_NOTES_STATIC_ID = 'release-notes'

/**
 * View modes for dataclass tabs (cards = card view, table = table view)
 */
export type ViewMode = 'cards' | 'table'

/** Type of a single filter parameter value (for placeholders :1, :2, ...) */
export type FilterParamType = 'string' | 'number' | 'boolean' | 'date' | 'json'

/** One filter parameter: type and string value (coerced when sending to API) */
export type FilterParam = {
  type: FilterParamType
  value: string
}

/**
 * Query options for entities view in dataclass tabs
 */
export type QueryOptions = {
  filter: string
  /** Parameters for filter placeholders (:1, :2, ...). Order matches placeholder index. */
  filterParams: FilterParam[]
  sort: string
  order: 'asc' | 'desc'
  select: string // Comma-separated fields
  /** REST $top — max entities returned per request */
  top: number
}

/**
 * Per-tab field selection for the entity list. Each list holds ordered
 * (possibly dotted) attribute paths — e.g. "name", "company.name",
 * "manager.manager.fullName". An empty list means "use the default"
 * (all columns in the table view, the first few fields in the card view).
 */
export type FieldConfig = {
  table: string[]
  cards: string[]
}

/**
 * Base properties shared by all tab types
 */
type BaseTab = {
  id: string
  isPinned: boolean
  isClosable?: boolean
  index?: number
}

/**
 * Home tab - displays the welcome screen with database overview.
 * Has minimal state since it doesn't interact with dataclasses.
 */
export type HomeTab = BaseTab & {
  type: 'home'
  isClosable: false
  index: 0
}

/**
 * Dataclass tab - displays entities for a dataclass.
 * Contains all state needed for entity exploration.
 */
export type DataclassTab = BaseTab & {
  type: 'dataclass'
  dataclassName: string
  /** When set, entity list loads from this cached 4D entity set instead of ad-hoc queries. */
  entitySetId: string | null
  /** Optional custom tab label (e.g. "Reservation[2]/alternatives" for a related entity set). */
  customTitle?: string
  viewMode: ViewMode
  queryOptions: QueryOptions
  /** Per-tab field selection for table columns and card fields. */
  fieldConfig: FieldConfig
  queryExpanded: boolean
  /** Expanded query panel height in px; null uses the default CSS max height. */
  queryPanelHeight: number | null
  selectedEntityId: string | null
  entitiesPage: number
  /** Count from the last entity-set query for this tab (pagination total). */
  selectionCount: number | null
}

/**
 * Settings tab - displays application settings.
 * Stores expanded state for collapsible sections.
 */
export type SettingsTab = BaseTab & {
  type: 'settings'
  shortcutsExpanded: boolean
  dataclassesExpanded: boolean
  assistantToolsExpanded: boolean
  widgetsExpanded: boolean
}

/**
 * Graph tab - displays dataclass relationships as a graph.
 * Shows all dataclasses and their relations visually.
 */
export type GraphTab = BaseTab & {
  type: 'graph'
}

/**
 * Static tab - displays static markdown content (e.g. Release Notes).
 * Content is determined by staticId.
 */
export type StaticTab = BaseTab & {
  type: 'static'
  staticId: string
}

/**
 * Schema Builder tab - displays the JSON Schema Builder.
 */
export type SchemaBuilderTab = BaseTab & {
  type: 'schema-builder'
}

/**
 * Assistant Metadata tab - configure AI assistant database documentation.
 */
export type AssistantMetadataTab = BaseTab & {
  type: 'assistant-metadata'
}

export type MethodExecutorTab = BaseTab & {
  type: 'method-executor'
  seed?: MethodExecutorSeed
}

/**
 * HTTP Client tab — Postman-style request editor.
 */
export type HttpClientTab = BaseTab & {
  type: 'http-client'
  seed?: HttpClientSeed
}

/**
 * Union type for all tab types.
 * Use type guards (isHomeTab, isDataclassTab, isSettingsTab, isGraphTab, isStaticTab, isSchemaBuilderTab, isAssistantMetadataTab) to narrow the type.
 */
export type Tab =
  | HomeTab
  | DataclassTab
  | SettingsTab
  | GraphTab
  | StaticTab
  | SchemaBuilderTab
  | AssistantMetadataTab
  | MethodExecutorTab
  | HttpClientTab

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a tab is a home tab
 */
export function isHomeTab(tab: Tab): tab is HomeTab {
  return tab.type === 'home'
}

/**
 * Type guard to check if a tab is a dataclass tab
 */
export function isDataclassTab(tab: Tab): tab is DataclassTab {
  return tab.type === 'dataclass'
}

/**
 * Type guard to check if a tab is a settings tab
 */
export function isSettingsTab(tab: Tab): tab is SettingsTab {
  return tab.type === 'settings'
}

/**
 * Type guard to check if a tab is a graph tab
 */
export function isGraphTab(tab: Tab): tab is GraphTab {
  return tab.type === 'graph'
}

/**
 * Type guard to check if a tab is a static tab
 */
export function isStaticTab(tab: Tab): tab is StaticTab {
  return tab.type === 'static'
}

/**
 * Type guard to check if a tab is a schema builder tab
 */
export function isSchemaBuilderTab(tab: Tab): tab is SchemaBuilderTab {
  return tab.type === 'schema-builder'
}

/**
 * Type guard to check if a tab is an assistant metadata tab
 */
export function isAssistantMetadataTab(tab: Tab): tab is AssistantMetadataTab {
  return tab.type === 'assistant-metadata'
}

export function isMethodExecutorTab(tab: Tab): tab is MethodExecutorTab {
  return tab.type === 'method-executor'
}

export function isHttpClientTab(tab: Tab): tab is HttpClientTab {
  return tab.type === 'http-client'
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_QUERY_OPTIONS: QueryOptions = {
  filter: '',
  filterParams: [],
  sort: '',
  order: 'desc',
  select: '',
  top: 100,
}

const DEFAULT_FIELD_CONFIG: FieldConfig = {
  table: [],
  cards: [],
}

/** Normalize a persisted or partial field config into a complete one. */
export function normalizeFieldConfig(config?: Partial<FieldConfig> | null): FieldConfig {
  return {
    table: Array.isArray(config?.table) ? config.table : DEFAULT_FIELD_CONFIG.table,
    cards: Array.isArray(config?.cards) ? config.cards : DEFAULT_FIELD_CONFIG.cards,
  }
}

/** Coerce select to a comma-separated string (API/assistant may pass string[]). */
function normalizeSelect(select: unknown): string {
  if (typeof select === 'string') return select
  if (Array.isArray(select)) {
    return select.filter((v): v is string => typeof v === 'string').join(',')
  }
  return DEFAULT_QUERY_OPTIONS.select
}

/** Normalize persisted or partial query options (migrates legacy `limit` → `top`). */
export function normalizeQueryOptions(
  options?: Partial<QueryOptions> & { limit?: number }
): QueryOptions {
  const top = options?.top ?? options?.limit ?? DEFAULT_QUERY_OPTIONS.top
  return {
    filter: options?.filter ?? DEFAULT_QUERY_OPTIONS.filter,
    filterParams: options?.filterParams ?? DEFAULT_QUERY_OPTIONS.filterParams,
    sort: options?.sort ?? DEFAULT_QUERY_OPTIONS.sort,
    order: options?.order ?? DEFAULT_QUERY_OPTIONS.order,
    select: normalizeSelect(options?.select),
    top,
  }
}

// =============================================================================
// Tab Factory Functions
// =============================================================================

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

/**
 * Creates a new home tab (always pinned)
 */
const createHomeTab = (): HomeTab => ({
  id: generateTabId(),
  type: 'home',
  isPinned: true,
  isClosable: false,
  index: 0,
})

/**
 * Creates a new dataclass tab with default state from settings
 */
const createDataclassTab = (
  dataclassName: string,
  options?: {
    entitySetId?: string | null
    customTitle?: string
    queryOptions?: Partial<QueryOptions>
    viewMode?: ViewMode
    fieldConfig?: Partial<FieldConfig>
  }
): DataclassTab => {
  // Get default settings from settings store
  const { defaultViewMode, pageSize } = useSettingsStore.getState()
  // Seed field selection from a saved per-dataclass preset when available, so a
  // freshly opened tab reflects the user's chosen default columns/card fields.
  const preset = getColumnPreset(dataclassName)
  return {
    id: generateTabId(),
    type: 'dataclass',
    dataclassName,
    entitySetId: options?.entitySetId ?? null,
    customTitle: options?.customTitle,
    isPinned: false,
    viewMode: options?.viewMode ?? defaultViewMode,
    queryOptions: normalizeQueryOptions({
      ...DEFAULT_QUERY_OPTIONS,
      top: pageSize,
      ...options?.queryOptions,
    }),
    fieldConfig: normalizeFieldConfig(
      options?.fieldConfig ??
        (preset ? { table: columnPresetTableNames(preset), cards: preset.cards } : undefined)
    ),
    queryExpanded: false,
    queryPanelHeight: null,
    selectedEntityId: null,
    entitiesPage: 1,
    selectionCount: null,
  }
}

/**
 * Creates a new settings tab
 */
const createSettingsTab = (): SettingsTab => ({
  id: generateTabId(),
  type: 'settings',
  isPinned: false,
  shortcutsExpanded: false,
  dataclassesExpanded: false,
  assistantToolsExpanded: false,
  widgetsExpanded: false,
})

/**
 * Creates a new graph tab
 */
const createGraphTab = (): GraphTab => ({
  id: generateTabId(),
  type: 'graph',
  isPinned: false,
})

/**
 * Creates a new static tab (e.g. release-notes)
 */
const createStaticTab = (staticId: string): StaticTab => ({
  id: generateTabId(),
  type: 'static',
  staticId,
  isPinned: false,
})

/**
 * Creates a new schema builder tab
 */
const createSchemaBuilderTab = (): SchemaBuilderTab => ({
  id: generateTabId(),
  type: 'schema-builder',
  isPinned: false,
})

/**
 * Creates a new assistant metadata tab
 */
const createAssistantMetadataTab = (): AssistantMetadataTab => ({
  id: generateTabId(),
  type: 'assistant-metadata',
  isPinned: false,
})

const createMethodExecutorTab = (seed?: MethodExecutorSeed): MethodExecutorTab => ({
  id: generateTabId(),
  type: 'method-executor',
  isPinned: false,
  seed,
})

const createHttpClientTab = (seed?: HttpClientSeed): HttpClientTab => ({
  id: generateTabId(),
  type: 'http-client',
  isPinned: false,
  seed,
})

// =============================================================================
// Store Types
// =============================================================================

type TabsState = {
  tabs: Tab[]
  activeTabId: string | null
  /**
   * Most-recently-used activation order of tab IDs (highest "weight" first).
   * The active tab is at index 0, the previously active tab at index 1, etc.
   * Maintained automatically whenever `activeTabId` changes. Used to return
   * focus to the previously used tab when the active one is closed, instead of
   * the positionally-adjacent tab.
   */
  tabActivationOrder: string[]

  // Tab management actions
  openTab: (dataclassName: string) => void
  /** Open a dataclass tab bound to a server-side entity set (by ID). */
  openEntitySetTab: (options: {
    dataclassName: string
    entitySetId: string
    customTitle?: string
    queryOptions?: Partial<QueryOptions>
    viewMode?: ViewMode
    /** When true, always create a new tab even if one with the same entity set exists. */
    forceNew?: boolean
  }) => string
  openAllDataclasses: (dataclassNames: string[]) => void
  openHomeTab: () => void
  openSettingsTab: () => void
  openGraphTab: () => Promise<void>
  openStaticTab: (staticId: string) => void
  openSchemaBuilderTab: () => void
  openAssistantMetadataTab: () => void
  openMethodExecutorTab: (seed?: MethodExecutorSeed) => string
  openHttpClientTab: (seed?: HttpClientSeed) => string
  /** Called by DataclassGraph when mounted and ready to receive highlight events */
  notifyGraphTabReady: () => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeTabsToRight: (tabId: string) => void
  closeAllTabs: () => void
  closeUnpinnedTabs: () => void
  setActiveTab: (tabId: string | null) => void
  pinTab: (tabId: string) => void
  unpinTab: (tabId: string) => void
  togglePinTab: (tabId: string) => void
  pinAllTabs: () => void
  unpinAllTabs: () => void
  moveTab: (fromIndex: number, toIndex: number) => void
  reorderTabs: (tabs: Tab[]) => void

  // Dataclass tab content actions (only applicable to dataclass tabs)
  setViewMode: (tabId: string, viewMode: ViewMode) => void
  setQueryOptions: (tabId: string, options: Partial<QueryOptions>) => void
  /** Update the per-tab field selection (table columns / card fields). */
  setFieldConfig: (tabId: string, config: Partial<FieldConfig>) => void
  setQueryExpanded: (tabId: string, expanded: boolean) => void
  setQueryPanelHeight: (tabId: string, height: number | null) => void
  resetQueryOptions: (tabId: string) => void
  setSelectedEntityId: (tabId: string, entityId: string | null) => void
  setEntitySetId: (tabId: string, entitySetId: string | null) => void
  setEntitiesPage: (tabId: string, page: number) => void
  setSelectionCount: (tabId: string, count: number | null) => void

  // Settings tab content actions (only applicable to settings tabs)
  setSettingsShortcutsExpanded: (tabId: string, expanded: boolean) => void
  setSettingsDataclassesExpanded: (tabId: string, expanded: boolean) => void
  setSettingsAssistantToolsExpanded: (tabId: string, expanded: boolean) => void
  setSettingsWidgetsExpanded: (tabId: string, expanded: boolean) => void

  // Apply default settings to all existing dataclass tabs
  applyDefaultViewModeToAllTabs: (viewMode: ViewMode) => void
  applyDefaultPageSizeToAllTabs: (pageSize: number) => void

  // Rehydrate tabs from storage (call after base BASEID is set)
  rehydrateTabs: () => void
}

// Helper to update a specific dataclass tab
const updateDataclassTab = (
  tabs: Tab[],
  tabId: string,
  updates: Partial<Omit<DataclassTab, 'id' | 'type'>>
): Tab[] =>
  tabs.map((tab) => {
    if (tab.id === tabId && isDataclassTab(tab)) {
      return { ...tab, ...updates }
    }
    return tab
  })

// Helper to update a specific settings tab
const updateSettingsTab = (
  tabs: Tab[],
  tabId: string,
  updates: Partial<Omit<SettingsTab, 'id' | 'type'>>
): Tab[] =>
  tabs.map((tab) => {
    if (tab.id === tabId && isSettingsTab(tab)) {
      return { ...tab, ...updates }
    }
    return tab
  })

// =============================================================================
// Graph tab ready promise (module-level so not persisted)
// =============================================================================

const graphTabReadyResolvers: Array<() => void> = []

const commitTabsUpdate = (
  set: (partial: Partial<TabsState> | ((state: TabsState) => Partial<TabsState>)) => void,
  get: () => TabsState,
  newTabs: Tab[],
  activeTabId: string | null
) => {
  releaseEntitySetsFromRemovedTabs(get().tabs, newTabs)
  set({ tabs: newTabs, activeTabId })
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useTabsStore = create<TabsState>()(
  devtools(
    persist(
      (set, get) => ({
        tabs: [],
        activeTabId: null,
        tabActivationOrder: [],

        /**
         * Opens a dataclass tab. If a tab for this dataclass already exists, activates it.
         */
        openTab: (dataclassName) => {
          const { tabs } = get()
          // Check if tab for this dataclass already exists (unfiltered tabs only)
          const existingTab = tabs.find(
            (t) => isDataclassTab(t) && t.dataclassName === dataclassName && !t.entitySetId
          )
          if (existingTab) {
            set({ activeTabId: existingTab.id })
            return
          }

          // Create new dataclass tab
          const newTab = createDataclassTab(dataclassName)

          // Insert after pinned tabs
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const newTabs = [...tabs.slice(0, pinnedCount), newTab, ...tabs.slice(pinnedCount)]

          set({ tabs: newTabs, activeTabId: newTab.id })
        },

        openEntitySetTab: ({
          dataclassName,
          entitySetId,
          customTitle,
          queryOptions,
          viewMode,
          forceNew = false,
        }) => {
          const { tabs } = get()

          if (!forceNew) {
            // Match an existing tab by its stable custom title when available
            // (e.g. "Employee[403]/reservations"), otherwise by entity set ID.
            // The server allocates a fresh entity set ID on every relation load,
            // so matching by ID alone would always miss and create duplicates.
            const existingTab = tabs.find(
              (t) =>
                isDataclassTab(t) &&
                (customTitle ? t.customTitle === customTitle : t.entitySetId === entitySetId)
            )
            if (existingTab) {
              // Refresh the bound entity set ID so the tab reflects current data.
              set({
                tabs: tabs.map((t) =>
                  t.id === existingTab.id && isDataclassTab(t) ? { ...t, entitySetId } : t
                ),
                activeTabId: existingTab.id,
              })
              return existingTab.id
            }
          }

          const newTab = createDataclassTab(dataclassName, {
            entitySetId,
            customTitle,
            queryOptions,
            viewMode,
          })

          // Insert right after the currently active tab so the new tab opens
          // immediately to its right. Never insert inside the pinned region.
          const { activeTabId } = get()
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const activeIndex = tabs.findIndex((t) => t.id === activeTabId)
          const insertAt = activeIndex >= 0 ? Math.max(activeIndex + 1, pinnedCount) : pinnedCount
          const newTabs = [...tabs.slice(0, insertAt), newTab, ...tabs.slice(insertAt)]
          set({ tabs: newTabs, activeTabId: newTab.id })
          return newTab.id
        },

        /**
         * Opens tabs for all provided dataclasses. Skips dataclasses that already have tabs.
         * Activates the first newly created tab, or the first existing tab if all are already open.
         */
        openAllDataclasses: (dataclassNames) => {
          const { tabs } = get()

          // Find which dataclasses don't have tabs yet
          const existingDataclasses = new Set(
            tabs.filter(isDataclassTab).map((t) => t.dataclassName)
          )
          const newDataclassNames = dataclassNames.filter((name) => !existingDataclasses.has(name))

          if (newDataclassNames.length === 0) {
            // All dataclasses already have tabs, activate the first one
            const firstTab = tabs.find(
              (t) => isDataclassTab(t) && dataclassNames.includes(t.dataclassName)
            )
            if (firstTab) {
              set({ activeTabId: firstTab.id })
            }
            return
          }

          // Create new tabs for all missing dataclasses
          const newTabs = newDataclassNames.map((name) => createDataclassTab(name))

          // Insert after pinned tabs
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const updatedTabs = [
            ...tabs.slice(0, pinnedCount),
            ...newTabs,
            ...tabs.slice(pinnedCount),
          ]

          set({ tabs: updatedTabs, activeTabId: newTabs[0].id })
        },

        /**
         * Opens the Home/Welcome tab showing database statistics and overview.
         * If a home tab already exists, activates it instead of creating a new one.
         */
        openHomeTab: () => {
          const { tabs } = get()
          // Check if home tab already exists
          const existingHomeTab = tabs.find(isHomeTab)
          if (existingHomeTab) {
            set({ activeTabId: existingHomeTab.id })
            return
          }

          // Create new home tab and insert at the beginning
          const homeTab = createHomeTab()
          set({ tabs: [homeTab, ...tabs], activeTabId: homeTab.id })
        },

        /**
         * Opens the Settings tab. If a settings tab already exists, activates it.
         */
        openSettingsTab: () => {
          const { tabs } = get()
          // Check if settings tab already exists
          const existingSettingsTab = tabs.find(isSettingsTab)
          if (existingSettingsTab) {
            set({ activeTabId: existingSettingsTab.id })
            return
          }

          // Create new settings tab
          const settingsTab = createSettingsTab()

          // Insert after pinned tabs
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const newTabs = [...tabs.slice(0, pinnedCount), settingsTab, ...tabs.slice(pinnedCount)]

          set({ tabs: newTabs, activeTabId: settingsTab.id })
        },

        /**
         * Opens the Graph tab. If a graph tab already exists, activates it.
         * Returns a Promise that resolves when the graph tab content is mounted and ready.
         */
        openGraphTab: () => {
          const { tabs, activeTabId } = get()
          const existingGraphTab = tabs.find(isGraphTab)
          const graphTabId = existingGraphTab?.id

          // Already on graph tab: resolve immediately
          if (graphTabId && activeTabId === graphTabId) {
            return Promise.resolve()
          }

          const promise = new Promise<void>((resolve) => {
            graphTabReadyResolvers.push(resolve)
          })

          if (existingGraphTab) {
            set({ activeTabId: existingGraphTab.id })
            return promise
          }

          const graphTab = createGraphTab()
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const newTabs = [...tabs.slice(0, pinnedCount), graphTab, ...tabs.slice(pinnedCount)]
          set({ tabs: newTabs, activeTabId: graphTab.id })
          return promise
        },

        /**
         * Opens a static tab (e.g. release-notes). If a tab for this staticId already exists, activates it.
         */
        openStaticTab: (staticId) => {
          const { tabs } = get()
          const existingTab = tabs.find((t) => isStaticTab(t) && t.staticId === staticId)
          if (existingTab) {
            set({ activeTabId: existingTab.id })
            return
          }

          const newTab = createStaticTab(staticId)
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const newTabs = [...tabs.slice(0, pinnedCount), newTab, ...tabs.slice(pinnedCount)]
          set({ tabs: newTabs, activeTabId: newTab.id })
        },

        /**
         * Opens the Schema Builder tab. If a schema builder tab already exists, activates it.
         */
        openSchemaBuilderTab: () => {
          const { tabs } = get()
          const existingTab = tabs.find((t) => t.type === 'schema-builder')
          if (existingTab) {
            set({ activeTabId: existingTab.id })
            return
          }

          const newTab = createSchemaBuilderTab()
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const newTabs = [...tabs.slice(0, pinnedCount), newTab, ...tabs.slice(pinnedCount)]
          set({ tabs: newTabs, activeTabId: newTab.id })
        },

        /**
         * Opens the Assistant Metadata tab. If one already exists, activates it.
         */
        openAssistantMetadataTab: () => {
          const { tabs } = get()
          const existingTab = tabs.find((t) => t.type === 'assistant-metadata')
          if (existingTab) {
            set({ activeTabId: existingTab.id })
            return
          }

          const newTab = createAssistantMetadataTab()
          const pinnedCount = tabs.filter((t) => t.isPinned).length
          const newTabs = [...tabs.slice(0, pinnedCount), newTab, ...tabs.slice(pinnedCount)]
          set({ tabs: newTabs, activeTabId: newTab.id })
        },

        openMethodExecutorTab: (seed) => {
          const { tabs, activeTabId } = get()
          if (!seed) {
            const existingBlankTab = tabs.find(
              (tab) => isMethodExecutorTab(tab) && tab.seed === undefined
            )
            if (existingBlankTab) {
              set({ activeTabId: existingBlankTab.id })
              return existingBlankTab.id
            }
          }

          const newTab = createMethodExecutorTab(seed)
          const pinnedCount = tabs.filter((tab) => tab.isPinned).length
          const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
          const insertAt = activeIndex >= 0 ? Math.max(activeIndex + 1, pinnedCount) : pinnedCount
          const newTabs = [...tabs.slice(0, insertAt), newTab, ...tabs.slice(insertAt)]
          set({ tabs: newTabs, activeTabId: newTab.id })
          return newTab.id
        },

        openHttpClientTab: (seed) => {
          const { tabs, activeTabId } = get()
          if (!seed) {
            const existingBlankTab = tabs.find(
              (tab) => isHttpClientTab(tab) && tab.seed === undefined
            )
            if (existingBlankTab) {
              set({ activeTabId: existingBlankTab.id })
              return existingBlankTab.id
            }
          }

          const newTab = createHttpClientTab(seed)
          const pinnedCount = tabs.filter((tab) => tab.isPinned).length
          const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
          const insertAt = activeIndex >= 0 ? Math.max(activeIndex + 1, pinnedCount) : pinnedCount
          const newTabs = [...tabs.slice(0, insertAt), newTab, ...tabs.slice(insertAt)]
          set({ tabs: newTabs, activeTabId: newTab.id })
          return newTab.id
        },

        notifyGraphTabReady: () => {
          const pending = graphTabReadyResolvers.splice(0, graphTabReadyResolvers.length)
          for (const resolve of pending) resolve()
        },

        closeTab: (tabId) => {
          const { tabs, activeTabId } = get()
          const tabIndex = tabs.findIndex((t) => t.id === tabId)
          const tab = tabs[tabIndex]

          // Don't close tabs that are not closable
          if (tab?.isClosable === false) return

          // Don't close pinned tabs with this method (use unpin first)
          if (tab?.isPinned) return

          const newTabs = tabs.filter((t) => t.id !== tabId)

          // If closing active tab, return focus to the previously used tab (the
          // next-highest "weight" in the MRU order) rather than the adjacent
          // tab. Falls back to positional selection if no MRU entry survives.
          let newActiveTabId = activeTabId
          if (activeTabId === tabId) {
            if (newTabs.length === 0) {
              newActiveTabId = null
            } else {
              const remainingIds = new Set(newTabs.map((t) => t.id))
              const mruTabId = get().tabActivationOrder.find(
                (id) => id !== tabId && remainingIds.has(id)
              )
              if (mruTabId) {
                newActiveTabId = mruTabId
              } else if (tabIndex >= newTabs.length) {
                newActiveTabId = newTabs[newTabs.length - 1].id
              } else {
                newActiveTabId = newTabs[tabIndex].id
              }
            }
          }

          commitTabsUpdate(set, get, newTabs, newActiveTabId)
        },

        closeOtherTabs: (tabId) => {
          const { tabs } = get()
          // Keep the target tab, pinned tabs, and non-closable tabs
          const newTabs = tabs.filter((t) => t.id === tabId || t.isPinned || t.isClosable === false)
          commitTabsUpdate(set, get, newTabs, tabId)
        },

        closeTabsToRight: (tabId) => {
          const { tabs, activeTabId } = get()
          const tabIndex = tabs.findIndex((t) => t.id === tabId)
          // Keep tabs to the left, pinned tabs, and non-closable tabs
          const newTabs = tabs.filter(
            (t, i) => i <= tabIndex || t.isPinned || t.isClosable === false
          )

          // If active tab was closed, activate the rightmost tab
          let newActiveTabId = activeTabId
          if (!newTabs.find((t) => t.id === activeTabId)) {
            newActiveTabId = newTabs[newTabs.length - 1]?.id || null
          }

          commitTabsUpdate(set, get, newTabs, newActiveTabId)
        },

        closeAllTabs: () => {
          const { tabs } = get()
          // Keep pinned tabs and non-closable tabs
          const remainingTabs = tabs.filter((t) => t.isPinned || t.isClosable === false)
          commitTabsUpdate(set, get, remainingTabs, remainingTabs[0]?.id || null)
        },

        closeUnpinnedTabs: () => {
          const { tabs, activeTabId } = get()
          const pinnedTabs = tabs.filter((t) => t.isPinned)
          const newActiveTabId =
            pinnedTabs.find((t) => t.id === activeTabId)?.id || pinnedTabs[0]?.id || null
          commitTabsUpdate(set, get, pinnedTabs, newActiveTabId)
        },

        setActiveTab: (tabId) => {
          set({ activeTabId: tabId })
        },

        pinTab: (tabId) => {
          const { tabs } = get()
          const tabIndex = tabs.findIndex((t) => t.id === tabId)
          if (tabIndex === -1) return

          const tab = tabs[tabIndex]

          // Tabs with fixed index are always pinned, no-op
          if (tab.index !== undefined) return

          const pinnedTab = { ...tab, isPinned: true }
          const otherTabs = tabs.filter((_, i) => i !== tabIndex)

          // Count fixed-index tabs at the start
          const fixedIndexCount = otherTabs.filter((t) => t.index !== undefined).length
          const pinnedCount = otherTabs.filter((t) => t.isPinned).length

          // Insert after fixed-index tabs, at end of other pinned tabs
          const insertIndex = Math.max(fixedIndexCount, pinnedCount)
          const newTabs = [
            ...otherTabs.slice(0, insertIndex),
            pinnedTab,
            ...otherTabs.slice(insertIndex),
          ]
          set({ tabs: newTabs })
        },

        unpinTab: (tabId) => {
          const { tabs } = get()
          const tabIndex = tabs.findIndex((t) => t.id === tabId)
          if (tabIndex === -1) return

          const tab = tabs[tabIndex]

          // Don't unpin tabs with fixed index (they're always pinned)
          if (tab.index !== undefined) return

          const unpinnedTab = { ...tab, isPinned: false }
          const otherTabs = tabs.filter((_, i) => i !== tabIndex)
          const pinnedCount = otherTabs.filter((t) => t.isPinned).length

          // Move unpinned tab to start of unpinned section (right after pinned tabs)
          const newTabs = [
            ...otherTabs.slice(0, pinnedCount),
            unpinnedTab,
            ...otherTabs.slice(pinnedCount),
          ]
          set({ tabs: newTabs })
        },

        togglePinTab: (tabId) => {
          const { tabs, pinTab, unpinTab } = get()
          const tab = tabs.find((t) => t.id === tabId)
          if (!tab) return

          // Tabs with fixed index are always pinned, can't toggle
          if (tab.index !== undefined) return

          if (tab.isPinned) {
            unpinTab(tabId)
          } else {
            pinTab(tabId)
          }
        },

        pinAllTabs: () => {
          const { tabs } = get()
          const newTabs = tabs.map((tab) => ({ ...tab, isPinned: true }))
          set({ tabs: newTabs })
        },

        unpinAllTabs: () => {
          const { tabs } = get()
          // Don't unpin tabs with fixed index
          const newTabs = tabs.map((tab) =>
            tab.index !== undefined ? tab : { ...tab, isPinned: false }
          )
          set({ tabs: newTabs })
        },

        moveTab: (fromIndex, toIndex) => {
          const { tabs } = get()
          if (fromIndex === toIndex) return

          const tab = tabs[fromIndex]

          // Don't move tabs with fixed index
          if (tab.index !== undefined) return

          // Don't allow moving to a position occupied by a fixed-index tab
          const fixedIndexPositions = tabs
            .map((t, i) => (t.index !== undefined ? i : -1))
            .filter((i) => i !== -1)
          if (fixedIndexPositions.includes(toIndex)) return

          const pinnedCount = tabs.filter((t) => t.isPinned).length

          // Prevent moving pinned tabs to unpinned section and vice versa
          if (tab.isPinned && toIndex >= pinnedCount) return
          if (!tab.isPinned && toIndex < pinnedCount) return

          const newTabs = [...tabs]
          newTabs.splice(fromIndex, 1)
          newTabs.splice(toIndex, 0, tab)
          set({ tabs: newTabs })
        },

        reorderTabs: (newTabs) => {
          // Ensure tabs with fixed index stay at their positions
          const fixedIndexTabs = newTabs.filter((t) => t.index !== undefined)
          if (fixedIndexTabs.length === 0) {
            set({ tabs: newTabs })
            return
          }

          // Sort fixed index tabs by their index
          fixedIndexTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

          // Remove fixed index tabs from the new order
          const otherTabs = newTabs.filter((t) => t.index === undefined)

          // Rebuild the array with fixed tabs at their positions
          const result: Tab[] = []
          let otherIdx = 0
          for (let i = 0; i < newTabs.length; i++) {
            const fixedTab = fixedIndexTabs.find((t) => t.index === i)
            if (fixedTab) {
              result.push(fixedTab)
            } else if (otherIdx < otherTabs.length) {
              result.push(otherTabs[otherIdx++])
            }
          }
          // Add any remaining tabs
          while (otherIdx < otherTabs.length) {
            result.push(otherTabs[otherIdx++])
          }

          set({ tabs: result })
        },

        // Dataclass tab content actions
        // These only apply to dataclass tabs and are no-ops for home tabs

        setViewMode: (tabId, viewMode) => {
          set({ tabs: updateDataclassTab(get().tabs, tabId, { viewMode }) })
        },

        setQueryOptions: (tabId, options) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.id === tabId)
          if (!tab || !isDataclassTab(tab)) return
          set({
            tabs: updateDataclassTab(tabs, tabId, {
              queryOptions: normalizeQueryOptions({ ...tab.queryOptions, ...options }),
            }),
          })
        },

        setFieldConfig: (tabId, config) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.id === tabId)
          if (!tab || !isDataclassTab(tab)) return
          set({
            tabs: updateDataclassTab(tabs, tabId, {
              fieldConfig: normalizeFieldConfig({ ...tab.fieldConfig, ...config }),
            }),
          })
        },

        setQueryExpanded: (tabId, expanded) => {
          set({ tabs: updateDataclassTab(get().tabs, tabId, { queryExpanded: expanded }) })
        },

        setQueryPanelHeight: (tabId, height) => {
          set({ tabs: updateDataclassTab(get().tabs, tabId, { queryPanelHeight: height }) })
        },

        resetQueryOptions: (tabId) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.id === tabId)
          if (!tab || !isDataclassTab(tab)) return

          const previousId = tab.entitySetId
          const newTabs = updateDataclassTab(tabs, tabId, {
            queryOptions: { ...DEFAULT_QUERY_OPTIONS },
            entitySetId: null,
            selectionCount: null,
          })
          set({ tabs: newTabs })

          if (previousId) {
            releaseEntitySetIfOrphaned(tab.dataclassName, previousId, newTabs)
          }
        },

        setSelectedEntityId: (tabId, entityId) => {
          set({ tabs: updateDataclassTab(get().tabs, tabId, { selectedEntityId: entityId }) })
        },

        setEntitySetId: (tabId, entitySetId) => {
          const { tabs } = get()
          const tab = tabs.find((t) => t.id === tabId)
          if (!tab || !isDataclassTab(tab)) return

          const previousId = tab.entitySetId
          if (previousId === entitySetId) return

          const newTabs = updateDataclassTab(tabs, tabId, {
            entitySetId,
            selectionCount: null,
          })
          set({ tabs: newTabs })

          if (previousId) {
            releaseEntitySetIfOrphaned(tab.dataclassName, previousId, newTabs)
          }
        },

        setEntitiesPage: (tabId, page) => {
          set({ tabs: updateDataclassTab(get().tabs, tabId, { entitiesPage: page }) })
        },

        setSelectionCount: (tabId, count) => {
          set({ tabs: updateDataclassTab(get().tabs, tabId, { selectionCount: count }) })
        },

        // Settings tab content actions
        setSettingsShortcutsExpanded: (tabId, expanded) => {
          set({ tabs: updateSettingsTab(get().tabs, tabId, { shortcutsExpanded: expanded }) })
        },

        setSettingsDataclassesExpanded: (tabId, expanded) => {
          set({ tabs: updateSettingsTab(get().tabs, tabId, { dataclassesExpanded: expanded }) })
        },

        setSettingsAssistantToolsExpanded: (tabId, expanded) => {
          set({ tabs: updateSettingsTab(get().tabs, tabId, { assistantToolsExpanded: expanded }) })
        },

        setSettingsWidgetsExpanded: (tabId, expanded) => {
          set({ tabs: updateSettingsTab(get().tabs, tabId, { widgetsExpanded: expanded }) })
        },

        // Apply default view mode to all existing dataclass tabs
        applyDefaultViewModeToAllTabs: (viewMode) => {
          const { tabs } = get()
          const updatedTabs = tabs.map((tab) => {
            if (isDataclassTab(tab)) {
              return { ...tab, viewMode }
            }
            return tab
          })
          set({ tabs: updatedTabs })
        },

        // Apply default page size to all existing dataclass tabs
        applyDefaultPageSizeToAllTabs: (pageSize) => {
          const { tabs } = get()
          const updatedTabs = tabs.map((tab) => {
            if (isDataclassTab(tab)) {
              return {
                ...tab,
                queryOptions: { ...tab.queryOptions, top: pageSize },
              }
            }
            return tab
          })
          set({ tabs: updatedTabs })
        },

        // Rehydrate tabs from storage (call after base BASEID is set)
        rehydrateTabs: () => {
          const stored = tabsRawStorage.getItem()
          if (stored) {
            try {
              const parsed = JSON.parse(stored)
              if (parsed.state) {
                const tabs = (parsed.state.tabs ?? []).map((tab: Tab) => {
                  if (!isDataclassTab(tab)) return tab
                  return {
                    ...tab,
                    queryOptions: normalizeQueryOptions(tab.queryOptions),
                    fieldConfig: normalizeFieldConfig(tab.fieldConfig),
                    queryPanelHeight:
                      typeof tab.queryPanelHeight === 'number' &&
                      Number.isFinite(tab.queryPanelHeight)
                        ? tab.queryPanelHeight
                        : null,
                  }
                })
                set({
                  tabs,
                  activeTabId: parsed.state.activeTabId ?? null,
                })
              }
            } catch {
              // Ignore parse errors
            }
          }
        },
      }),
      {
        name: 'dataexplorer-tabs',
        storage: createTabsStorage(),
        partialize: (state) => ({
          tabs: state.tabs,
          activeTabId: state.activeTabId,
        }),
      }
    ),
    {
      name: 'DataExplorer Tabs',
      enabled: !!import.meta.env.DEV,
    }
  )
)

// =============================================================================
// MRU activation order tracking
// =============================================================================

// Maintain the most-recently-used activation order centrally so every code path
// that changes `activeTabId` (tab clicks, opening tabs, closing tabs) keeps the
// order accurate. Pruning removes IDs of tabs that no longer exist. The guard
// (only writing when the order actually changes) makes the re-entrant call this
// triggers a no-op, so it terminates immediately.
useTabsStore.subscribe((state, prev) => {
  let order = state.tabActivationOrder

  // Drop IDs for tabs that have been removed.
  if (state.tabs !== prev.tabs) {
    const ids = new Set(state.tabs.map((t) => t.id))
    const pruned = order.filter((id) => ids.has(id))
    if (pruned.length !== order.length) order = pruned
  }

  // Promote the newly activated tab to the front (highest weight).
  if (state.activeTabId && state.activeTabId !== prev.activeTabId) {
    order = [state.activeTabId, ...order.filter((id) => id !== state.activeTabId)]
  }

  if (order !== state.tabActivationOrder) {
    useTabsStore.setState({ tabActivationOrder: order })
  }
})

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get the active tab (can be home or dataclass tab)
 */
export const useActiveTab = () => {
  const { tabs, activeTabId } = useTabsStore()
  return tabs.find((t) => t.id === activeTabId) || null
}

/**
 * Get the active tab if it's a dataclass tab, otherwise null
 */
export const useActiveDataclassTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isDataclassTab(activeTab) ? activeTab : null
}

/**
 * Get the active dataclass name (null if home tab or no tab)
 */
export const useActiveDataclassName = () => {
  const activeTab = useActiveDataclassTab()
  return activeTab?.dataclassName || null
}

/**
 * Get the active tab ID
 */
export const useActiveTabId = () => {
  return useTabsStore((state) => state.activeTabId)
}

/**
 * Check if the active tab is a home tab
 */
export const useIsHomeTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isHomeTab(activeTab) : false
}

/**
 * Check if the active tab is a settings tab
 */
export const useIsSettingsTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isSettingsTab(activeTab) : false
}

/**
 * Get the active tab if it's a settings tab, otherwise null
 */
export const useActiveSettingsTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isSettingsTab(activeTab) ? activeTab : null
}

/**
 * Check if the active tab is a graph tab
 */
export const useIsGraphTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isGraphTab(activeTab) : false
}

/**
 * Get the active tab if it's a graph tab, otherwise null
 */
export const useActiveGraphTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isGraphTab(activeTab) ? activeTab : null
}

/**
 * Check if the active tab is a static tab
 */
export const useIsStaticTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isStaticTab(activeTab) : false
}

/**
 * Get the active tab if it's a static tab, otherwise null
 */
export const useActiveStaticTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isStaticTab(activeTab) ? activeTab : null
}

/**
 * Check if the active tab is a schema builder tab
 */
export const useIsSchemaBuilderTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isSchemaBuilderTab(activeTab) : false
}

/**
 * Get the active tab if it's a schema builder tab, otherwise null
 */
export const useActiveSchemaBuilderTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isSchemaBuilderTab(activeTab) ? activeTab : null
}

/**
 * Check if the active tab is an assistant metadata tab
 */
export const useIsAssistantMetadataTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isAssistantMetadataTab(activeTab) : false
}

/**
 * Get the active tab if it's an assistant metadata tab, otherwise null
 */
export const useActiveAssistantMetadataTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isAssistantMetadataTab(activeTab) ? activeTab : null
}

export const useIsMethodExecutorTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isMethodExecutorTab(activeTab) : false
}

export const useActiveMethodExecutorTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isMethodExecutorTab(activeTab) ? activeTab : null
}

export const useIsHttpClientTabActive = () => {
  const activeTab = useActiveTab()
  return activeTab ? isHttpClientTab(activeTab) : false
}

export const useActiveHttpClientTab = () => {
  const activeTab = useActiveTab()
  return activeTab && isHttpClientTab(activeTab) ? activeTab : null
}
