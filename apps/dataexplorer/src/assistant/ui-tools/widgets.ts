import {
  buildWidgetRenderInputSchema,
  buildWidgetRenderToolDescription,
  isRegisteredWidgetType,
  parseWidgetRenderArgs,
} from '@4djs/ai-widgets'
import { toolResultErr, toolResultOk } from '@4djs/assistant/core'
import type { AssistantToolHandler, AssistantToolRegistry } from '@4djs/assistant/tools'
import { useSettingsStore } from '~/store/settings'
import { syncAssistantToolPrefs } from '../sync-tool-prefs'

function getDisabledWidgetTypes(): string[] {
  return useSettingsStore.getState().disabledWidgetTypes
}

export function buildWidgetTools(): AssistantToolHandler[] {
  const disabledWidgetTypes = getDisabledWidgetTypes()

  return [
    {
      definition: {
        name: '@widgets/render',
        description: buildWidgetRenderToolDescription({ disabledWidgetTypes }),
        inputSchema: buildWidgetRenderInputSchema({ disabledWidgetTypes }),
      },
      invoke: async (args) => {
        const parsed = parseWidgetRenderArgs(args, {
          disabledWidgetTypes: getDisabledWidgetTypes(),
        })
        if (!parsed.ok) return toolResultErr(parsed.error)

        const { title, data } = parsed.value
        if (!isRegisteredWidgetType(data.type)) {
          return toolResultErr(`Unknown widget type: ${data.type}`)
        }

        return toolResultOk({
          widget: {
            title,
            data,
          },
        })
      },
    },
  ]
}

/** Re-register `@widgets/render` so its schema matches the current profile catalog. */
export function refreshWidgetTools(registry: AssistantToolRegistry): void {
  for (const handler of buildWidgetTools()) {
    registry.register(handler)
  }
  syncAssistantToolPrefs(registry)
}
