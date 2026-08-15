export const ASSISTANT_TOOLS_META_TOOL = '@settings/assistant-tools'

export type AssistantToolNamespace =
  | 'datastore'
  | 'dataclass'
  | 'commands'
  | 'navigation'
  | 'appearance'
  | 'view'
  | 'entities'
  | 'query'
  | 'graph'
  | 'metadata'
  | 'settings'
  | 'widgets'
  | 'help'

export const ASSISTANT_TOOL_NAMESPACES: AssistantToolNamespace[] = [
  'datastore',
  'dataclass',
  'commands',
  'navigation',
  'appearance',
  'view',
  'entities',
  'query',
  'graph',
  'metadata',
  'settings',
  'widgets',
  'help',
]

export type AssistantToolMeta = {
  name: string
  namespace: AssistantToolNamespace
  labelKey: string
  descriptionKey?: string
}

export type AssistantToolPrefs = {
  assistantDisabledNamespaces: AssistantToolNamespace[]
  assistantDisabledTools: string[]
}

export type ParsedToolPattern =
  | { type: 'all' }
  | { type: 'namespace'; namespace: AssistantToolNamespace }
  | { type: 'tool'; toolName: string; namespace: AssistantToolNamespace }

export const ASSISTANT_TOOL_CATALOG: AssistantToolMeta[] = [
  // datastore
  {
    name: '@datastore/catalog',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/catalog',
  },
  {
    name: '@datastore/server-info',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/server-info',
  },
  { name: '@datastore/query', namespace: 'datastore', labelKey: 'assistantTool.@datastore/query' },
  {
    name: '@datastore/validate-path',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/validate-path',
  },
  {
    name: '@datastore/query-related',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/query-related',
  },
  { name: '@datastore/get', namespace: 'datastore', labelKey: 'assistantTool.@datastore/get' },
  {
    name: '@datastore/create',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/create',
  },
  {
    name: '@datastore/update',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/update',
  },
  {
    name: '@datastore/delete',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/delete',
  },
  {
    name: '@datastore/create-entityset',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/create-entityset',
  },
  {
    name: '@datastore/combine-entityset',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/combine-entityset',
  },
  {
    name: '@datastore/release-entityset',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/release-entityset',
  },
  {
    name: '@datastore/distinct',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/distinct',
  },
  {
    name: '@datastore/compute',
    namespace: 'datastore',
    labelKey: 'assistantTool.@datastore/compute',
  },
  // commands
  { name: '@commands/list', namespace: 'commands', labelKey: 'assistantTool.@commands/list' },
  { name: '@commands/execute', namespace: 'commands', labelKey: 'assistantTool.@commands/execute' },
  { name: '@commands/open', namespace: 'commands', labelKey: 'assistantTool.@commands/open' },
  // navigation
  {
    name: '@navigation/state',
    namespace: 'navigation',
    labelKey: 'assistantTool.@navigation/state',
  },
  {
    name: '@navigation/open-tab',
    namespace: 'navigation',
    labelKey: 'assistantTool.@navigation/open-tab',
  },
  {
    name: '@navigation/switch-tab',
    namespace: 'navigation',
    labelKey: 'assistantTool.@navigation/switch-tab',
  },
  {
    name: '@navigation/close-tabs',
    namespace: 'navigation',
    labelKey: 'assistantTool.@navigation/close-tabs',
  },
  {
    name: '@navigation/pin-tabs',
    namespace: 'navigation',
    labelKey: 'assistantTool.@navigation/pin-tabs',
  },
  {
    name: '@navigation/highlight-dataclass',
    namespace: 'navigation',
    labelKey: 'assistantTool.@navigation/highlight-dataclass',
  },
  // appearance
  {
    name: '@appearance/language',
    namespace: 'appearance',
    labelKey: 'assistantTool.@appearance/language',
  },
  {
    name: '@appearance/theme',
    namespace: 'appearance',
    labelKey: 'assistantTool.@appearance/theme',
  },
  {
    name: '@appearance/color-theme',
    namespace: 'appearance',
    labelKey: 'assistantTool.@appearance/color-theme',
  },
  {
    name: '@appearance/toggle-theme',
    namespace: 'appearance',
    labelKey: 'assistantTool.@appearance/toggle-theme',
  },
  {
    name: '@appearance/toggle-sidebar',
    namespace: 'appearance',
    labelKey: 'assistantTool.@appearance/toggle-sidebar',
  },
  // view
  { name: '@view/entity-list', namespace: 'view', labelKey: 'assistantTool.@view/entity-list' },
  { name: '@view/entity', namespace: 'view', labelKey: 'assistantTool.@view/entity' },
  { name: '@view/edit-mode', namespace: 'view', labelKey: 'assistantTool.@view/edit-mode' },
  { name: '@view/sidebar', namespace: 'view', labelKey: 'assistantTool.@view/sidebar' },
  { name: '@view/page-size', namespace: 'view', labelKey: 'assistantTool.@view/page-size' },
  // entities
  {
    name: '@entities/select-dataclass',
    namespace: 'entities',
    labelKey: 'assistantTool.@entities/select-dataclass',
  },
  { name: '@entities/select', namespace: 'entities', labelKey: 'assistantTool.@entities/select' },
  { name: '@entities/action', namespace: 'entities', labelKey: 'assistantTool.@entities/action' },
  {
    name: '@entities/paginate',
    namespace: 'entities',
    labelKey: 'assistantTool.@entities/paginate',
  },
  { name: '@entities/refresh', namespace: 'entities', labelKey: 'assistantTool.@entities/refresh' },
  // query
  { name: '@query/set-options', namespace: 'query', labelKey: 'assistantTool.@query/set-options' },
  { name: '@query/run', namespace: 'query', labelKey: 'assistantTool.@query/run' },
  { name: '@query/reset', namespace: 'query', labelKey: 'assistantTool.@query/reset' },
  {
    name: '@query/toggle-panel',
    namespace: 'query',
    labelKey: 'assistantTool.@query/toggle-panel',
  },
  {
    name: '@query/open-filtered-tab',
    namespace: 'query',
    labelKey: 'assistantTool.@query/open-filtered-tab',
  },
  // graph
  { name: '@graph/action', namespace: 'graph', labelKey: 'assistantTool.@graph/action' },
  // metadata
  {
    name: '@metadata/state',
    namespace: 'metadata',
    labelKey: 'assistantTool.@metadata/state',
  },
  {
    name: '@metadata/generate-descriptions',
    namespace: 'metadata',
    labelKey: 'assistantTool.@metadata/generate-descriptions',
  },
  {
    name: '@metadata/clear-descriptions',
    namespace: 'metadata',
    labelKey: 'assistantTool.@metadata/clear-descriptions',
  },
  {
    name: '@metadata/update-descriptions',
    namespace: 'metadata',
    labelKey: 'assistantTool.@metadata/update-descriptions',
  },
  // settings
  { name: '@settings/state', namespace: 'settings', labelKey: 'assistantTool.@settings/state' },
  { name: '@settings/open', namespace: 'settings', labelKey: 'assistantTool.@settings/open' },
  { name: '@settings/update', namespace: 'settings', labelKey: 'assistantTool.@settings/update' },
  {
    name: '@settings/toggle-readonly',
    namespace: 'settings',
    labelKey: 'assistantTool.@settings/toggle-readonly',
  },
  { name: '@settings/profile', namespace: 'settings', labelKey: 'assistantTool.@settings/profile' },
  {
    name: '@settings/dataclass-customization',
    namespace: 'settings',
    labelKey: 'assistantTool.@settings/dataclass-customization',
  },
  { name: '@settings/export', namespace: 'settings', labelKey: 'assistantTool.@settings/export' },
  { name: '@settings/import', namespace: 'settings', labelKey: 'assistantTool.@settings/import' },
  { name: '@settings/reset', namespace: 'settings', labelKey: 'assistantTool.@settings/reset' },
  {
    name: ASSISTANT_TOOLS_META_TOOL,
    namespace: 'settings',
    labelKey: 'assistantTool.@settings/assistant-tools',
  },
  // widgets
  { name: '@widgets/render', namespace: 'widgets', labelKey: 'assistantTool.@widgets/render' },
  // help
  { name: '@help/shortcuts', namespace: 'help', labelKey: 'assistantTool.@help/shortcuts' },
]

