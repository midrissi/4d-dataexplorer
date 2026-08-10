import type { TFunction } from '~/components/CommandPalette/utils'
import { formatCount } from '~/lib/utils'
import {
  isAssistantMetadataTab,
  isDataclassTab,
  isEnvironmentsTab,
  isGraphTab,
  isHomeTab,
  isHttpClientTab,
  isMethodExecutorTab,
  isRestExportBuilderTab,
  isSchemaBuilderTab,
  isSettingsTab,
  isStaticTab,
  type Tab,
} from '~/store/tabs'

export type TabOverviewDetails = {
  /** Short type / context line under the tab title */
  subtitle: string
  /** Extra chips shown in the preview footer strip */
  chips: string[]
}

export function getTabOverviewDetails(
  tab: Tab,
  t: TFunction,
  options?: { count?: number }
): TabOverviewDetails {
  const count = options?.count ?? 0

  if (isDataclassTab(tab)) {
    const chips: string[] = []
    chips.push(tab.viewMode === 'cards' ? t('command.cardView') : t('command.tableView'))
    if (tab.entitySetId || tab.queryOptions.filter.trim()) {
      chips.push(t('tabs.filtered'))
    }
    if (count > 0) {
      chips.push(formatCount(count))
    }

    let subtitle = tab.dataclassName
    if (tab.customTitle) {
      subtitle = tab.customTitle
    } else if (tab.queryOptions.filter.trim()) {
      const filter = tab.queryOptions.filter.trim()
      subtitle = filter.length > 36 ? `${filter.slice(0, 36)}…` : filter
    } else if (tab.entitySetId) {
      subtitle = t('tabs.filtered')
    } else {
      subtitle = ''
    }

    return { subtitle, chips }
  }

  if (isHttpClientTab(tab)) {
    const method =
      tab.seed?.method === 'CUSTOM' ? tab.seed.customMethod || 'CUSTOM' : tab.seed?.method || 'GET'
    const path = tab.seed?.path?.split('?')[0] || '/'
    const chips = [method]
    if (tab.seed?.body?.mode && tab.seed.body.mode !== 'none') {
      chips.push(tab.seed.body.mode)
    }
    return {
      subtitle: `${method} ${path}`,
      chips,
    }
  }

  if (isMethodExecutorTab(tab)) {
    const chips: string[] = []
    if (tab.seed?.scope) chips.push(tab.seed.scope)
    if (tab.seed?.dataClass) chips.push(tab.seed.dataClass)
    return {
      subtitle: tab.seed?.methodName ?? t('tabs.methodExecutor'),
      chips,
    }
  }

  if (isSettingsTab(tab)) {
    return { subtitle: t('tabs.settings'), chips: [] }
  }
  if (isHomeTab(tab)) {
    return { subtitle: t('tabs.home'), chips: [] }
  }
  if (isGraphTab(tab)) {
    return { subtitle: t('tabs.structure'), chips: [] }
  }
  if (isSchemaBuilderTab(tab)) {
    return { subtitle: t('tabs.schemaBuilder'), chips: [] }
  }
  if (isAssistantMetadataTab(tab)) {
    return { subtitle: t('tabs.assistantMetadata'), chips: [] }
  }
  if (isRestExportBuilderTab(tab)) {
    return { subtitle: t('tabs.restExport'), chips: [] }
  }
  if (isEnvironmentsTab(tab)) {
    return { subtitle: t('tabs.environments'), chips: [] }
  }
  if (isStaticTab(tab)) {
    return { subtitle: t('tabs.releaseNotes'), chips: [] }
  }

  return { subtitle: '', chips: [] }
}
