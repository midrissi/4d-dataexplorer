import { toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { summarizeShortcuts } from '~/assistant/config-state'
import { eventBus } from '~/lib/eventBus'
import { useSettingsStore } from '~/store/settings'

export function buildHelpTools(): AssistantToolHandler[] {
  return [
    {
      definition: {
        name: '@help/shortcuts',
        description:
          'List keyboard shortcuts or open the shortcuts help modal. Use action "list" to answer questions about shortcuts (e.g. structure view, theme toggle). Optional query, id, or category filters.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'open'],
              description: 'list returns shortcut data; open shows the shortcuts modal',
            },
            query: {
              type: 'string',
              description: 'Filter by text in shortcut id, label, or category',
            },
            id: {
              type: 'string',
              description: 'Exact shortcut id, e.g. open-structure',
            },
            category: {
              type: 'string',
              description: 'Filter by category: General, View, Navigation, Entities, Tabs',
            },
          },
        },
      },
      invoke: async (args) => {
        const action = args.action === 'open' ? 'open' : 'list'

        if (action === 'open') {
          eventBus.emit('show-keyboard-shortcuts')
          return toolResultOk({ shown: true })
        }

        const store = useSettingsStore.getState()
        const shortcuts = summarizeShortcuts(store.shortcuts, {
          query: typeof args.query === 'string' ? args.query : undefined,
          id: typeof args.id === 'string' ? args.id : undefined,
          category: typeof args.category === 'string' ? args.category : undefined,
        })

        return toolResultOk({
          activeShortcutPreset: store.activeShortcutPreset,
          count: shortcuts.length,
          shortcuts,
        })
      },
    },
  ]
}
