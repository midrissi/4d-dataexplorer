import { getAssistantToolPrefsSummary } from '~/assistant/tool-catalog'
import { getTheme, getThemeName } from '~/lib/storage'
import {
  formatShortcut,
  type KeyboardShortcut,
  type ShortcutCategory,
  useSettingsStore,
} from '~/store/settings'

export type ShortcutSummary = {
  id: string
  label: string
  category: ShortcutCategory
  keys: string
  enabled: boolean
}

export function summarizeShortcuts(
  shortcuts: KeyboardShortcut[],
  filters?: { query?: string; id?: string; category?: string }
): ShortcutSummary[] {
  let result = shortcuts

  if (filters?.id) {
    result = result.filter((s) => s.id === filters.id)
  }

  if (filters?.category) {
    const category = filters.category.toLowerCase()
    result = result.filter((s) => s.category.toLowerCase().includes(category))
  }

  if (filters?.query) {
    const query = filters.query.toLowerCase()
    result = result.filter(
      (s) =>
        s.id.toLowerCase().includes(query) ||
        s.label.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query)
    )
  }

  return result.map((s) => ({
    id: s.id,
    label: s.label,
    category: s.category,
    keys: formatShortcut(s),
    enabled: s.enabled,
  }))
}

export function getSettingsConfigurationSnapshot() {
  const store = useSettingsStore.getState()
  const currentProfile = store.profiles.find((p) => p.id === store.currentProfileId)

  return {
    profile: currentProfile
      ? {
          id: currentProfile.id,
          name: currentProfile.name,
          icon: currentProfile.icon ?? null,
          color: currentProfile.color ?? null,
        }
      : null,
    profiles: store.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon ?? null,
      color: p.color ?? null,
    })),
    language: store.language,
    theme: getTheme(),
    themeName: getThemeName(),
    readonlyMode: store.readonlyMode,
    sidebarCollapsed: store.sidebarCollapsed,
    assistantOpen: store.assistantOpen,
    defaultViewMode: store.defaultViewMode,
    defaultEntityViewMode: store.defaultEntityViewMode,
    defaultEditMode: store.defaultEditMode,
    sidebarViewMode: store.sidebarViewMode,
    pageSize: store.pageSize,
    activeShortcutPreset: store.activeShortcutPreset,
    codeEditorPrefs: store.codeEditorPrefs,
    dataclassCustomizations: store.dataclassCustomizations,
    assistantTools: getAssistantToolPrefsSummary(store.getAssistantToolPrefs()),
  }
}
