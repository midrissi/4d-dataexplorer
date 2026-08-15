import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { api } from '~/lib/api'
import { findSqlInQueryParts, SQL_NOT_SUPPORTED_HINT } from '~/lib/reject-sql-in-query'
import { useDataExplorerStore } from '~/store'
import { type FilterParam, isDataclassTab, type QueryOptions, useTabsStore } from '~/store/tabs'

function getActiveDataclassTab() {
  const tabsState = useTabsStore.getState()
  const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
  return activeTab && isDataclassTab(activeTab) ? activeTab : null
}

export function buildQueryTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@query/set-options',
        description:
          'Set query options on the active dataclass tab: filter, filterParams, sort, order, top ($top), select. SQL is not supported — filterParams must be scalar values only.',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description:
                '4D/ORDA filter expression (no SQL). Prefer relation paths when available, e.g. manager.lastname = :1. FK example: ID_color = :1',
            },
            filterParams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['string', 'number', 'boolean', 'date', 'json'] },
                  value: {
                    type: 'string',
                    description: 'Scalar only (e.g. "12", "A@"). Never a SQL subquery.',
                  },
                },
              },
            },
            sort: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
            top: { type: 'number', description: 'REST $top — max entities per request' },
            limit: { type: 'number', description: 'Deprecated alias for top' },
            select: { type: 'string' },
          },
        },
      },
      invoke: async (args) => {
        const activeTab = getActiveDataclassTab()
        if (!activeTab) return toolResultErr('No active dataclass tab')
        const options: Record<string, unknown> = {}
        if (typeof args.filter === 'string') options.filter = args.filter
        if (Array.isArray(args.filterParams)) {
          options.filterParams = args.filterParams as FilterParam[]
        }
        const sqlIssue = findSqlInQueryParts({
          filter: typeof options.filter === 'string' ? options.filter : undefined,
          filterParams: Array.isArray(options.filterParams)
            ? (options.filterParams as FilterParam[])
            : undefined,
        })
        if (sqlIssue) {
          return toolResultErr(`${sqlIssue}. ${SQL_NOT_SUPPORTED_HINT}`)
        }
        if (typeof args.sort === 'string') options.sort = args.sort
        if (args.order === 'asc' || args.order === 'desc') options.order = args.order
        if (typeof args.top === 'number') options.top = args.top
        else if (typeof args.limit === 'number') options.top = args.limit
        if (typeof args.select === 'string') options.select = args.select
        useTabsStore.getState().setQueryOptions(activeTab.id, options)
        return toolResultOk({ tabId: activeTab.id, options })
      },
    },
    {
      definition: {
        name: '@query/run',
        description: 'Run the current query and fetch entities.',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number' },
          },
        },
      },
      invoke: async (args) => {
        const page = typeof args.page === 'number' ? args.page : undefined
        await useDataExplorerStore.getState().fetchEntities(page, undefined, {
          resetSelection: true,
        })
        return toolResultOk({ ran: true, page: page ?? 1 })
      },
    },
    {
      definition: {
        name: '@query/reset',
        description: 'Reset query options on the active dataclass tab.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      invoke: async () => {
        const activeTab = getActiveDataclassTab()
        if (!activeTab) return toolResultErr('No active dataclass tab')
        useTabsStore.getState().resetQueryOptions(activeTab.id)
        return toolResultOk({ tabId: activeTab.id })
      },
    },
    {
      definition: {
        name: '@query/toggle-panel',
        description: 'Expand or collapse the query builder panel.',
        inputSchema: {
          type: 'object',
          properties: {
            expanded: { type: 'boolean' },
          },
        },
      },
      invoke: async (args) => {
        const activeTab = getActiveDataclassTab()
        if (!activeTab) return toolResultErr('No active dataclass tab')
        const expanded =
          typeof args.expanded === 'boolean' ? args.expanded : !activeTab.queryExpanded
        useTabsStore.getState().setQueryExpanded(activeTab.id, expanded)
        return toolResultOk({ expanded })
      },
    },
    {
      definition: {
        name: '@query/open-filtered-tab',
        description:
          'Create a server entity set from a filter, open a new dataclass tab bound to it, and load results. Use for requests like "filter users starting with L and open in new tab".',
        inputSchema: {
          type: 'object',
          properties: {
            dataClass: { type: 'string', description: 'Dataclass name' },
            filter: { type: 'string', description: '4D filter expression' },
            filterParams: {
              type: 'array',
              items: {},
              description: 'Values for :1, :2, … placeholders (e.g. ["L@"] for starts with L)',
            },
            sort: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
            top: { type: 'number', description: 'REST $top — max entities per request' },
            limit: { type: 'number', description: 'Deprecated alias for top' },
            select: { type: 'string', description: 'Comma-separated attributes' },
            viewMode: {
              type: 'string',
              enum: ['cards', 'table'],
              description: 'Entity list view (default table)',
            },
          },
          required: ['dataClass'],
        },
      },
      invoke: async (args) => {
        const dataClass = String(args.dataClass ?? '')
        if (!dataClass) return toolResultErr('dataClass is required')

        const filterParams = Array.isArray(args.filterParams)
          ? args.filterParams.map((value) => {
              if (value != null && typeof value === 'object' && !Array.isArray(value)) {
                const obj = value as Record<string, unknown>
                const type =
                  typeof obj.type === 'string'
                    ? obj.type
                    : typeof obj.value === 'number'
                      ? ('number' as const)
                      : typeof obj.value === 'boolean'
                        ? ('boolean' as const)
                        : ('string' as const)
                const raw = obj.value
                return {
                  type,
                  value:
                    raw == null ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw),
                }
              }
              return {
                type:
                  typeof value === 'number'
                    ? ('number' as const)
                    : typeof value === 'boolean'
                      ? ('boolean' as const)
                      : ('string' as const),
                value: String(value),
              }
            })
          : undefined

        const sqlIssue = findSqlInQueryParts({
          filter: typeof args.filter === 'string' ? args.filter : undefined,
          filterParams,
        })
        if (sqlIssue) {
          return toolResultErr(`${sqlIssue}. ${SQL_NOT_SUPPORTED_HINT}`)
        }

        const select =
          typeof args.select === 'string' && args.select.trim()
            ? args.select
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined

        const entitySet = await api.createEntitySet(dataClass, {
          filter: typeof args.filter === 'string' ? args.filter : undefined,
          filterParams,
          sort: typeof args.sort === 'string' ? args.sort : undefined,
          order: args.order === 'asc' ? 'asc' : 'desc',
          select,
        })

        const queryOptions: Partial<QueryOptions> = {}
        if (typeof args.filter === 'string') queryOptions.filter = args.filter
        if (filterParams?.length) queryOptions.filterParams = filterParams as FilterParam[]
        if (typeof args.sort === 'string') queryOptions.sort = args.sort
        if (args.order === 'asc' || args.order === 'desc') queryOptions.order = args.order
        if (typeof args.top === 'number') queryOptions.top = args.top
        else if (typeof args.limit === 'number') queryOptions.top = args.limit
        if (typeof args.select === 'string') queryOptions.select = args.select

        const viewMode = args.viewMode === 'cards' ? 'cards' : 'table'
        const tabsState = useTabsStore.getState()
        const tabId = tabsState.openEntitySetTab({
          dataclassName: dataClass,
          entitySetId: entitySet.id,
          queryOptions,
          viewMode,
          forceNew: true,
        })

        const dataState = useDataExplorerStore.getState()
        dataState.selectDataclass(dataClass)
        await dataState.fetchEntities(1)

        return toolResultOk({
          tabId,
          dataclassName: dataClass,
          entitySetId: entitySet.id,
          count: entitySet.count,
          viewMode,
        })
      },
    },
  ]
}
