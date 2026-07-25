import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { useSettingsStore } from '~/store/settings'
import { isDataclassTab, useTabsStore } from '~/store/tabs'

export function buildViewTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@view/entity-list',
        description: 'Set entity list view mode (cards or table) for the active dataclass tab.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['cards', 'table'] },
            applyToDefaults: {
              type: 'boolean',
              description: 'Also update the default view mode for new tabs',
            },
          },
          required: ['mode'],
        },
      },
      invoke: async (args) => {
        const mode = args.mode === 'table' ? 'table' : 'cards'
        const tabsState = useTabsStore.getState()
        const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
        if (activeTab && isDataclassTab(activeTab)) {
          tabsState.setViewMode(activeTab.id, mode)
        }
        if (args.applyToDefaults) {
          useSettingsStore.getState().setDefaultViewMode(mode)
        }
        return toolResultOk({ mode, appliedToActiveTab: Boolean(activeTab) })
      },
    },
    {
      definition: {
        name: '@view/entity',
        description: 'Set default entity viewer mode (tree, form, or json).',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['tree', 'form', 'json'] },
          },
          required: ['mode'],
        },
      },
      invoke: async (args) => {
        const mode = String(args.mode ?? '') as 'tree' | 'form' | 'json'
        if (!['tree', 'form', 'json'].includes(mode)) {
          return toolResultErr('mode must be tree, form, or json')
        }
        useSettingsStore.getState().setDefaultEntityViewMode(mode)
        return toolResultOk({ mode })
      },
    },
    {
      definition: {
        name: '@view/edit-mode',
        description: 'Set default entity edit mode (form or json).',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['form', 'json'] },
          },
          required: ['mode'],
        },
      },
      invoke: async (args) => {
        const mode = args.mode === 'json' ? 'json' : 'form'
        useSettingsStore.getState().setDefaultEditMode(mode)
        return toolResultOk({ mode })
      },
    },
    {
      definition: {
        name: '@view/sidebar',
        description: 'Set sidebar dataclass display mode.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['cards', 'tables', 'icons'] },
          },
          required: ['mode'],
        },
      },
      invoke: async (args) => {
        const mode = String(args.mode ?? '') as 'cards' | 'tables' | 'icons'
        if (!['cards', 'tables', 'icons'].includes(mode)) {
          return toolResultErr('mode must be cards, tables, or icons')
        }
        useSettingsStore.getState().setSidebarViewMode(mode)
        return toolResultOk({ mode })
      },
    },
    {
      definition: {
        name: '@view/page-size',
        description: 'Set default page size for entity lists (5-100).',
        inputSchema: {
          type: 'object',
          properties: {
            pageSize: { type: 'number' },
          },
          required: ['pageSize'],
        },
      },
      invoke: async (args) => {
        const pageSize = Number(args.pageSize)
        if (!Number.isFinite(pageSize)) return toolResultErr('pageSize must be a number')
        useSettingsStore.getState().setPageSize(pageSize)
        return toolResultOk({ pageSize: useSettingsStore.getState().pageSize })
      },
    },
  ]
}