export const ALL_ASSISTANT_TOOL_NAMES = ASSISTANT_TOOL_CATALOG.map((t) => t.name)

const CATALOG_TOOL_NAMES = new Set(ALL_ASSISTANT_TOOL_NAMES)

export function isDynamicMethodToolName(toolName: string): boolean {
  if (CATALOG_TOOL_NAMES.has(toolName)) return false
  if (/^@dataclass\/[^/]+\/.+/.test(toolName)) return true
  if (/^@datastore\/methods\/.+/.test(toolName)) return true
  if (/^@datastore\/singletons\/.+\/.+/.test(toolName)) return true
  return false
}

export function getToolNamespace(toolName: string): AssistantToolNamespace | null {
  const match = /^@([^/]+)\//.exec(toolName)
  if (!match) return null
  const ns = match[1] as AssistantToolNamespace
  return ASSISTANT_TOOL_NAMESPACES.includes(ns) ? ns : null
}

export function getToolsByNamespace(namespace: AssistantToolNamespace): AssistantToolMeta[] {
  return ASSISTANT_TOOL_CATALOG.filter((t) => t.namespace === namespace)
}

export function parseToolPattern(pattern: string): ParsedToolPattern | null {
  const trimmed = pattern.trim()
  if (trimmed === '*') return { type: 'all' }
  const wildcardMatch = /^@([^/]+)\/\*$/.exec(trimmed)
  if (wildcardMatch) {
    const namespace = wildcardMatch[1] as AssistantToolNamespace
    if (!ASSISTANT_TOOL_NAMESPACES.includes(namespace)) return null
    return { type: 'namespace', namespace }
  }
  const toolMatch = /^@([^/]+)\/(.+)$/.exec(trimmed)
  if (toolMatch) {
    const namespace = toolMatch[1] as AssistantToolNamespace
    if (!ASSISTANT_TOOL_NAMESPACES.includes(namespace)) return null
    if (!CATALOG_TOOL_NAMES.has(trimmed) && !isDynamicMethodToolName(trimmed)) return null
    return { type: 'tool', toolName: trimmed, namespace }
  }
  return null
}

