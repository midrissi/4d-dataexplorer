import type { AssistantToolRegistry } from '@4djs/assistant/tools'
import { buildAppearanceTools } from './appearance'
import { buildCommandTools } from './commands'
import { buildEntityTools } from './entities'
import { buildGraphTools } from './graph'
import { buildHelpTools } from './help'
import { buildMetadataTools } from './metadata'
import { buildNavigationTools } from './navigation'
import { buildQueryTools } from './query'
import { buildSettingsTools } from './settings'
import { buildViewTools } from './view'
import { buildWidgetTools } from './widgets'

export function registerUiTools(registry: AssistantToolRegistry): void {
  const handlers = [
    ...buildCommandTools(),
    ...buildNavigationTools(),
    ...buildAppearanceTools(),
    ...buildViewTools(),
    ...buildEntityTools(),
    ...buildQueryTools(),
    ...buildGraphTools(),
    ...buildMetadataTools(registry),
    ...buildSettingsTools(),
    ...buildWidgetTools(),
    ...buildHelpTools(),
  ]

  for (const handler of handlers) {
    registry.register(handler)
  }
}

export { registerNamespacedDatastoreTools } from './datastore'
