import {
  BookText,
  Braces,
  Database,
  FileDown,
  FileText,
  Home,
  List,
  Network,
  Play,
  Send,
  Settings,
  Variable,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { methodExecutorTabLabel } from '~/components/MethodExecutor/method-list-display'
import {
  isAssistantMetadataTab,
  isDataclassTab,
  isEnvironmentsTab,
  isGraphTab,
  isHomeTab,
  isHttpClientTab,
  isListsTab,
  isMethodExecutorTab,
  isRestExportBuilderTab,
  isSchemaBuilderTab,
  isSettingsTab,
  isStaticTab,
  type Tab,
} from '~/store/tabs'

export const STATIC_TAB_TITLE_KEYS: Record<string, string> = {
  'release-notes': 'tabs.releaseNotes',
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string

export function getTabDisplayName(tab: Tab, t: TFunction): string {
  if (isHomeTab(tab)) return t('tabs.home')
  if (isSettingsTab(tab)) return t('tabs.settings')
  if (isGraphTab(tab)) return t('tabs.structure')
  if (isSchemaBuilderTab(tab)) return t('tabs.schemaBuilder')
  if (isAssistantMetadataTab(tab)) return t('tabs.assistantMetadata')
  if (isMethodExecutorTab(tab)) {
    return methodExecutorTabLabel(tab.seed, t('tabs.methodExecutor'))
  }
  if (isHttpClientTab(tab)) {
    if (tab.seed?.label) return tab.seed.label
    if (tab.seed?.method || tab.seed?.path) {
      const method =
        tab.seed.method === 'CUSTOM' ? tab.seed.customMethod || 'CUSTOM' : tab.seed.method || 'GET'
      return `${method} ${tab.seed.path?.split('?')[0] || '/'}`
    }
    return t('tabs.httpClient')
  }
  if (isRestExportBuilderTab(tab)) return t('tabs.restExport')
  if (isEnvironmentsTab(tab)) return t('tabs.environments')
  if (isListsTab(tab)) return t('tabs.lists')
  if (isStaticTab(tab)) return t(STATIC_TAB_TITLE_KEYS[tab.staticId] ?? 'tabs.releaseNotes')
  if (isDataclassTab(tab)) return tab.dataclassName
  return t('tabs.home')
}

export function getTabIcon(tab: Tab): ReactNode {
  if (isHomeTab(tab)) return <Home className="h-4 w-4" />
  if (isSettingsTab(tab)) return <Settings className="h-4 w-4" />
  if (isGraphTab(tab)) return <Network className="h-4 w-4" />
  if (isSchemaBuilderTab(tab)) return <Braces className="h-4 w-4" />
  if (isAssistantMetadataTab(tab)) return <BookText className="h-4 w-4" />
  if (isMethodExecutorTab(tab)) return <Play className="h-4 w-4" />
  if (isHttpClientTab(tab)) return <Send className="h-4 w-4" />
  if (isRestExportBuilderTab(tab)) return <FileDown className="h-4 w-4" />
  if (isEnvironmentsTab(tab)) return <Variable className="h-4 w-4" />
  if (isListsTab(tab)) return <List className="h-4 w-4" />
  if (isStaticTab(tab)) return <FileText className="h-4 w-4" />
  return <Database className="h-4 w-4" />
}

export function formatRelativeTime(timestamp: number, t: TFunction, locale?: string): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return t('commandPalette.justNow')
  if (minutes < 60) return t('commandPalette.minutesAgo', { n: minutes })
  if (hours < 24) return t('commandPalette.hoursAgo', { n: hours })
  if (days < 7) return t('commandPalette.daysAgo', { n: days })
  return new Date(timestamp).toLocaleDateString(locale ?? undefined)
}
