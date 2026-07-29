import { Button } from '@4d/ui'
import { ArrowLeft, Layers, PanelTop } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import {
  getEntityListHeight,
  getEntityListWidth,
  setEntityListHeight,
  setEntityListWidth,
} from '~/lib/storage'
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
import { ResizableHandle, ResizableVerticalHandle } from './ResizablePanel'
import { SchemaBuilderTabView } from './SchemaBuilderTabView'
import { SettingsPage } from './SettingsPage'
import { StaticTabView } from './StaticTabView'
import { WelcomeScreen } from './WelcomeScreen'

const DEFAULT_WIDTH_PERCENT = 40
const MIN_WIDTH_PERCENT = 25
const MAX_WIDTH_PERCENT = 70

const DEFAULT_HEIGHT_PERCENT = 45
const MIN_HEIGHT_PERCENT = 20
const MAX_HEIGHT_PERCENT = 70

/** Max number of dataclass tab contents kept mounted at once (LRU). */
const MAX_MOUNTED_TABS = 10

/**
 * Split-pane content for a single dataclass tab. Kept mounted while its tab is
 * open so scroll position, expanded sections and loaded relations are preserved
 * across tab switches.
 *
 * Below 1200px: list stacked above detail with a vertical (row) resizer.
 * At 1200px+: side-by-side with a horizontal (column) resizer.
 */
function DataclassTabContent({
  tabId,
  widthPercent,
  heightPercent,
  onHorizontalResize,
  onVerticalResize,
  onHorizontalDoubleClick,
  onVerticalDoubleClick,
}: {
  tabId: string
  widthPercent: number
  heightPercent: number
  onHorizontalResize: (delta: number) => void
  onVerticalResize: (delta: number) => void
  onHorizontalDoubleClick: () => void
  onVerticalDoubleClick: () => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const selectedEntityId = useTabsStore((state) => {
    const tab = state.tabs.find((item) => item.id === tabId)
    return tab && isDataclassTab(tab) ? tab.selectedEntityId : null
  })
  const setSelectedEntityId = useTabsStore((state) => state.setSelectedEntityId)
  const showDetail = mobile && Boolean(selectedEntityId)

  if (mobile) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-dataclass-view>
        {showDetail ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-border border-b px-2">
              <Button
                type="button"
                variant="ghost"
                className="h-11 gap-2 px-3"
                onClick={() => setSelectedEntityId(tabId, null)}
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <EntityViewer tabId={tabId} />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <EntityList tabId={tabId} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 max-[1199px]:flex-col"
      data-dataclass-view
      style={
        {
          ['--entity-list-width' as string]: `${widthPercent}%`,
          ['--entity-list-height' as string]: `${heightPercent}%`,
        } as React.CSSProperties
      }
    >
      {/* Entity List — height % when stacked; width % when side-by-side */}
      <div className="min-h-0 min-w-0 overflow-hidden max-[1199px]:h-(--entity-list-height) max-[1199px]:w-full max-[1199px]:shrink-0 min-[1200px]:w-(--entity-list-width) min-[1200px]:shrink-0">
        <EntityList tabId={tabId} />
      </div>

      {/* Vertical resizer — stacked layout only (<1200px) */}
      <ResizableVerticalHandle
        className="min-[1200px]:hidden"
        onResize={onVerticalResize}
        onDoubleClick={onVerticalDoubleClick}
      />

      {/* Horizontal resizer — side-by-side layout only (≥1200px) */}
      <ResizableHandle
        className="hidden min-[1200px]:flex"
        onResize={onHorizontalResize}
        onDoubleClick={onHorizontalDoubleClick}
      />

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

  const [entityListHeightPercent, setEntityListHeightPercent] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = getEntityListHeight()
      if (stored >= MIN_HEIGHT_PERCENT && stored <= MAX_HEIGHT_PERCENT) {
        return stored
      }
    }
    return DEFAULT_HEIGHT_PERCENT
  })

  // Restore entity list size when profile changes (panels prefs are per-profile)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedWidth = getEntityListWidth()
    setEntityListWidthPercent(Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, storedWidth)))
    const storedHeight = getEntityListHeight()
    setEntityListHeightPercent(
      Math.min(MAX_HEIGHT_PERCENT, Math.max(MIN_HEIGHT_PERCENT, storedHeight))
    )
  }, [])

  // Persist panel sizes
  useEffect(() => {
    setEntityListWidth(entityListWidthPercent)
  }, [entityListWidthPercent])

  useEffect(() => {
    setEntityListHeight(entityListHeightPercent)
  }, [entityListHeightPercent])

  const handleHorizontalResize = useCallback((delta: number) => {
    setEntityListWidthPercent((prev) => {
      const container = Array.from(
        document.querySelectorAll<HTMLElement>('[data-dataclass-view]')
      ).find((el) => el.clientWidth > 0)
      if (!container) return prev
      const deltaPercent = (delta / container.clientWidth) * 100
      return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, prev + deltaPercent))
    })
  }, [])

  const handleVerticalResize = useCallback((delta: number) => {
    setEntityListHeightPercent((prev) => {
      const container = Array.from(
        document.querySelectorAll<HTMLElement>('[data-dataclass-view]')
      ).find((el) => el.clientHeight > 0)
      if (!container) return prev
      const deltaPercent = (delta / container.clientHeight) * 100
      return Math.min(MAX_HEIGHT_PERCENT, Math.max(MIN_HEIGHT_PERCENT, prev + deltaPercent))
    })
  }, [])

  const handleHorizontalDoubleClick = useCallback(() => {
    setEntityListWidthPercent(DEFAULT_WIDTH_PERCENT)
  }, [])

  const handleVerticalDoubleClick = useCallback(() => {
    setEntityListHeightPercent(DEFAULT_HEIGHT_PERCENT)
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
              heightPercent={entityListHeightPercent}
              onHorizontalResize={handleHorizontalResize}
              onVerticalResize={handleVerticalResize}
              onHorizontalDoubleClick={handleHorizontalDoubleClick}
              onVerticalDoubleClick={handleVerticalDoubleClick}
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
