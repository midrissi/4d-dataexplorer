import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { eventBus } from '~/lib/eventBus'
import { useDataExplorerStore } from '~/store'
import { isDataclassTab, useTabsStore } from '~/store/tabs'

export function buildEntityTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@entities/select-dataclass',
        description: 'Select a dataclass in the data explorer (does not open a tab).',
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
        useDataExplorerStore.getState().selectDataclass(name)
        return toolResultOk({ selectedDataclass: name })
      },
    },
    {
      definition: {
        name: '@entities/select',
        description: 'Select an entity by id in the current dataclass view.',
        inputSchema: {
          type: 'object',
          properties: {
            entityId: { type: 'string', description: 'Entity id; omit to deselect' },
          },
        },
      },
      invoke: async (args) => {
        const dataState = useDataExplorerStore.getState()
        const entityId = args.entityId != null ? String(args.entityId) : null
        if (!entityId) {
          dataState.selectEntity(null)
          return toolResultOk({ selectedEntityId: null })
        }
        const entity = dataState.entities.find((e) => e.id === entityId || e.__KEY === entityId)
        if (!entity) return toolResultErr(`Entity not found in current list: ${entityId}`)
        dataState.selectEntity(entity)
        const tabsState = useTabsStore.getState()
        const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
        if (activeTab && isDataclassTab(activeTab)) {
          tabsState.setSelectedEntityId(activeTab.id, entity.id)
        }
        return toolResultOk({ selectedEntityId: entity.id })
      },
    },
    {
      definition: {
        name: '@entities/action',
        description:
          'Perform an entity action: create, edit, save, cancel, duplicate, delete, nav-prev, nav-next.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                'create',
                'edit',
                'save',
                'cancel',
                'duplicate',
                'delete',
                'nav-prev',
                'nav-next',
              ],
            },
          },
          required: ['action'],
        },
      },
      invoke: async (args) => {
        const action = String(args.action ?? '')
        switch (action) {
          case 'create':
            eventBus.emit('new-entity')
            return toolResultOk({ action })
          case 'edit':
            eventBus.emit('edit-entity')
            return toolResultOk({ action })
          case 'save':
            eventBus.emit('save-entity')
            return toolResultOk({ action })
          case 'cancel':
            useDataExplorerStore.getState().setIsEditing(false)
            eventBus.emit('cancel-edit')
            return toolResultOk({ action })
          case 'duplicate':
            eventBus.emit('duplicate-entity')
            return toolResultOk({ action })
          case 'delete':
            eventBus.emit('delete-entity')
            return toolResultOk({ action })
          case 'nav-prev':
            eventBus.emit('nav-prev')
            return toolResultOk({ action })
          case 'nav-next':
            eventBus.emit('nav-next')
            return toolResultOk({ action })
          default:
            return toolResultErr(`Unknown action: ${action}`)
        }
      },
    },
    {
      definition: {
        name: '@entities/paginate',
        description: 'Navigate entity list pages: first, prev, next, last.',
        inputSchema: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['first', 'prev', 'next', 'last'],
            },
            page: {
              type: 'number',
              description: 'Optional explicit page number (overrides direction)',
            },
          },
        },
      },
      invoke: async (args) => {
        if (typeof args.page === 'number') {
          const tabsState = useTabsStore.getState()
          const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
          if (activeTab && isDataclassTab(activeTab)) {
            tabsState.setEntitiesPage(activeTab.id, args.page)
          }
          await useDataExplorerStore.getState().fetchEntities(args.page)
          return toolResultOk({ page: args.page })
        }
        const direction = String(args.direction ?? '')
        const map = {
          first: 'page-first',
          prev: 'page-prev',
          next: 'page-next',
          last: 'page-last',
        } as const
        const event = map[direction as keyof typeof map]
        if (!event) return toolResultErr('direction or page is required')
        eventBus.emit(event)
        return toolResultOk({ direction })
      },
    },
    {
      definition: {
        name: '@entities/refresh',
        description: 'Refresh dataclasses, entities, or the entire current view.',
        inputSchema: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: ['dataclasses', 'entities', 'all'],
            },
          },
          required: ['scope'],
        },
      },
      invoke: async (args) => {
        const scope = String(args.scope ?? '')
        const dataState = useDataExplorerStore.getState()
        switch (scope) {
          case 'dataclasses':
            await dataState.fetchDataclasses()
            return toolResultOk({ scope })
          case 'entities':
            await dataState.fetchEntities()
            return toolResultOk({ scope })
          case 'all':
            await dataState.refreshCurrentView()
            return toolResultOk({ scope })
          default:
            return toolResultErr(`Unknown scope: ${scope}`)
        }
      },
    },
  ]
}