export function isToolEnabled(name: string, prefs: AssistantToolPrefs): boolean {
  const namespace = getToolNamespace(name)
  if (!namespace) return false
  if (prefs.assistantDisabledNamespaces.includes(namespace)) return false
  if (prefs.assistantDisabledTools.includes(name)) return false
  return true
}

export function applyToolPattern(
  prefs: AssistantToolPrefs,
  pattern: string,
  enabled: boolean
): AssistantToolPrefs {
  const parsed = parseToolPattern(pattern)
  if (!parsed) return prefs

  if (parsed.type === 'all') {
    if (enabled) {
      return { assistantDisabledNamespaces: [], assistantDisabledTools: [] }
    }
    return {
      assistantDisabledNamespaces: [...ASSISTANT_TOOL_NAMESPACES],
      assistantDisabledTools: [],
    }
  }

  if (parsed.type === 'namespace') {
    const namespaces = new Set(prefs.assistantDisabledNamespaces)
    const tools = new Set(prefs.assistantDisabledTools)
    if (enabled) {
      namespaces.delete(parsed.namespace)
      for (const tool of getToolsByNamespace(parsed.namespace)) {
        tools.delete(tool.name)
      }
      for (const name of tools) {
        if (getToolNamespace(name) === parsed.namespace && isDynamicMethodToolName(name)) {
          tools.delete(name)
        }
      }
    } else {
      namespaces.add(parsed.namespace)
      for (const tool of getToolsByNamespace(parsed.namespace)) {
        tools.delete(tool.name)
      }
    }
    return {
      assistantDisabledNamespaces: [...namespaces],
      assistantDisabledTools: [...tools],
    }
  }

  const namespaces = new Set(prefs.assistantDisabledNamespaces)
  const tools = new Set(prefs.assistantDisabledTools)

  if (enabled) {
    if (namespaces.has(parsed.namespace)) {
      namespaces.delete(parsed.namespace)
      for (const tool of getToolsByNamespace(parsed.namespace)) {
        if (tool.name !== parsed.toolName) {
          tools.add(tool.name)
        }
      }
    }
    tools.delete(parsed.toolName)
  } else {
    tools.add(parsed.toolName)
  }

  return {
    assistantDisabledNamespaces: [...namespaces],
    assistantDisabledTools: [...tools],
  }
}

export function getAssistantToolPrefsSummary(prefs: AssistantToolPrefs) {
  const enabled = ASSISTANT_TOOL_CATALOG.filter((t) => isToolEnabled(t.name, prefs))
  const disabled = ASSISTANT_TOOL_CATALOG.filter((t) => !isToolEnabled(t.name, prefs))
  return {
    enabledCount: enabled.length,
    totalCount: ASSISTANT_TOOL_CATALOG.length,
    disabledNamespaces: prefs.assistantDisabledNamespaces,
    disabledTools: prefs.assistantDisabledTools,
    enabledTools: enabled.map((t) => t.name),
    disabledToolNames: disabled.map((t) => t.name),
  }
}
