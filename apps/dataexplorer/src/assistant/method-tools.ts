import type { AssistantToolRegistry } from '@4djs/assistant/tools'
import {
  buildMethodToolHandlers,
  mapCatalogAttributeTypeToMethodArgumentType,
} from '@4djs/assistant/tools'
import { api, client } from '~/lib/api'
import {
  filterAssistantExposedMethods,
  isAssistantExposedMethod,
} from '~/lib/assistant-exposed-method'
import type { AssistantMetadataSchema } from '~/lib/assistant-metadata-schema'
import { getAssistantMetadataSchema } from '~/lib/storage'
import { syncAssistantToolPrefs } from './sync-tool-prefs'
import {
  type AssistantToolNamespace,
  getToolNamespace,
  isDynamicMethodToolName,
} from './tool-catalog'

function getDataclassPrimaryKeyType(dataClass: {
  key?: Array<{ name: string }>
  attributes?: Array<{ name: string; type?: string }>
}) {
  const keyName = dataClass.key?.[0]?.name
  if (!keyName) return 'string' as const
  const attribute = dataClass.attributes?.find((entry) => entry.name === keyName)
  return mapCatalogAttributeTypeToMethodArgumentType(attribute?.type)
}

export type RegisteredMethodToolMeta = {
  name: string
  description: string
}

export type DynamicMethodToolMeta = {
  name: string
  namespace: AssistantToolNamespace
  description: string
}

let registeredMethodTools: RegisteredMethodToolMeta[] = []

export function getRegisteredMethodToolDefinitions(): RegisteredMethodToolMeta[] {
  return registeredMethodTools
}

export function getDynamicMethodTools(): DynamicMethodToolMeta[] {
  return registeredMethodTools
    .filter((definition) => isDynamicMethodToolName(definition.name))
    .map((definition) => ({
      name: definition.name,
      namespace: getToolNamespace(definition.name),
      description: definition.description,
    }))
    .filter((tool): tool is DynamicMethodToolMeta => tool.namespace !== null)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function syncMethodTools(registry: AssistantToolRegistry): Promise<number> {
  const catalog = await client.catalog.getAllWithMetadataCached()
  const metadata = getAssistantMetadataSchema()

  const handlers = buildMethodToolHandlers({
    catalog: {
      dataClasses: (catalog.dataClasses ?? []).map((dc) => ({
        name: dc.name,
        methods: filterAssistantExposedMethods(dc.methods),
        primaryKeyType: getDataclassPrimaryKeyType(dc),
      })),
      singletons: (catalog.singletons ?? []).map((singleton) => ({
        name: singleton.name,
        methods: filterAssistantExposedMethods(singleton.methods),
      })),
      methods: filterAssistantExposedMethods(catalog.methods),
    },
    metadata: metadata as AssistantMetadataSchema | null,
    invoke: (input) => api.callMethod(input),
    isMethodExposed: (method) => isAssistantExposedMethod(method),
  })

  registeredMethodTools = handlers.map((handler) => ({
    name: handler.definition.name,
    description: handler.definition.description,
  }))

  for (const handler of handlers) {
    registry.register(handler)
  }

  return handlers.length
}

export async function refreshAssistantMethodTools(
  registry: AssistantToolRegistry
): Promise<number> {
  const count = await syncMethodTools(registry)
  syncAssistantToolPrefs(registry)
  return count
}
