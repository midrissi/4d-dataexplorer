import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import {
  BookText,
  Braces,
  ChevronsRight,
  Command,
  Eye,
  FileDown,
  Keyboard,
  List,
  Loader2,
  LogOut,
  Network,
  PanelBottom,
  Pencil,
  Play,
  Plug,
  RefreshCcw,
  RefreshCw,
  Search,
  Send,
  Settings,
  Terminal,
  UserCircle,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { AssistantChatbot } from '~/assistant/AssistantChatbot'
import { syncAssistantToolPrefs } from '~/assistant/sync-tool-prefs'
import { dataExplorerToolRegistry } from '~/assistant/tool-registry'
import { refreshWidgetTools } from '~/assistant/ui-tools/widgets'
import { useCloudLlmOffline } from '~/hooks/useCloudLlmOffline'
import { useTranslation } from '~/i18n'
import { isCloudLlmOffline } from '~/lib/assistant-llm-configured'
import type { CommandPaletteMode } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'
import { resolveLucideIcon } from '~/lib/lucide-icon'
import {
  mobileCenteredDialogClass,
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { isModClick } from '~/lib/mod-click'
import { isDesktop, isMobileShell } from '~/lib/platform'
import { getConsoleHeight, setConsoleHeight as saveConsoleHeight } from '~/lib/storage'
import { useKeyboardShortcutsContext } from '~/providers/KeyboardShortcutsProvider'
import { useShortcutController } from '~/providers/ShortcutController'
import { useTheme } from '~/providers/ThemeProvider'
import { useDataExplorerStore } from '~/store'
import { useConsoleStore } from '~/store/console'
import {
  COLOR_PRESETS,
  type ColorPreset,
  formatShortcut,
  useCurrentProfileId,
  useProfiles,
  useSettingsStore,
  useShortcuts,
} from '~/store/settings'
import { RELEASE_NOTES_STATIC_ID, useActiveDataclassTab, useTabsStore } from '~/store/tabs'
import { AiTasksFooterControl } from './AiActions/AiTasksFooterControl'
import { AppBrandIcon } from './AppBrandIcon'
import { AppearanceControls } from './AppearanceControls'
import { AssistantSparklesIcon } from './AssistantSparklesIcon'
import { BottomDockPanel } from './BottomDockPanel'
import { CommandPalette } from './CommandPalette'
import { DatabaseIdentityHeaderChip } from './DatabaseIdentityPanel'
import { DesktopSslWarningFooterControl } from './DesktopSslWarningFooterControl'
import { DesktopUpdateFooterControl } from './DesktopUpdateFooterControl'
import { EnvSwitcher } from './Environments/EnvSwitcher'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { MobileAppFooter } from './MobileAppFooter'
import { useMobileCatalog } from './MobileCatalogContext'
import { OnlineStatusFooterControl } from './OnlineStatusFooterControl'
import { OpenInNewTabHint } from './OpenInNewTabHint'
import { ResizableVerticalHandle } from './ResizablePanel'
import { ViewportWarningFooterControl } from './ViewportWarningFooterControl'

export function Layout({
  children,
  onDisconnect,
  onSwitchConnection,
  onEditConnection,
}: {
  children: ReactNode
  onDisconnect?: () => void
  onSwitchConnection?: () => void
  onEditConnection?: () => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { catalogOpen, toggleCatalog } = useMobileCatalog()
  const { toggleTheme } = useTheme()
  const { showShortcuts, isShortcutsModalOpen, hideShortcuts } = useKeyboardShortcutsContext()
  const { registerShortcutHandler, chordBuffer, formatKeyCombo } = useShortcutController()
  const readonlyMode = useSettingsStore((state) => state.readonlyMode)
  const toggleReadonlyMode = useSettingsStore((state) => state.toggleReadonlyMode)
  const confirmDisconnect = useSettingsStore((state) => state.confirmDisconnect)
  const setConfirmDisconnect = useSettingsStore((state) => state.setConfirmDisconnect)
  const profiles = useProfiles()
  const currentProfileId = useCurrentProfileId()
  const switchProfile = useSettingsStore((state) => state.switchProfile)

  // Tab actions
  const tabs = useTabsStore((state) => state.tabs)
  const openSettingsTab = useTabsStore((state) => state.openSettingsTab)
  const openHomeTab = useTabsStore((state) => state.openHomeTab)
  const openGraphTab = useTabsStore((state) => state.openGraphTab)
  const openStaticTab = useTabsStore((state) => state.openStaticTab)
  const openSchemaBuilderTab = useTabsStore((state) => state.openSchemaBuilderTab)
  const openAssistantMetadataTab = useTabsStore((state) => state.openAssistantMetadataTab)
  const openMethodExecutorTab = useTabsStore((state) => state.openMethodExecutorTab)
  const openHttpClientTab = useTabsStore((state) => state.openHttpClientTab)
  const openRestExportBuilderTab = useTabsStore((state) => state.openRestExportBuilderTab)
  const closeTab = useTabsStore((state) => state.closeTab)
  const togglePinTab = useTabsStore((state) => state.togglePinTab)
  const setActiveTab = useTabsStore((state) => state.setActiveTab)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const activeDataclassTab = useActiveDataclassTab()
  const setViewMode = useTabsStore((s) => s.setViewMode)

  // Get shortcuts from settings (for display in UI)
  const shortcuts = useShortcuts()
  const getShortcut = useCallback((id: string) => shortcuts.find((s) => s.id === id), [shortcuts])

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const headerSearchBarRef = useRef<HTMLDivElement>(null)
  const [startInGoToMode, setStartInGoToMode] = useState(false)
  const [startInGoToPageMode, setStartInGoToPageMode] = useState(false)
  const [startInDataclassSelectMode, setStartInDataclassSelectMode] = useState(false)
  const [startInDataclassDataMode, setStartInDataclassDataMode] = useState(false)
  const [startInSwitchTabsMode, setStartInSwitchTabsMode] = useState(false)
  const assistantOpen = useSettingsStore((s) => s.assistantOpen)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const setAssistantOpen = useSettingsStore((s) => s.setAssistantOpen)
  const toggleAssistantOpen = useSettingsStore((s) => s.toggleAssistantOpen)
  const cloudLlmOffline = useCloudLlmOffline()
  const assistantToggleDisabled = cloudLlmOffline && !assistantOpen
  const consoleOpen = useSettingsStore((s) => s.consoleOpen)
  const bottomPanelTab = useSettingsStore((s) => s.bottomPanelTab)
  const toggleConsoleOpen = useSettingsStore((s) => s.toggleConsoleOpen)
  const toggleTerminalOpen = useSettingsStore((s) => s.toggleTerminalOpen)
  const consoleErrorCount = useConsoleStore(
    (state) => state.entries.filter((entry) => entry.level === 'error').length
  )
  const consoleWarnCount = useConsoleStore(
    (state) => state.entries.filter((entry) => entry.level === 'warn').length
  )
  const [consoleHeight, setConsoleHeight] = useState(() => getConsoleHeight())

  // Disconnect confirmation
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false)
  const [skipDisconnectConfirm, setSkipDisconnectConfirm] = useState(false)

  useEffect(() => {
    if (currentProfileId) setConsoleHeight(getConsoleHeight())
  }, [currentProfileId])

  useEffect(() => {
    saveConsoleHeight(consoleHeight)
  }, [consoleHeight])

  // Chat assistant is desktop-only; keep state closed in the mobile shell.
  useEffect(() => {
    if (isMobileShell() && assistantOpen) setAssistantOpen(false)
  }, [assistantOpen, setAssistantOpen])

  // Listen for go-to-entity / go-to-page with no payload to open the palette in that mode
  useEffect(() => {
    const entitySub = eventBus.on('go-to-entity', (payload) => {
      if (!payload) {
        setStartInGoToMode(true)
        setStartInGoToPageMode(false)
        setCommandPaletteOpen(true)
      }
    })
    const pageSub = eventBus.on('go-to-page', (payload) => {
      if (!payload) {
        setStartInGoToPageMode(true)
        setStartInGoToMode(false)
        setCommandPaletteOpen(true)
      }
    })
    return () => {
      entitySub.unsubscribe()
      pageSub.unsubscribe()
    }
  }, [])

  // Listen for open-command-palette event (e.g. from WelcomeScreen quick actions)
  useEffect(() => {
    const sub = eventBus.on('open-command-palette', (payload) => {
      const mode = payload?.mode as CommandPaletteMode | undefined
      setStartInGoToMode(mode === 'go-to')
      setStartInGoToPageMode(mode === 'go-to-page')
      setStartInDataclassSelectMode(mode === 'dataclass-select')
      setStartInDataclassDataMode(mode === 'dataclass-data')
      setStartInSwitchTabsMode(mode === 'switch-tabs')
      setCommandPaletteOpen(true)
    })
    return () => sub.unsubscribe()
  }, [])

  useEffect(() => {
    const sub = eventBus.on('show-keyboard-shortcuts', () => {
      showShortcuts()
    })
    return () => sub.unsubscribe()
  }, [showShortcuts])

  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (
        state.assistantDisabledNamespaces !== prev.assistantDisabledNamespaces ||
        state.assistantDisabledTools !== prev.assistantDisabledTools
      ) {
        syncAssistantToolPrefs(dataExplorerToolRegistry)
      }
      if (state.disabledWidgetTypes !== prev.disabledWidgetTypes) {
        refreshWidgetTools(dataExplorerToolRegistry)
      }
    })
    return unsub
  }, [])

  // Sidebar toggle
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed)

  // Register shortcut handlers with ShortcutController (supports single keys and chords)
  useEffect(() => {
    const unreg = [
      registerShortcutHandler('command-palette', () => setCommandPaletteOpen(true)),
      registerShortcutHandler('open-dataclass-select', () => {
        setStartInDataclassSelectMode(true)
        setCommandPaletteOpen(true)
      }),
      registerShortcutHandler('open-dataclass-data', () => {
        setStartInDataclassDataMode(true)
        setCommandPaletteOpen(true)
      }),
      registerShortcutHandler('switch-tabs', () => {
        setStartInSwitchTabsMode(true)
        setCommandPaletteOpen(true)
      }),
      registerShortcutHandler('search-dataclasses', () => {
        const searchInput = document.querySelector<HTMLInputElement>('[data-sidebar-search]')
        searchInput?.focus()
      }),
      registerShortcutHandler('toggle-sidebar', toggleSidebarCollapsed),
      registerShortcutHandler('toggle-console', toggleConsoleOpen),
      registerShortcutHandler('toggle-terminal', toggleTerminalOpen),
      registerShortcutHandler('toggle-theme', toggleTheme),
      registerShortcutHandler('open-settings', () => openSettingsTab()),
      registerShortcutHandler('toggle-readonly', toggleReadonlyMode),
      registerShortcutHandler('open-home', openHomeTab),
      ...(isMobileShell()
        ? []
        : [
            registerShortcutHandler('toggle-assistant', () => {
              if (useSettingsStore.getState().assistantOpen) {
                setAssistantOpen(false)
                return
              }
              if (isCloudLlmOffline()) return
              toggleAssistantOpen()
            }),
            registerShortcutHandler('open-structure', () => {
              const dataclassToHighlight = activeDataclassTab?.dataclassName
              openGraphTab().then(() => {
                if (dataclassToHighlight) {
                  eventBus.emit('highlight-dataclass-in-graph', dataclassToHighlight)
                }
              })
            }),
          ]),
      registerShortcutHandler('open-assistant-metadata', openAssistantMetadataTab),
      registerShortcutHandler('tab-next', () => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
          const nextIndex = (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex].id)
        }
      }),
      registerShortcutHandler('tab-prev', () => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
          setActiveTab(tabs[prevIndex].id)
        }
      }),
      ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) =>
        registerShortcutHandler(`tab-${n}`, () => {
          if (tabs.length >= n) setActiveTab(tabs[n - 1].id)
        })
      ),
      registerShortcutHandler('close-tab', () => activeTabId && closeTab(activeTabId)),
      registerShortcutHandler('pin-tab', () => activeTabId && togglePinTab(activeTabId)),
      registerShortcutHandler('view-cards', () =>
        activeDataclassTab ? setViewMode(activeDataclassTab.id, 'cards') : undefined
      ),
      registerShortcutHandler('view-table', () =>
        activeDataclassTab ? setViewMode(activeDataclassTab.id, 'table') : undefined
      ),
    ]
    return () =>
      unreg.forEach((u) => {
        u()
      })
  }, [
    registerShortcutHandler,
    toggleSidebarCollapsed,
    toggleConsoleOpen,
    toggleTerminalOpen,
    toggleTheme,
    openSettingsTab,
    toggleReadonlyMode,
    toggleAssistantOpen,
    setAssistantOpen,
    openHomeTab,
    openGraphTab,
    openAssistantMetadataTab,
    closeTab,
    togglePinTab,
    setActiveTab,
    tabs,
    activeTabId,
    activeDataclassTab,
    setViewMode,
  ])

  const handleShowHelp = useCallback(() => {
    showShortcuts()
  }, [showShortcuts])

  return (
    <div className={cn('flex flex-col bg-background', mobile ? 'h-full' : 'h-screen')}>
      {/* Header */}
      <header
        className={cn(
          'relative z-50 border-border/60 border-b bg-background px-3',
          mobile
            ? 'flex min-h-11 items-center justify-between gap-2 pt-[max(0.5rem,var(--app-safe-top))] pb-1.5'
            : 'grid h-10 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3'
        )}
      >
        {/* Left side - Logo (+ expand when sidebar is collapsed on desktop) */}
        <div
          className={cn(
            'flex min-w-0 items-center',
            mobile ? 'gap-1.5' : 'gap-2 justify-self-start'
          )}
        >
          {mobile ? (
            <Button
              variant={catalogOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={toggleCatalog}
              aria-label={t('mobile.openCatalog')}
              aria-pressed={catalogOpen}
            >
              <List className="h-4 w-4" />
            </Button>
          ) : sidebarCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={toggleSidebarCollapsed}
                    aria-label={t('layout.expandSidebar')}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('layout.expandSidebar')}
                  {(() => {
                    const sc = getShortcut('toggle-sidebar')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1.5 font-mono text-xs">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          <div className={cn('shrink-0 shadow-xs', mobile ? 'h-8 w-8' : 'h-7 w-7')}>
            <AppBrandIcon className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-semibold text-sm leading-tight tracking-tight">
                {t('app.title')}
              </h1>
              {mobile ? (
                <span className="shrink-0 rounded-sm bg-amber-500/15 px-1 py-px font-medium text-[9px] text-amber-700 uppercase tracking-wide dark:text-amber-400">
                  {t('mobile.betaBadge')}
                </span>
              ) : null}
            </div>
            {!mobile ? (
              <p className="text-muted-foreground text-xs leading-tight">{t('app.subtitle')}</p>
            ) : null}
          </div>
        </div>

        {/* Center - Global search (desktop field only; mobile lives in the right cluster) */}
        {!mobile ? (
          <div
            ref={headerSearchBarRef}
            className="flex h-8 w-[min(42rem,calc(100vw-28rem))] min-w-56 items-center gap-2 justify-self-center rounded-sm border bg-muted/50 px-2.5 transition-colors focus-within:bg-background focus-within:ring-1 focus-within:ring-ring hover:bg-muted/70"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              readOnly
              placeholder={t('layout.searchPlaceholder')}
              className="h-full flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onClick={() => setCommandPaletteOpen(true)}
              onFocus={() => setCommandPaletteOpen(true)}
              aria-label={t('layout.openCommandPaletteAria')}
            />
            {(() => {
              const sc = getShortcut('command-palette')
              return sc?.enabled ? (
                <kbd className="hidden shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-xs sm:inline">
                  {formatShortcut(sc)}
                </kbd>
              ) : null
            })()}
          </div>
        ) : null}

        {/* Right side - actions */}
        <div
          className={cn(
            'flex shrink-0 items-center',
            mobile
              ? 'gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5'
              : 'gap-1.5 justify-self-end'
          )}
        >
          {mobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label={t('layout.openCommandPaletteAria')}
            >
              <Search className="h-4 w-4" />
            </Button>
          ) : (
            <DatabaseIdentityHeaderChip />
          )}
          {isDesktop() && onDisconnect && (
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={mobile ? 'ghost' : 'outline'}
                        size="icon"
                        className={mobile ? 'h-9 w-9' : 'h-7 w-7'}
                        aria-label={t('layout.connectionMenuAria')}
                      >
                        <Plug className={mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t('layout.connectionMenu')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent
                align="end"
                side={mobile ? 'bottom' : undefined}
                className={cn(mobile ? mobileMenuContentClass() : 'w-52')}
                {...(mobile ? mobileMenuCollisionProps : { collisionPadding: 12 })}
              >
                <DropdownMenuLabel className={mobile ? 'px-3 py-2.5 text-sm' : undefined}>
                  {t('layout.connectionMenu')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={mobile ? mobileMenuItemClass() : undefined}
                  onClick={onSwitchConnection ?? onDisconnect}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {t('layout.switchConnection')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mobile ? mobileMenuItemClass() : undefined}
                  onClick={onEditConnection}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('layout.editConnection')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={mobile ? mobileMenuItemClass() : undefined}
                  onClick={() => {
                    if (mobile) {
                      void useDataExplorerStore.getState().refreshApp()
                      return
                    }
                    window.location.reload()
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('layout.refreshInterface')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (confirmDisconnect) {
                      setSkipDisconnectConfirm(false)
                      setDisconnectConfirmOpen(true)
                      return
                    }
                    onDisconnect?.()
                  }}
                  className={cn(
                    'text-destructive focus:text-destructive',
                    mobile && mobileMenuItemClass()
                  )}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('layout.disconnect')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={readonlyMode ? 'default' : mobile ? 'ghost' : 'outline'}
                  size={mobile ? 'icon' : 'sm'}
                  className={cn(
                    mobile ? 'h-9 w-9' : 'h-7 gap-1.5 px-2 text-xs',
                    readonlyMode && 'bg-amber-500 text-white hover:bg-amber-600'
                  )}
                  onClick={toggleReadonlyMode}
                  aria-label={readonlyMode ? t('layout.readOnly') : t('layout.editMode')}
                >
                  {readonlyMode ? (
                    <Eye className={mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                  ) : (
                    <Pencil className={mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                  )}
                  {!mobile ? (
                    readonlyMode ? (
                      <span>{t('layout.readOnly')}</span>
                    ) : (
                      <span>{t('layout.editMode')}</span>
                    )
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {readonlyMode ? t('layout.enableEditingTooltip') : t('layout.readOnlyTooltip')}
                {(() => {
                  const sc = getShortcut('toggle-readonly')
                  return sc?.enabled ? (
                    <kbd className="ml-2 rounded bg-muted px-1.5 text-xs">{formatShortcut(sc)}</kbd>
                  ) : null
                })()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main content + docked console */}
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        {mobile && consoleOpen ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <BottomDockPanel />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            {consoleOpen ? (
              <>
                <ResizableVerticalHandle
                  onResize={(delta) =>
                    setConsoleHeight((height) =>
                      Math.min(window.innerHeight * 0.5, Math.max(120, height - delta))
                    )
                  }
                  onDoubleClick={() => setConsoleHeight(220)}
                />
                <div
                  className="shrink-0 overflow-hidden border-t"
                  style={{ height: consoleHeight }}
                >
                  <BottomDockPanel />
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Status bar */}
      {mobile ? (
        <MobileAppFooter />
      ) : (
        <footer className="relative z-20 grid h-8 w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center border-border/60 border-t bg-muted/30 px-2 text-muted-foreground">
          {/* Left: console + warnings */}
          <div className="flex min-w-0 items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={consoleOpen && bottomPanelTab === 'console' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="relative h-6 gap-1.5 px-2 text-[11px]"
                    onClick={toggleConsoleOpen}
                    aria-label={
                      consoleOpen && bottomPanelTab === 'console'
                        ? t('console.close')
                        : t('console.open')
                    }
                    aria-pressed={consoleOpen && bottomPanelTab === 'console'}
                  >
                    <PanelBottom className="h-3 w-3" />
                    <span>{t('console.title')}</span>
                    {consoleErrorCount > 0 ? (
                      <span className="text-destructive">{consoleErrorCount}</span>
                    ) : null}
                    {consoleWarnCount > 0 ? (
                      <span className="text-amber-600">{consoleWarnCount}</span>
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {consoleOpen && bottomPanelTab === 'console'
                    ? t('console.close')
                    : t('console.open')}
                  {(() => {
                    const sc = getShortcut('toggle-console')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={consoleOpen && bottomPanelTab === 'terminal' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="relative h-6 gap-1.5 px-2 text-[11px]"
                    onClick={toggleTerminalOpen}
                    aria-label={
                      consoleOpen && bottomPanelTab === 'terminal'
                        ? t('terminal.close')
                        : t('terminal.open')
                    }
                    aria-pressed={consoleOpen && bottomPanelTab === 'terminal'}
                  >
                    <Terminal className="h-3 w-3" />
                    <span>{t('terminal.title')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {consoleOpen && bottomPanelTab === 'terminal'
                    ? t('terminal.close')
                    : t('terminal.open')}
                  {(() => {
                    const sc = getShortcut('toggle-terminal')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <EnvSwitcher side="top" align="start" size="sm" />

            <AiTasksFooterControl />
            <OnlineStatusFooterControl />
            <ViewportWarningFooterControl />
            <DesktopSslWarningFooterControl />
            <DesktopUpdateFooterControl />

            <output
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px]',
                chordBuffer ? 'text-muted-foreground' : 'text-muted-foreground/50'
              )}
              aria-live="polite"
            >
              {chordBuffer ? (
                <>
                  <kbd className="shrink-0 rounded bg-muted px-1 py-0.5">
                    {formatKeyCombo(chordBuffer)}
                  </kbd>
                  <span className="truncate">{t('layout.waitingForSecondKey')}</span>
                  <span className="shrink-0 text-muted-foreground/70">
                    {t('layout.escToCancel')}
                  </span>
                </>
              ) : null}
            </output>
          </div>

          {/* Center: version link to release notes */}
          <div className="flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => openStaticTab(RELEASE_NOTES_STATIC_ID)}
                    aria-label={t('layout.releaseNotesAria')}
                  >
                    v{__APP_VERSION__}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t('layout.releaseNotes')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Right: small icon buttons */}
          <div className="flex shrink-0 justify-end gap-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant={assistantOpen ? 'default' : 'ghost'}
                      size="icon"
                      className={cn(
                        'h-6 w-6',
                        assistantOpen &&
                          'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      )}
                      disabled={assistantToggleDisabled}
                      onClick={() => {
                        if (assistantOpen) {
                          setAssistantOpen(false)
                          return
                        }
                        if (cloudLlmOffline) return
                        setAssistantOpen(true)
                      }}
                      aria-label={
                        assistantToggleDisabled
                          ? t('assistant.requiresInternet')
                          : assistantOpen
                            ? t('layout.closeAssistant')
                            : t('layout.openAssistant')
                      }
                      aria-pressed={assistantOpen}
                      aria-busy={assistantLoading}
                    >
                      {assistantLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <AssistantSparklesIcon className="h-3 w-3" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {assistantToggleDisabled
                    ? t('assistant.requiresInternet')
                    : assistantOpen
                      ? t('layout.closeAssistant')
                      : t('layout.openAssistant')}
                  {(() => {
                    const sc = getShortcut('toggle-assistant')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setCommandPaletteOpen(true)}
                    aria-label={t('layout.openCommandPaletteAria')}
                  >
                    <Command className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t('layout.commandPalette')}
                  {(() => {
                    const sc = getShortcut('command-palette')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={showShortcuts}
                    aria-label={t('layout.keyboardShortcutsAria')}
                  >
                    <Keyboard className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t('layout.keyboardShortcuts')}
                  {(() => {
                    const sc = getShortcut('show-shortcuts')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      const dataclassToHighlight = activeDataclassTab?.dataclassName
                      openGraphTab().then(() => {
                        if (dataclassToHighlight) {
                          eventBus.emit('highlight-dataclass-in-graph', dataclassToHighlight)
                        }
                      })
                    }}
                    aria-label={t('tabs.structure')}
                  >
                    <Network className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t('tabs.structure')}
                  {(() => {
                    const sc = getShortcut('open-structure')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label={t('layout.toolsAria')}
                      >
                        <Wrench className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t('layout.tools')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end" side="top" className="w-48" collisionPadding={12}>
                <DropdownMenuItem
                  onClick={(event) => openSchemaBuilderTab({ forceNew: isModClick(event) })}
                >
                  <Braces className="mr-2 h-4 w-4" />
                  {t('tabs.schemaBuilder')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(event) => openAssistantMetadataTab({ forceNew: isModClick(event) })}
                >
                  <BookText className="mr-2 h-4 w-4" />
                  {t('tabs.assistantMetadata')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(event) =>
                    openMethodExecutorTab(undefined, { forceNew: isModClick(event) })
                  }
                >
                  <Play className="mr-2 h-4 w-4" />
                  {t('tabs.methodExecutor')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(event) => openHttpClientTab(undefined, { forceNew: isModClick(event) })}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {t('tabs.httpClient')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(event) => openRestExportBuilderTab({ forceNew: isModClick(event) })}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  {t('tabs.restExport')}
                </DropdownMenuItem>
                <OpenInNewTabHint className="px-2 py-1.5" />
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn(profiles.length <= 1 && 'inline-flex')}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={t('layout.switchProfileAria')}
                          disabled={profiles.length <= 1}
                        >
                          {(() => {
                            const current = profiles.find((p) => p.id === currentProfileId)
                            if (!current) return <UserCircle className="h-3 w-3" />
                            const iconName = current.icon || 'UserCircle'
                            const Icon = resolveLucideIcon(iconName) ?? UserCircle
                            const colorPreset =
                              current.color && current.color in COLOR_PRESETS
                                ? COLOR_PRESETS[current.color as ColorPreset]
                                : null
                            const bgClass = colorPreset?.bg ?? 'bg-primary'
                            return (
                              <div
                                className={cn(
                                  'flex h-5 w-5 items-center justify-center rounded-full',
                                  bgClass
                                )}
                              >
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                            )
                          })()}
                        </Button>
                      </DropdownMenuTrigger>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {profiles.length <= 1 ? t('layout.onlyOneProfile') : t('layout.switchProfile')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end" side="top" className="w-48" collisionPadding={12}>
                <div className="px-2 py-1.5">
                  <p className="font-medium text-sm">{t('settings.profiles')}</p>
                </div>
                <DropdownMenuSeparator />
                {profiles.map((p) => {
                  const iconName = p.icon || 'UserCircle'
                  const Icon = resolveLucideIcon(iconName) ?? UserCircle
                  const colorPreset =
                    p.color && p.color in COLOR_PRESETS
                      ? COLOR_PRESETS[p.color as ColorPreset]
                      : null
                  const bgClass = colorPreset?.bg ?? 'bg-primary'
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => p.id !== currentProfileId && switchProfile(p.id)}
                      className={cn(
                        'flex items-center gap-2',
                        p.id === currentProfileId && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          bgClass
                        )}
                      >
                        <Icon className="h-3 w-3 text-white" />
                      </div>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {p.id === currentProfileId && <span className="shrink-0 text-xs">✓</span>}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openSettingsTab()}
                    aria-label={t('layout.settingsAria')}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t('layout.settings')}
                  {(() => {
                    const sc = getShortcut('open-settings')
                    return sc?.enabled ? (
                      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">
                        {formatShortcut(sc)}
                      </kbd>
                    ) : null
                  })()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <AppearanceControls side="top" align="end" size="sm" />
          </div>
        </footer>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal open={isShortcutsModalOpen} onOpenChange={hideShortcuts} />

      {/* Disconnect confirmation */}
      <Dialog
        open={disconnectConfirmOpen}
        onOpenChange={(open) => {
          setDisconnectConfirmOpen(open)
          if (!open) setSkipDisconnectConfirm(false)
        }}
      >
        <DialogContent
          className={cn('gap-4 sm:max-w-sm', mobile && mobileCenteredDialogClass('gap-5'))}
        >
          <DialogHeader className={cn(mobile && 'gap-2 space-y-0 text-left')}>
            <DialogTitle className={cn(mobile && 'text-lg leading-snug')}>
              {t('layout.disconnectConfirmTitle')}
            </DialogTitle>
            <DialogDescription className={cn(mobile && 'text-sm leading-relaxed')}>
              {t('layout.disconnectConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="skip-disconnect-confirm"
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-lg',
              mobile &&
                'min-h-11 items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5'
            )}
          >
            <Checkbox
              id="skip-disconnect-confirm"
              checked={skipDisconnectConfirm}
              onCheckedChange={(checked) => setSkipDisconnectConfirm(checked === true)}
              className={cn(mobile && 'mt-0 size-5')}
            />
            <span
              className={cn(
                'font-normal text-sm leading-snug',
                mobile && 'text-[15px] leading-snug'
              )}
            >
              {t('layout.disconnectSkipConfirm')}
            </span>
          </label>
          <DialogFooter className={cn(mobile && 'flex-col-reverse gap-2 sm:flex-col-reverse')}>
            <Button
              type="button"
              variant="outline"
              className={cn(mobile && 'h-12 w-full text-base')}
              onClick={() => setDisconnectConfirmOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={cn(mobile && 'h-12 w-full text-base')}
              onClick={() => {
                if (skipDisconnectConfirm) {
                  setConfirmDisconnect(false)
                }
                setDisconnectConfirmOpen(false)
                onDisconnect?.()
              }}
            >
              <LogOut className={cn('mr-2', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
              {t('layout.disconnect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Command Palette (anchored below header search bar when open) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={(open) => {
          setCommandPaletteOpen(open)
          if (!open) {
            setStartInGoToMode(false)
            setStartInGoToPageMode(false)
            setStartInDataclassSelectMode(false)
            setStartInDataclassDataMode(false)
            setStartInSwitchTabsMode(false)
          }
        }}
        onShowHelp={handleShowHelp}
        anchorRef={headerSearchBarRef}
        startInGoToMode={startInGoToMode}
        startInGoToPageMode={startInGoToPageMode}
        startInDataclassSelectMode={startInDataclassSelectMode}
        startInDataclassDataMode={startInDataclassDataMode}
        startInSwitchTabsMode={startInSwitchTabsMode}
      />

      {!mobile ? (
        <AssistantChatbot
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          onLoadingChange={setAssistantLoading}
        />
      ) : null}
    </div>
  )
}
