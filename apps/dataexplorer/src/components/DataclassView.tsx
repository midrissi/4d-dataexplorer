import { Layers, PanelTop } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { eventBus } from '~/lib/eventBus'
import { getEntityListWidth, setEntityListWidth } from '~/lib/storage'
import { useDataExplorerStore } from '~/store'
import {
  isDataclassTab,
  isHttpClientTab,
  isMethodExecutorTab,
  useIsAssistantMetadataTabActive,
  useIsGraphTabActive,
  useIsHomeTabActive,
  useIsSchemaBuilderTabActive,
  useIsSettingsTabActive,
  useIsStaticTabActive,
  useTabsStore,
} from '~/store/tabs'
import { AssistantMetadataTabView } from './AssistantMetadataEditor/AssistantMetadataTabView'
import { DataclassGraph } from './DataclassGraph'
import { EntityList } from './EntityList'
import { EntityViewer } from './EntityViewer'
import { HttpClientTabView } from './HttpClient/HttpClientTabView'
import { MethodExecutorTabView } from './MethodExecutor/MethodExecutorTabView'
import { ResizableHandle } from './ResizablePanel'
import { SchemaBuilderTabView } from './SchemaBuilderTabView'
import { SettingsPage } from './SettingsPage'
import { StaticTabView } from './StaticTabView'
import { WelcomeScreen } from './WelcomeScreen'

const DEFAULT_WIDTH_PERCENT = 40
const MIN_WIDTH_PERCENT = 25
const MAX_WIDTH_PERCENT = 70

/** Max number of dataclass tab contents kept mounted at once (LRU). */
const MAX_MOUNTED_TABS = 10

/**
 * Split-pane content for a single dataclass tab. Kept mounted while its tab is
 * open so scroll position, expanded sections and loaded relations are preserved
 * across tab switches.
 */
