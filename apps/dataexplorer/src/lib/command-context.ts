import { type ThemeName, themes } from '@4d/ui'
import { getLabel, type Locale } from '~/i18n/labels'
import { isCloudLlmOffline } from '~/lib/assistant-llm-configured'
import type { CommandContext } from '~/lib/commands'
import {
  DEFAULT_PROFILE_PREFS,
  getTheme,
  getThemeName,
  setTheme as saveTheme,
  setThemeName as saveThemeName,
} from '~/lib/storage'
import { useDataExplorerStore } from '~/store'
import { useSettingsStore } from '~/store/settings'
import { isDataclassTab, useTabsStore } from '~/store/tabs'

export type CommandContextOverrides = Partial<
  Pick<CommandContext, 'onClose' | 'onShowHelp' | 'onEnterSwitchTabsMode'>
>

const noop = () => {}

export function createCommandContext(overrides: CommandContextOverrides = {}): CommandContext {
  const settings = useSettingsStore.getState()
  const tabsState = useTabsStore.getState()
  const dataState = useDataExplorerStore.getState()
  const locale = settings.language as Locale

  const activeTab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
  const activeDataclassTab =
    activeTab && isDataclassTab(activeTab)
      ? { dataclassName: activeTab.dataclassName, id: activeTab.id, viewMode: activeTab.viewMode }
      : null

  const storedTheme = getTheme()
  const theme = storedTheme === 'dark' ? 'dark' : 'light'
  const storedThemeName = getThemeName()
  const themeName =
    storedThemeName && storedThemeName in themes
      ? (storedThemeName as ThemeName)
      : (DEFAULT_PROFILE_PREFS.themeName as ThemeName)

  return {
    t: (key, params) => getLabel(locale, key, params),
    theme,
    themeName,
    availableThemes: themes,
    setTheme: (next) => {
      saveTheme(next)
    },
    toggleTheme: () => {
      saveTheme(theme === 'dark' ? 'light' : 'dark')
    },
    setThemeName: (name) => {
      saveThemeName(name)
    },
    sidebarCollapsed: settings.sidebarCollapsed,
    toggleSidebarCollapsed: () => settings.toggleSidebarCollapsed(),
    dataclasses: dataState.dataclasses,
    selectedDataclass: dataState.selectedDataclass,
    selectDataclass: dataState.selectDataclass,
    fetchDataclasses: () => {
      void dataState.fetchDataclasses()
    },
    fetchEntities: (page) => {
      void dataState.fetchEntities(page)
    },
    openTab: tabsState.openTab,
    openAllDataclasses: tabsState.openAllDataclasses,
    openHomeTab: tabsState.openHomeTab,
    openGraphTab: tabsState.openGraphTab,
    openAssistantMetadataTab: tabsState.openAssistantMetadataTab,
    openMethodExecutorTab: () => tabsState.openMethodExecutorTab(),
    openHttpClientTab: () => tabsState.openHttpClientTab(),
    openRestExportBuilderTab: () => tabsState.openRestExportBuilderTab(),
    entities: dataState.entities,
    selectedEntityId: dataState.selectedEntityId,
    isEditing: dataState.isEditing,
    setIsEditing: dataState.setIsEditing,
    viewMode: activeDataclassTab?.viewMode ?? 'cards',
    setViewMode: (mode) => {
      if (activeDataclassTab) {
        tabsState.setViewMode(activeDataclassTab.id, mode)
      }
    },
    tabs: tabsState.tabs,
    activeTabId: tabsState.activeTabId,
    activeDataclassTab: activeDataclassTab
      ? { dataclassName: activeDataclassTab.dataclassName }
      : null,
    closeTab: tabsState.closeTab,
    closeOtherTabs: tabsState.closeOtherTabs,
    closeTabsToRight: tabsState.closeTabsToRight,
    closeAllTabs: tabsState.closeAllTabs,
    togglePinTab: tabsState.togglePinTab,
    pinAllTabs: tabsState.pinAllTabs,
    unpinAllTabs: tabsState.unpinAllTabs,
    openSettingsTab: tabsState.openSettingsTab,
    readonlyMode: settings.readonlyMode,
    toggleReadonlyMode: () => settings.toggleReadonlyMode(),
    shortcuts: settings.shortcuts,
    assistantOpen: settings.assistantOpen,
    toggleAssistantOpen: () => settings.toggleAssistantOpen(),
    cloudLlmOffline: isCloudLlmOffline(),
    consoleOpen: settings.consoleOpen,
    toggleConsoleOpen: () => settings.toggleConsoleOpen(),
    bottomPanelTab: settings.bottomPanelTab,
    toggleTerminalOpen: () => settings.toggleTerminalOpen(),
    onClose: overrides.onClose ?? noop,
    onShowHelp: overrides.onShowHelp ?? noop,
    onEnterSwitchTabsMode: overrides.onEnterSwitchTabsMode,
  }
}
