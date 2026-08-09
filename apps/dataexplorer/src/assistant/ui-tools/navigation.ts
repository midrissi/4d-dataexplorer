import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import { getTheme, getThemeName } from '~/lib/storage'
import { useDataExplorerStore } from '~/store'
import { useSettingsStore } from '~/store/settings'
import { isDataclassTab, type QueryOptions, useTabsStore } from '~/store/tabs'

export function buildNavigationTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@navigation/state',
        description:
          'Return current UI state: tabs, active tab, selected dataclass/entity, view modes, readonly, language.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => {
        const settings = useSettingsStore.getState()
        const tabsState = useTabsStore.getState()
        const dataState = useDataExplorerStore.getState()
        const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)

        return toolResultOk({
          language: settings.language,
          readonlyMode: settings.readonlyMode,
          sidebarCollapsed: settings.sidebarCollapsed,
          theme: getTheme(),
          themeName: getThemeName(),
          tabs: tabsState.tabs.map((t) => ({
            id: t.id,
            type: t.type,
            isPinned: t.isPinned ?? false,
            dataclassName: isDataclassTab(t) ? t.dataclassName : undefined,
            entitySetId: isDataclassTab(t) ? t.entitySetId : undefined,
            viewMode: isDataclassTab(t) ? t.viewMode : undefined,
          })),
          activeTabId: tabsState.activeTabId,
          selectedDataclass: dataState.selectedDataclass,
          selectedEntityId: dataState.selectedEntityId,
          isEditing: dataState.isEditing,
          activeTab: activeTab
            ? {
                id: activeTab.id,
                type: activeTab.type,
                dataclassName: isDataclassTab(activeTab) ? activeTab.dataclassName : undefined,
              }
            : null,
        })
      },
    },
    {
      definition: {
        name: '@navigation/open-tab',
        description:
          'Open a tab immediately without confirmation: home, structure, settings, release-notes, schema-builder, assistant-metadata, method-executor, http-client, rest-export-builder, or a dataclass data tab. For dataclass tabs, optionally bind to an existing entity set by ID or apply query options. Safe read-only navigation.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'home',
                'structure',
                'settings',
                'release-notes',
                'schema-builder',
                'assistant-metadata',
                'method-executor',
                'http-client',
                'rest-export-builder',
                'dataclass',
              ],
            },
            dataclassName: { type: 'string', description: 'Required when type is dataclass' },
            entitySetId: {
              type: 'string',
              description: 'Open tab bound to an existing server entity set ID',
            },
            queryOptions: {
              type: 'object',
              description:
                'Query options to display in the tab (filter, filterParams, sort, order, top, select)',
              properties: {
                filter: { type: 'string' },
                filterParams: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['string', 'number', 'boolean', 'date', 'json'],
                      },
                      value: { type: 'string' },
                    },
                  },
                },
                sort: { type: 'string' },
                order: { type: 'string', enum: ['asc', 'desc'] },
                top: { type: 'number' },
                limit: { type: 'number', description: 'Deprecated alias for top' },
                select: { type: 'string' },
              },
            },
            viewMode: {
              type: 'string',
              enum: ['cards', 'table'],
              description: 'Entity list view mode for dataclass tabs',
            },
            forceNew: {
              type: 'boolean',
              description: 'When true with entitySetId, always open a new tab instead of reusing',
            },
            openAll: {
              type: 'boolean',
              description: 'When type is dataclass, open tabs for all dataclasses',
            },
          },
          required: ['type'],
        },
      },
      invoke: async (args) => {
        const tabsState = useTabsStore.getState()
        const dataState = useDataExplorerStore.getState()
        const type = String(args.type ?? '')

        switch (type) {
          case 'home':
            tabsState.openHomeTab()
            return toolResultOk({ opened: 'home' })
          case 'structure':
            if (isMobileShell()) {
              return toolResultErr('Structure graph is not available in the mobile beta')
            }
            await tabsState.openGraphTab()
            return toolResultOk({ opened: 'structure' })
          case 'settings':
            tabsState.openSettingsTab()
            return toolResultOk({ opened: 'settings' })
          case 'release-notes':
            tabsState.openStaticTab('release-notes')
            return toolResultOk({ opened: 'release-notes' })
          case 'schema-builder':
            if (isMobileShell()) {
              return toolResultErr('JSON Schema Builder is not available in the mobile beta')
            }
            tabsState.openSchemaBuilderTab()
            return toolResultOk({ opened: 'schema-builder' })
          case 'assistant-metadata':
            tabsState.openAssistantMetadataTab()
            return toolResultOk({ opened: 'assistant-metadata' })
          case 'method-executor':
            tabsState.openMethodExecutorTab()
            return toolResultOk({ opened: 'method-executor' })
          case 'http-client':
            tabsState.openHttpClientTab()
            return toolResultOk({ opened: 'http-client' })
          case 'rest-export-builder':
            tabsState.openRestExportBuilderTab()
            return toolResultOk({ opened: 'rest-export-builder' })
          case 'dataclass': {
            if (args.openAll) {
              tabsState.openAllDataclasses(dataState.dataclasses.map((d) => d.name))
              return toolResultOk({ opened: 'all-dataclasses' })
            }
            const name = String(args.dataclassName ?? '')
            if (!name) return toolResultErr('dataclassName is required when type is dataclass')

            const entitySetId =
              typeof args.entitySetId === 'string' && args.entitySetId.trim()
                ? args.entitySetId.trim()
                : null
            const queryOptions =
              args.queryOptions && typeof args.queryOptions === 'object'
                ? (args.queryOptions as Record<string, unknown>)
                : undefined
            const viewMode =
              args.viewMode === 'table' ? 'table' : args.viewMode === 'cards' ? 'cards' : undefined
            const forceNew = args.forceNew === true

            let tabId: string
            if (entitySetId) {
              tabId = tabsState.openEntitySetTab({
                dataclassName: name,
                entitySetId,
                queryOptions: queryOptions as Partial<QueryOptions>,
                viewMode,
                forceNew,
              })
            } else {
              tabsState.openTab(name)
              tabId = tabsState.activeTabId ?? ''
              if (queryOptions || viewMode) {
                const tab = tabsState.tabs.find((t) => t.id === tabId)
                if (tab && isDataclassTab(tab)) {
                  if (queryOptions) tabsState.setQueryOptions(tab.id, queryOptions)
                  if (viewMode) tabsState.setViewMode(tab.id, viewMode)
                }
              }
            }

            dataState.selectDataclass(name)
            await dataState.fetchEntities(1)

            return toolResultOk({
              opened: 'dataclass',
              dataclassName: name,
              tabId,
              entitySetId,
            })
          }
          default:
            return toolResultErr(`Unknown tab type: ${type}`)
        }
      },
    },
    {
      definition: {
        name: '@navigation/switch-tab',
        description: 'Switch the active tab by tab id or 1-based index.',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'string' },
            index: { type: 'number', description: '1-based tab index' },
          },
        },
      },
      invoke: async (args) => {
        const tabsState = useTabsStore.getState()
        if (typeof args.index === 'number') {
          const tab = tabsState.tabs[args.index - 1]
          if (!tab) return toolResultErr(`No tab at index ${args.index}`)
          tabsState.setActiveTab(tab.id)
          return toolResultOk({ activeTabId: tab.id })
        }
        const tabId = String(args.tabId ?? '')
        if (!tabId) return toolResultErr('tabId or index is required')
        if (!tabsState.tabs.some((t) => t.id === tabId)) {
          return toolResultErr(`Unknown tab: ${tabId}`)
        }
        tabsState.setActiveTab(tabId)
        return toolResultOk({ activeTabId: tabId })
      },
    },
    {
      definition: {
        name: '@navigation/close-tabs',
        description: 'Close tabs: active, others, to-right, or all.',
        inputSchema: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: ['active', 'others', 'to-right', 'all'],
            },
            tabId: { type: 'string', description: 'Reference tab for others/to-right scopes' },
          },
          required: ['scope'],
        },
      },
      invoke: async (args) => {
        const tabsState = useTabsStore.getState()
        const scope = String(args.scope ?? '')
        const refId = String(args.tabId ?? tabsState.activeTabId ?? '')
        if (!refId && scope !== 'all') return toolResultErr('No active tab')

        switch (scope) {
          case 'active':
            tabsState.closeTab(refId)
            break
          case 'others':
            tabsState.closeOtherTabs(refId)
            break
          case 'to-right':
            tabsState.closeTabsToRight(refId)
            break
          case 'all':
            tabsState.closeAllTabs()
            break
          default:
            return toolResultErr(`Unknown scope: ${scope}`)
        }
        return toolResultOk({ scope, tabId: refId || null })
      },
    },
    {
      definition: {
        name: '@navigation/pin-tabs',
        description: 'Pin or unpin tabs.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['toggle', 'pin-all', 'unpin-all'],
            },
            tabId: { type: 'string', description: 'Required for toggle' },
          },
          required: ['action'],
        },
      },
      invoke: async (args) => {
        const tabsState = useTabsStore.getState()
        const action = String(args.action ?? '')
        switch (action) {
          case 'toggle': {
            const tabId = String(args.tabId ?? tabsState.activeTabId ?? '')
            if (!tabId) return toolResultErr('tabId is required for toggle')
            tabsState.togglePinTab(tabId)
            return toolResultOk({ action, tabId })
          }
          case 'pin-all':
            tabsState.pinAllTabs()
            return toolResultOk({ action })
          case 'unpin-all':
            tabsState.unpinAllTabs()
            return toolResultOk({ action })
          default:
            return toolResultErr(`Unknown action: ${action}`)
        }
      },
    },
    {
      definition: {
        name: '@navigation/highlight-dataclass',
        description: 'Highlight a dataclass in the structure graph.',
        inputSchema: {
          type: 'object',
          properties: {
            dataclassName: { type: 'string' },
          },
          required: ['dataclassName'],
        },
      },
      invoke: async (args) => {
        const name = String(args.dataclassName ?? '')
        if (!name) return toolResultErr('dataclassName is required')
        eventBus.emit('highlight-dataclass-in-graph', name)
        return toolResultOk({ highlighted: name })
      },
    },
  ]
}
