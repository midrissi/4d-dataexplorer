import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import {
  BookText,
  Braces,
  Copy,
  Database,
  FileText,
  Home,
  Network,
  Pin,
  Play,
  Send,
  Settings,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { eventBus } from '~/lib/eventBus'
import { formatCount } from '~/lib/utils'
import { useDataExplorerStore } from '~/store'
import {
  formatShortcut,
  getShortcutById,
  useDataclassCustomizations,
  useShortcuts,
} from '~/store/settings'
import {
  isAssistantMetadataTab,
  isDataclassTab,
  isGraphTab,
  isHomeTab,
  isHttpClientTab,
  isMethodExecutorTab,
  isSchemaBuilderTab,
  isSettingsTab,
  isStaticTab,
  type Tab,
  useTabsStore,
} from '~/store/tabs'
import { DataclassIcon, getDataclassColorClasses } from './DataclassCustomizeModal'

/** Translation keys for static tab IDs */
const STATIC_TAB_TITLE_KEYS: Record<string, string> = {
  'release-notes': 'tabs.releaseNotes',
}

type TabColorClasses = ReturnType<typeof getDataclassColorClasses>

function TabTopIndicator({
  colorClasses,
  visible,
}: {
  colorClasses: TabColorClasses
  visible: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5',
        visible ? colorClasses.bg : 'bg-transparent'
      )}
    />
  )
}

function tabSurfaceClasses(isActive: boolean, isDragging: boolean, base: string): string {
  return cn(
    base,
    // Keep geometry identical for active/inactive: same border box, weight, and -mb-px.
    'relative -mb-px flex h-8 shrink-0 flex-col overflow-hidden rounded-none border font-medium text-xs transition-colors',
    isActive
      ? 'z-10 border-border/50 border-b-background bg-muted text-foreground'
      : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
    isDragging && 'opacity-50'
  )
}