function DataclassTabContent({
  tabId,
  widthPercent,
  onResize,
  onDoubleClick,
}: {
  tabId: string
  widthPercent: number
  onResize: (delta: number) => void
  onDoubleClick: () => void
}) {
  return (
    <div className="flex h-full max-lg:min-h-0 max-lg:flex-col" data-dataclass-view>
      {/* Entity List Panel — full width when stacked; % width from lg up */}
      <div
        className="min-h-0 min-w-0 overflow-hidden max-lg:h-[min(45%,22rem)] max-lg:w-full max-lg:shrink-0 max-lg:border-border max-lg:border-b lg:w-(--entity-list-width) lg:shrink-0"
        style={{ ['--entity-list-width' as string]: `${widthPercent}%` }}
      >
        <EntityList tabId={tabId} />
      </div>

      {/* Resize Handle — desktop split only */}
      <div className="hidden lg:contents">
        <ResizableHandle onResize={onResize} onDoubleClick={onDoubleClick} />
      </div>

      {/* Entity Viewer Panel */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <EntityViewer tabId={tabId} />
      </div>
    </div>
  )
}

export function DataclassView() {
  const { t } = useTranslation()
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const isHomeTabActive = useIsHomeTabActive()
  const isSettingsTabActive = useIsSettingsTabActive()
  const isGraphTabActive = useIsGraphTabActive()
  const isStaticTabActive = useIsStaticTabActive()
  const isSchemaBuilderTabActive = useIsSchemaBuilderTabActive()
  const isAssistantMetadataTabActive = useIsAssistantMetadataTabActive()

  const activeDataclassTabId = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId)
    return tab && isDataclassTab(tab) ? tab.id : null
  }, [tabs, activeTabId])

  const methodExecutorTabs = useMemo(() => tabs.filter(isMethodExecutorTab), [tabs])
  const activeMethodExecutorTabId = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId)
    return tab && isMethodExecutorTab(tab) ? tab.id : null
  }, [tabs, activeTabId])

  const httpClientTabs = useMemo(() => tabs.filter(isHttpClientTab), [tabs])
  const activeHttpClientTabId = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId)
    return tab && isHttpClientTab(tab) ? tab.id : null
  }, [tabs, activeTabId])

  // Track which dataclass tabs are kept mounted (most-recently-active first).
  const [mountedIds, setMountedIds] = useState<string[]>([])
  // Per-tab remount counter; bumped on explicit refresh to reset a tab's content
  // (loaded relations, expanded sections, scroll) and force a fresh fetch.
  const [remountKeys, setRemountKeys] = useState<Record<string, number>>({})
  const clearTabData = useDataExplorerStore((s) => s.clearTabData)
  const refreshCurrentView = useDataExplorerStore((s) => s.refreshCurrentView)

  // Promote the active dataclass tab to the front and cap the mounted set.
  useEffect(() => {
    if (!activeDataclassTabId) return
    setMountedIds((prev) => {
      const without = prev.filter((id) => id !== activeDataclassTabId)
      return [activeDataclassTabId, ...without].slice(0, MAX_MOUNTED_TABS)
    })
  }, [activeDataclassTabId])

  // Drop mounted entries whose tabs were closed or are no longer dataclass tabs,
  // and release their cached entity slices.
  useEffect(() => {
    const liveDataclassIds = new Set(tabs.filter((t) => isDataclassTab(t)).map((t) => t.id))
    setMountedIds((prev) => {
      const next = prev.filter((id) => liveDataclassIds.has(id))
      return next.length === prev.length ? prev : next
    })
    for (const id of Object.keys(useDataExplorerStore.getState().tabData)) {
      if (!liveDataclassIds.has(id)) clearTabData(id)
    }
  }, [tabs, clearTabData])

  // Explicit refresh: remount the active tab's content (clearing its cached UI
  // state and loaded relations) and refetch its entities.
  useEffect(() => {
    const sub = eventBus.on('refresh-view', () => {
      const activeId = useTabsStore.getState().activeTabId
      const activeTab = tabs.find((t) => t.id === activeId)
      if (activeId && activeTab && isDataclassTab(activeTab)) {
        setRemountKeys((prev) => ({ ...prev, [activeId]: (prev[activeId] ?? 0) + 1 }))
      }
      void refreshCurrentView()
    })
    return () => sub.unsubscribe()
  }, [tabs, refreshCurrentView])

  const [entityListWidthPercent, setEntityListWidthPercent] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = getEntityListWidth()
      if (stored >= MIN_WIDTH_PERCENT && stored <= MAX_WIDTH_PERCENT) {
        return stored
      }
    }
    return DEFAULT_WIDTH_PERCENT
  })

  // Restore entity list width when profile changes (panels prefs are per-profile)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = getEntityListWidth()
      const clamped = Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, stored))
      setEntityListWidthPercent(clamped)
    }
  }, [])

  // Save width to storage
  useEffect(() => {
    setEntityListWidth(entityListWidthPercent)
  }, [entityListWidthPercent])

  const handleResize = useCallback((delta: number) => {
    setEntityListWidthPercent((prev) => {
      // Convert pixel delta to percentage based on the visible container width
      const container = Array.from(
        document.querySelectorAll<HTMLElement>('[data-dataclass-view]')
      ).find((el) => el.clientWidth > 0)
      if (!container) return prev
      const containerWidth = container.clientWidth
      const deltaPercent = (delta / containerWidth) * 100
      const newPercent = prev + deltaPercent
      return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, newPercent))
    })
  }, [])

  const handleDoubleClick = useCallback(() => {
    setEntityListWidthPercent(DEFAULT_WIDTH_PERCENT)
  }, [])

  // Non-dataclass active views are rendered as an overlay over the (hidden)
  // mounted dataclass contents so the latter keep their state while inactive.
  let overlay: React.ReactNode = null
  if (tabs.length === 0 || isHomeTabActive) {
    overlay = <WelcomeScreen />
  } else if (isSettingsTabActive) {
    overlay = <SettingsPage />
  } else if (isGraphTabActive) {
    overlay = <DataclassGraph />
  } else if (isStaticTabActive) {
    overlay = <StaticTabView />
  } else if (isSchemaBuilderTabActive) {
    overlay = <SchemaBuilderTabView />
  } else if (isAssistantMetadataTabActive) {
    overlay = <AssistantMetadataTabView />
  } else if (!activeDataclassTabId && !activeMethodExecutorTabId && !activeHttpClientTabId) {
    overlay = (
      <EmptyPanel
        icon={Layers}
        badgeIcon={PanelTop}
        badgeTone="primary"
        title={t('dataclassView.selectTabToViewEntities')}
        description={t('dataclassView.tabsOpenCount', { count: tabs.length })}
        ghost="cards"
        size="lg"
        className="h-full min-h-0"
      />
    )
  }

  return (
    <div className="h-full">
      {mountedIds.map((id) => {
        const tab = tabs.find((t) => t.id === id)
        if (!tab || !isDataclassTab(tab)) return null
        const isActive = id === activeTabId
        return (
          <div key={id} className="h-full" style={{ display: isActive ? 'block' : 'none' }}>
            <DataclassTabContent
              key={remountKeys[id] ?? 0}
              tabId={id}
              widthPercent={entityListWidthPercent}
              onResize={handleResize}
              onDoubleClick={handleDoubleClick}
            />
          </div>
        )
      })}
      {methodExecutorTabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div key={tab.id} className="h-full" style={{ display: isActive ? 'block' : 'none' }}>
            <MethodExecutorTabView tab={tab} />
          </div>
        )
      })}
      {httpClientTabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div key={tab.id} className="h-full" style={{ display: isActive ? 'block' : 'none' }}>
            <HttpClientTabView tab={tab} />
          </div>
        )
      })}
      {overlay}
    </div>
  )
}
