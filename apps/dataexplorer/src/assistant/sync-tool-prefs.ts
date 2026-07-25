import type { AssistantToolRegistry } from '@4djs/assistant/tools'
import { useSettingsStore } from '~/store/settings'
import { isToolEnabled } from './tool-catalog'

export function syncAssistantToolPrefs(registry: AssistantToolRegistry): void {
  const prefs = useSettingsStore.getState().getAssistantToolPrefs()

  for (const name of registry.listRegisteredToolNames()) {
    if (isToolEnabled(name, prefs)) {
      registry.activate(name)
    } else {
      registry.deactivate(name)
    }
  }
}