const TAB_LIST_SCROLL_CLASS =
  'overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export function TabBar() {
  const { t } = useTranslation()

  const getTabDisplayName = useCallback(
    (tab: Tab) => {
      if (isHomeTab(tab)) return t('tabs.home')
      if (isSettingsTab(tab)) return t('tabs.settings')
      if (isGraphTab(tab)) return t('tabs.structure')
      if (isSchemaBuilderTab(tab)) return t('tabs.schemaBuilder')
      if (isAssistantMetadataTab(tab)) return t('tabs.assistantMetadata')
      if (isMethodExecutorTab(tab)) {
        return tab.seed
          ? `${tab.seed.dataClass ? `${tab.seed.dataClass}.` : ''}${tab.seed.methodName}`
          : t('tabs.methodExecutor')
      }
      if (isHttpClientTab(tab)) {
        if (tab.seed?.label) return tab.seed.label
        if (tab.seed?.method || tab.seed?.path) {
          const method =
            tab.seed.method === 'CUSTOM'
              ? tab.seed.customMethod || 'CUSTOM'
              : tab.seed.method || 'GET'
          return `${method} ${tab.seed.path?.split('?')[0] || '/'}`
        }
        return t('tabs.httpClient')
      }
      if (isStaticTab(tab)) return t(STATIC_TAB_TITLE_KEYS[tab.staticId] ?? 'tabs.releaseNotes')
      if (isDataclassTab(tab) && tab.customTitle) {
        return tab.customTitle
      }
      if (isDataclassTab(tab) && tab.entitySetId) {
        return `${tab.dataclassName} (${t('tabs.filtered')})`
      }
      return tab.dataclassName
    },
    [t]
  )

  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    togglePinTab,
    pinAllTabs,
    unpinAllTabs,
    moveTab,
    openGraphTab,
  } = useTabsStore()

  const dataclasses = useDataExplorerStore((s) => s.dataclasses)
  const pagination = useDataExplorerStore((s) => s.pagination)
  const selectedDataclass = useDataExplorerStore((s) => s.selectedDataclass)
  const dataclassCustomizations = useDataclassCustomizations()
  const shortcuts = useShortcuts()
  const closeTabShortcut = getShortcutById(shortcuts, 'close-tab')
  const pinTabShortcut = getShortcutById(shortcuts, 'pin-tab')
  const openStructureShortcut = getShortcutById(shortcuts, 'open-structure')

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const isDraggingRef = useRef(false)
  const dragStartIndexRef = useRef<number | null>(null)
  const dropTargetIndexRef = useRef<number | null>(null)

  const handleTabClick = useCallback(
    (tab: Tab) => {
      if (isDraggingRef.current) return
      // Activating the tab triggers syncActiveTab (App.tsx), which restores the
      // tab's cached entity slice instantly or fetches it on first activation.
      // Do NOT call selectDataclass here: it would wipe the cached slice and
      // refetch page 1, losing the tab's page/selection/relations.
      setActiveTab(tab.id)
    },
    [setActiveTab]
  )

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation()
      closeTab(tabId)
    },
    [closeTab]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault()
    setContextMenuTabId(tab.id)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
  }, [])

  // Scroll tab list so the active tab is visible when selection changes
  useEffect(() => {
    if (!activeTabId) return
    const el = tabRefs.current.get(activeTabId)
    if (el) {
      const scroll = () => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }
      requestAnimationFrame(scroll)
    }
  }, [activeTabId])

  // Horizontal scroll with mouse wheel when the tab strip overflows
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      el.scrollLeft += event.deltaY
      event.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenuTabId(null)
    setContextMenuPosition(null)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tab: Tab, index: number) => {
      if (e.button !== 0) return // Only left click

      // Don't allow dragging tabs with fixed index
      if (tab.index !== undefined) return

      const draggedTab = tabs[index]
      isDraggingRef.current = false
      dragStartIndexRef.current = index

      const startX = e.clientX

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = Math.abs(moveEvent.clientX - startX)
        if (deltaX > 5 && !isDraggingRef.current) {
          isDraggingRef.current = true
          setDraggedTabId(tab.id)
        }

        if (!isDraggingRef.current) return

        // Find drop target based on mouse position
        let targetIndex = tabs.length // Default to end
        const tabEntries = Array.from(tabRefs.current.entries())

        for (let i = 0; i < tabEntries.length; i++) {
          const [, tabEl] = tabEntries[i]
          const rect = tabEl.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2

          if (moveEvent.clientX < centerX) {
            targetIndex = i
            break
          }
        }

        // Don't allow dropping at positions occupied by fixed-index tabs
        const targetTab = tabs[targetIndex]
        if (targetTab?.index !== undefined) {
          // Find next available position
          targetIndex = targetIndex + 1
        }

        // Prevent moving between pinned and unpinned
        const finalTargetTab = tabs[targetIndex] || tabs[tabs.length - 1]
        if (finalTargetTab && draggedTab.isPinned !== finalTargetTab.isPinned) {
          return
        }

        dropTargetIndexRef.current = targetIndex
        setDropTargetIndex(targetIndex)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        const fromIndex = dragStartIndexRef.current
        const toIndex = dropTargetIndexRef.current

        if (
          isDraggingRef.current &&
          fromIndex !== null &&
          toIndex !== null &&
          fromIndex !== toIndex
        ) {
          // Adjust target index if moving forward
          const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex
          if (fromIndex !== adjustedToIndex) {
            moveTab(fromIndex, adjustedToIndex)
          }
        }

        setDraggedTabId(null)
        setDropTargetIndex(null)
        dragStartIndexRef.current = null
        dropTargetIndexRef.current = null

        // Delay resetting drag flag to prevent click from firing
        setTimeout(() => {
          isDraggingRef.current = false
        }, 0)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [tabs, moveTab]
  )

  const getTabCount = useCallback(
    (tab: Tab) => {
      if (
        isHomeTab(tab) ||
        isSettingsTab(tab) ||
        isGraphTab(tab) ||
        isStaticTab(tab) ||
        isSchemaBuilderTab(tab) ||
        isAssistantMetadataTab(tab) ||
        isMethodExecutorTab(tab) ||
        isHttpClientTab(tab)
      ) {
        return 0
      }

      if (isDataclassTab(tab)) {
        if (tab.id === activeTabId && pagination && selectedDataclass === tab.dataclassName) {
          return pagination.total
        }
        if (tab.selectionCount != null) return tab.selectionCount
      }

      return dataclasses.find((c) => c.name === tab.dataclassName)?.count || 0
    },
    [activeTabId, dataclasses, pagination, selectedDataclass]
  )

  const contextMenuTab = contextMenuTabId ? tabs.find((t) => t.id === contextMenuTabId) : null
  const contextMenuEntitySetId =
    contextMenuTab && isDataclassTab(contextMenuTab) ? contextMenuTab.entitySetId : null

  if (tabs.length === 0) {
    return (
      <div className="flex h-8 items-center border-b bg-muted/40 px-2">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Database className="h-3.5 w-3.5" />
          {t('tabs.noTabsOpenHint')}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mt-1 shrink-0 border-border/60 border-b bg-muted/20">
        <div
          ref={containerRef}
          role="tablist"
          className={cn('flex h-8 items-center gap-0.5 px-1', TAB_LIST_SCROLL_CLASS)}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId
            const isDragging = tab.id === draggedTabId
            const showDropIndicator =
              dropTargetIndex === index && draggedTabId !== null && draggedTabId !== tab.id
            const count = getTabCount(tab)
            const displayName = getTabDisplayName(tab)
            const isHome = isHomeTab(tab)
            const isSettings = isSettingsTab(tab)
            const isGraph = isGraphTab(tab)
            const isStatic = isStaticTab(tab)
            const isSchemaBuilder = isSchemaBuilderTab(tab)
            const isAssistantMetadata = isAssistantMetadataTab(tab)
            const isMethodExecutor = isMethodExecutorTab(tab)
            const isHttpClient = isHttpClientTab(tab)
            const isDataclass = isDataclassTab(tab)
            const showCount =
              !isHome &&
              !isSettings &&
              !isGraph &&
              !isStatic &&
              !isSchemaBuilder &&
              !isAssistantMetadata &&
              !isMethodExecutor &&
              !isHttpClient

            // Get customization for dataclass tabs
            const customization = isDataclass
              ? dataclassCustomizations[tab.dataclassName]
              : undefined
            const colorClasses = getDataclassColorClasses(customization)

            // Render icon based on tab type
            const renderTabIcon = (className: string) => {
              if (isHome) return <Home className={className} />
              if (isSettings) return <Settings className={className} />
              if (isGraph) return <Network className={className} />
              if (isSchemaBuilder) return <Braces className={className} />
              if (isAssistantMetadata) return <BookText className={className} />
              if (isMethodExecutor) return <Play className={className} />
              if (isHttpClient) return <Send className={className} />
              if (isStatic) return <FileText className={className} />
              return <DataclassIcon customization={customization} className={className} />
            }

            // Pinned tabs: show only icon with tooltip
            if (tab.isPinned) {
              return (
                <div key={tab.id} className="relative flex shrink-0 items-center">
                  {/* Drop indicator */}
                  {showDropIndicator && (
                    <div className="absolute top-1 bottom-1 -left-0.5 z-20 w-1 rounded-full bg-primary shadow-lg shadow-primary/50" />
                  )}
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          ref={(el) => {
                            if (el) tabRefs.current.set(tab.id, el)
                            else tabRefs.current.delete(tab.id)
                          }}
                          role="tab"
                          tabIndex={0}
                          aria-selected={isActive}
                          aria-label={
                            isHome
                              ? t('tabs.home')
                              : showCount
                                ? `${displayName} (${formatCount(count)})`
                                : displayName
                          }
                          onMouseDown={(e) => handleMouseDown(e, tab, index)}
                          onClick={() => handleTabClick(tab)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleTabClick(tab)
                            }
                          }}
                          onContextMenu={(e) => handleContextMenu(e, tab)}
                          style={colorClasses.style}
                          className={tabSurfaceClasses(
                            isActive,
                            isDragging,
                            'group relative w-8 cursor-pointer select-none'
                          )}
                        >
                          <TabTopIndicator colorClasses={colorClasses} visible={isActive} />
                          <div className="flex min-h-0 flex-1 items-center justify-center">
                            {renderTabIcon(
                              cn(
                                'h-3.5 w-3.5 shrink-0',
                                isActive || (isDataclass && customization)
                                  ? colorClasses.text
                                  : 'text-muted-foreground group-hover:text-foreground'
                              )
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="flex items-center gap-2">
                        <span className="font-medium">{displayName}</span>
                        {showCount && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums">
                            {formatCount(count)}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">{t('tabs.pinned')}</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )
            }

            // Regular tabs: show full content
            return (
              <div key={tab.id} className="relative flex shrink-0 items-center">
                {/* Drop indicator */}
                {showDropIndicator && (
                  <div className="absolute top-1 bottom-1 -left-0.5 z-20 w-1 rounded-full bg-primary shadow-lg shadow-primary/50" />
                )}
                <div
                  ref={(el) => {
                    if (el) tabRefs.current.set(tab.id, el)
                    else tabRefs.current.delete(tab.id)
                  }}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  onMouseDown={(e) => handleMouseDown(e, tab, index)}
                  onClick={() => handleTabClick(tab)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleTabClick(tab)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, tab)}
                  style={colorClasses.style}
                  className={tabSurfaceClasses(
                    isActive,
                    isDragging,
                    'group relative min-w-30 max-w-50 cursor-pointer select-none'
                  )}
                >
                  <TabTopIndicator colorClasses={colorClasses} visible={isActive} />
                  <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1 px-2">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {renderTabIcon(
                              cn(
                                'h-3 w-3 shrink-0',
                                isActive || (isDataclass && customization)
                                  ? colorClasses.text
                                  : 'text-muted-foreground group-hover:text-foreground'
                              )
                            )}
                            <span className="truncate">{displayName}</span>
                            {showCount ? (
                              <span className="min-w-8 shrink-0 text-right font-mono text-muted-foreground text-xs tabular-nums">
                                {formatCount(count)}
                              </span>
                            ) : (
                              <span className="min-w-8 shrink-0" aria-hidden />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="flex max-w-sm items-center gap-2">
                          <span className="font-medium">{displayName}</span>
                          {showCount ? (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums">
                              {formatCount(count)}
                            </span>
                          ) : null}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Close control: always reserve the same slot to avoid layout shift */}
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                      {tab.isClosable !== false ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="iconXs"
                                onClick={(e) => handleCloseTab(e, tab.id)}
                                className={cn(
                                  'h-5! w-5!',
                                  isActive
                                    ? 'opacity-70 hover:opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                )}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Close tab
                              {closeTabShortcut?.enabled && (
                                <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">
                                  {formatShortcut(closeTabShortcut)}
                                </kbd>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Drop indicator at end */}
          {dropTargetIndex === tabs.length && draggedTabId !== null && (
            <div className="relative flex shrink-0 items-center">
              <div className="absolute top-1 bottom-1 -left-0.5 z-20 w-1 rounded-full bg-primary shadow-lg shadow-primary/50" />
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenuTabId} onOpenChange={(open) => !open && closeContextMenu()}>
        <DropdownMenuContent
          style={{
            position: 'fixed',
            left: contextMenuPosition?.x ?? 0,
            top: contextMenuPosition?.y ?? 0,
          }}
          className="w-auto min-w-0 max-w-[min(20rem,100vw)]"
        >
          {contextMenuTab && (
            <>
              {/* Pin/Unpin option (hidden for tabs with fixed index) */}
              {contextMenuTab.index === undefined && (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      togglePinTab(contextMenuTab.id)
                      closeContextMenu()
                    }}
                    className="flex w-full items-center gap-2 whitespace-nowrap"
                  >
                    <Pin
                      className={cn('h-4 w-4 shrink-0', contextMenuTab.isPinned && '-rotate-45')}
                    />
                    <span className="min-w-0 flex-1">
                      {contextMenuTab.isPinned ? t('tabs.unpinTab') : t('tabs.pinTab')}
                    </span>
                    {pinTabShortcut?.enabled && (
                      <kbd className="shrink-0 rounded bg-muted px-1.5 text-xs">
                        {formatShortcut(pinTabShortcut)}
                      </kbd>
                    )}
                  </DropdownMenuItem>
                  {tabs.some((t) => t.index === undefined && !t.isPinned) && (
                    <DropdownMenuItem
                      onClick={() => {
                        pinAllTabs()
                        closeContextMenu()
                      }}
                      className="flex w-full items-center gap-2 whitespace-nowrap"
                    >
                      <Pin className="h-4 w-4 shrink-0" />
                      {t('command.pinAllTabs')}
                    </DropdownMenuItem>
                  )}
                  {tabs.some((t) => t.index === undefined && t.isPinned) && (
                    <DropdownMenuItem
                      onClick={() => {
                        unpinAllTabs()
                        closeContextMenu()
                      }}
                      className="flex w-full items-center gap-2 whitespace-nowrap"
                    >
                      <Pin className="h-4 w-4 shrink-0 -rotate-45" />
                      {t('command.unpinAllTabs')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {/* Highlight in graph (dataclass tabs only) */}
              {isDataclassTab(contextMenuTab) && (
                <DropdownMenuItem
                  onClick={() => {
                    const name = contextMenuTab.dataclassName
                    openGraphTab().then(() => {
                      eventBus.emit('highlight-dataclass-in-graph', name)
                    })
                    closeContextMenu()
                  }}
                  className="flex w-full items-center gap-2 whitespace-nowrap"
                >
                  <Network className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">{t('tabs.highlightInGraph')}</span>
                  {openStructureShortcut?.enabled && (
                    <kbd className="shrink-0 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(openStructureShortcut)}
                    </kbd>
                  )}
                </DropdownMenuItem>
              )}
              {contextMenuEntitySetId ? (
                <DropdownMenuItem
                  onClick={() => {
                    void navigator.clipboard.writeText(contextMenuEntitySetId)
                    closeContextMenu()
                  }}
                  className="flex w-full items-center gap-2 whitespace-nowrap"
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">{t('tabs.copyEntitySetId')}</span>
                </DropdownMenuItem>
              ) : null}
              {isDataclassTab(contextMenuTab) && <DropdownMenuSeparator />}
              {/* Close option (hidden for non-closable tabs and pinned tabs) */}
              {contextMenuTab.isClosable !== false && !contextMenuTab.isPinned && (
                <DropdownMenuItem
                  onClick={() => {
                    closeTab(contextMenuTab.id)
                    closeContextMenu()
                  }}
                  className="flex w-full items-center gap-2 whitespace-nowrap"
                >
                  <X className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">{t('tabs.closeTab')}</span>
                  {closeTabShortcut?.enabled && (
                    <kbd className="shrink-0 rounded bg-muted px-1.5 text-xs">
                      {formatShortcut(closeTabShortcut)}
                    </kbd>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  closeOtherTabs(contextMenuTab.id)
                  closeContextMenu()
                }}
                className="whitespace-nowrap"
              >
                {t('command.closeOtherTabs')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  closeTabsToRight(contextMenuTab.id)
                  closeContextMenu()
                }}
                className="whitespace-nowrap"
              >
                {t('command.closeTabsToRight')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  closeAllTabs()
                  closeContextMenu()
                }}
                className="whitespace-nowrap text-destructive focus:text-destructive"
              >
                {t('command.closeAllTabs')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
