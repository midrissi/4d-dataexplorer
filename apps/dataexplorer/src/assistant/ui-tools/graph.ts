import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { eventBus, type GraphRelationFilter } from '~/lib/eventBus'

export function buildGraphTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@graph/action',
        description:
          'Control the structure graph: auto-organize, set relation filter, toggle singletons section, select/deselect dataclass.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['auto-organize', 'relation-filter', 'toggle-singletons', 'select', 'deselect'],
            },
            relationFilter: {
              type: 'string',
              enum: ['all', 'selected', 'none'],
              description: 'Required when action is relation-filter',
            },
            dataclassName: {
              type: 'string',
              description: 'Required when action is select',
            },
          },
          required: ['action'],
        },
      },
      invoke: async (args) => {
        const action = String(args.action ?? '')
        switch (action) {
          case 'auto-organize':
            eventBus.emit('graph-auto-organize')
            return toolResultOk({ action })
          case 'relation-filter': {
            const filter = String(args.relationFilter ?? '') as GraphRelationFilter
            if (!['all', 'selected', 'none'].includes(filter)) {
              return toolResultErr('relationFilter must be all, selected, or none')
            }
            eventBus.emit('graph-set-relation-filter', filter)
            return toolResultOk({ action, relationFilter: filter })
          }
          case 'toggle-singletons':
            eventBus.emit('graph-toggle-singletons')
            return toolResultOk({ action })
          case 'select': {
            const name = String(args.dataclassName ?? '')
            if (!name) return toolResultErr('dataclassName is required for select')
            eventBus.emit('graph-select-dataclass', name)
            return toolResultOk({ action, dataclassName: name })
          }
          case 'deselect':
            eventBus.emit('graph-deselect')
            return toolResultOk({ action })
          default:
            return toolResultErr(`Unknown action: ${action}`)
        }
      },
    },
  ]
}
