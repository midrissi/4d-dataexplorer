import { Button, cn, Dialog, DialogContent, DialogTitle } from '@4d/ui'
import { Clock, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getIntlLocale, useTranslation } from '~/i18n'
import { createCommandContext } from '~/lib/command-context'
import {
  buildCommands,
  type Command,
  filterCommands,
  getCommandById,
  getEnabledCommands,
  groupCommandsByCategory,
} from '~/lib/commands'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import { getRecentCommands, type RecentCommand, saveRecentCommand } from '~/lib/storage'
import { useDataExplorerStore } from '~/store'
import { useDataclassCustomizations, usePageSize } from '~/store/settings'
import { type Tab, useTabsStore } from '~/store/tabs'
import { CommandsModeContent, CommandsModeFooter, CommandsModeHeader } from './CommandsMode'
import {
  DataclassPickerModeContent,
  DataclassPickerModeFooter,
  DataclassPickerModeHeader,
} from './DataclassPickerMode'
import { GoToModeContent, GoToModeFooter, GoToModeHeader } from './GoToMode'
import { SwitchTabsModeContent, SwitchTabsModeFooter, SwitchTabsModeHeader } from './SwitchTabsMode'
import type { CommandPaletteProps } from './types'
import { getTabDisplayName } from './utils'

export type { CommandPaletteProps } from './types'

export function CommandPalette({
  open,
  onOpenChange,
  onShowHelp,
  anchorRef,
  startInGoToMode = false,
  startInGoToPageMode = false,
  startInDataclassSelectMode = false,
  startInDataclassDataMode = false,
  startInSwitchTabsMode = false,
}: CommandPaletteProps) {
  const mobile = isMobileShell()
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [anchorPosition, setAnchorPosition] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>(() => getRecentCommands())
  const [goToEntityMode, setGoToEntityMode] = useState(false)
  const [goToPageMode, setGoToPageMode] = useState(false)
  const [goToValue, setGoToValue] = useState('')
  const [dataclassSelectMode, setDataclassSelectMode] = useState(false)
  const [dataclassDataMode, setDataclassDataMode] = useState(false)
  const [dataclassSearch, setDataclassSearch] = useState('')
  const [switchTabsMode, setSwitchTabsMode] = useState(false)
  const [switchTabsSelectedIndex, setSwitchTabsSelectedIndex] = useState(0)
  const [switchTabsSearch, setSwitchTabsSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const goToInputRef = useRef<HTMLInputElement>(null)
  const dataclassInputRef = useRef<HTMLInputElement>(null)
  const switchTabsInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const switchTabsGridRef = useRef<HTMLDivElement>(null)

  const goToMode = goToEntityMode || goToPageMode
  const goToVariant = goToPageMode ? 'page' : 'entity'

  const { dataclasses, selectedDataclass, pagination } = useDataExplorerStore()
  const pageSize = usePageSize()
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, openGraphTab } = useTabsStore()
  const dataclassCustomizations = useDataclassCustomizations()
  const { t, language } = useTranslation()

  const filteredTabs = useMemo(() => {
    const q = switchTabsSearch.trim().toLowerCase()
    if (!q) return tabs
    return tabs.filter((tab) => getTabDisplayName(tab, t).toLowerCase().includes(q))
  }, [tabs, switchTabsSearch, t])

  const commands = useMemo<Command[]>(() => {
    return buildCommands(
      createCommandContext({
        onClose: () => onOpenChange(false),
        onShowHelp,
        onEnterSwitchTabsMode: () => setSwitchTabsMode(true),
      })
    )
  }, [onOpenChange, onShowHelp])

  const filteredCommands = useMemo(() => {
    const enabledCommands = getEnabledCommands(commands)
    if (!search.trim()) {
      const recentCmds: Command[] = []
      for (const recent of recentCommands) {
        const cmd = getCommandById(enabledCommands, recent.id)
        if (cmd) {
          recentCmds.push({
            ...cmd,
            category: 'Recent',
            icon: <Clock className="h-4 w-4" />,
            usedAt: recent.usedAt,
          })
        }
      }
      return [...recentCmds, ...enabledCommands]
    }
    return filterCommands(enabledCommands, search, t)
  }, [commands, search, recentCommands, t])

  const groupedCommands = useMemo(
    () => groupCommandsByCategory(filteredCommands),
    [filteredCommands]
  )

  const filteredDataclasses = useMemo(() => {
    if (!dataclassSearch.trim()) return dataclasses
    const lower = dataclassSearch.toLowerCase()
    return dataclasses.filter((dc) => dc.name.toLowerCase().includes(lower))
  }, [dataclasses, dataclassSearch])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setSelectedIndex(0)
  }, [])

  useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedIndex(0)
      setGoToValue('')
      setDataclassSearch('')
      setDataclassSelectMode(false)
      setDataclassDataMode(false)
      setGoToEntityMode(false)
      setGoToPageMode(false)
      setSwitchTabsMode(false)
      setSwitchTabsSelectedIndex(0)
      setSwitchTabsSearch('')
      if (startInSwitchTabsMode && tabs.length > 0) {
        setSwitchTabsMode(true)
        const currentTabIndex = tabs.findIndex((t) => t.id === activeTabId)
        setSwitchTabsSelectedIndex(currentTabIndex >= 0 ? currentTabIndex : 0)
        setTimeout(() => switchTabsInputRef.current?.focus(), 0)
      } else if (startInDataclassDataMode) {
        setDataclassDataMode(true)
        setTimeout(() => dataclassInputRef.current?.focus(), 0)
      } else if (startInDataclassSelectMode) {
        setDataclassSelectMode(true)
        setTimeout(() => dataclassInputRef.current?.focus(), 0)
      } else if (startInGoToPageMode && selectedDataclass) {
        setGoToPageMode(true)
        setTimeout(() => goToInputRef.current?.focus(), 0)
      } else if (startInGoToMode && selectedDataclass) {
        setGoToEntityMode(true)
        setTimeout(() => goToInputRef.current?.focus(), 0)
      } else {
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
  }, [
    open,
    startInGoToMode,
    startInGoToPageMode,
    startInDataclassSelectMode,
    startInDataclassDataMode,
    startInSwitchTabsMode,
    selectedDataclass,
    tabs.length,
    activeTabId,
    tabs.findIndex,
  ])

  // Measure anchor element when open and anchorRef is provided (for header search bar)
  useLayoutEffect(() => {
    if (open && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setAnchorPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    } else {
      setAnchorPosition(null)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (search === ':' && selectedDataclass) {
      setGoToPageMode(true)
      setGoToEntityMode(false)
      setSearch('')
      setTimeout(() => goToInputRef.current?.focus(), 0)
    }
  }, [search, selectedDataclass])
  useEffect(() => {
    if (search === '#' && selectedDataclass) {
      setGoToEntityMode(true)
      setGoToPageMode(false)
      setSearch('')
      setTimeout(() => goToInputRef.current?.focus(), 0)
    }
  }, [search, selectedDataclass])
  useEffect(() => {
    if (search === '>') {
      setDataclassSelectMode(true)
      setSearch('')
      setTimeout(() => dataclassInputRef.current?.focus(), 0)
    }
  }, [search])
  useEffect(() => {
    if (search === '/') {
      setDataclassDataMode(true)
      setSearch('')
      setTimeout(() => dataclassInputRef.current?.focus(), 0)
    }
  }, [search])
  useEffect(() => {
    if (search === '@' && tabs.length > 0) {
      setSwitchTabsMode(true)
      setSearch('')
      const currentTabIndex = tabs.findIndex((t) => t.id === activeTabId)
      setSwitchTabsSelectedIndex(currentTabIndex >= 0 ? currentTabIndex : 0)
      setSwitchTabsSearch('')
      setTimeout(() => switchTabsInputRef.current?.focus(), 0)
    }
  }, [search, tabs.length, activeTabId, tabs.findIndex])
  useEffect(() => {
    if (switchTabsMode) setTimeout(() => switchTabsInputRef.current?.focus(), 0)
  }, [switchTabsMode])
  useEffect(() => {
    if (dataclassSelectMode || dataclassDataMode)
      setTimeout(() => dataclassInputRef.current?.focus(), 0)
  }, [dataclassSelectMode, dataclassDataMode])
  useEffect(() => {
    if (goToMode) setTimeout(() => goToInputRef.current?.focus(), 0)
  }, [goToMode])

  const handleGoToEntity = useCallback(() => {
    const index = Number.parseInt(goToValue, 10)
    if (Number.isNaN(index) || index < 1) return
    const page = Math.ceil(index / pageSize)
    const positionInPage = (index - 1) % pageSize
    eventBus.emit('go-to-entity', { index, page, positionInPage })
    onOpenChange(false)
  }, [goToValue, pageSize, onOpenChange])

  const handleGoToPage = useCallback(() => {
    const page = Number.parseInt(goToValue, 10)
    if (Number.isNaN(page) || page < 1) return
    if (pagination && page > pagination.totalPages) return
    eventBus.emit('go-to-page', { page })
    onOpenChange(false)
  }, [goToValue, pagination, onOpenChange])

  const handleGoTo = useCallback(() => {
    if (goToPageMode) handleGoToPage()
    else handleGoToEntity()
  }, [goToPageMode, handleGoToPage, handleGoToEntity])

  const handleSelectDataclass = useCallback(
    (dataclassName: string) => {
      openGraphTab().then(() => eventBus.emit('highlight-dataclass-in-graph', dataclassName))
      onOpenChange(false)
    },
    [openGraphTab, onOpenChange]
  )

  const handleOpenDataclassData = useCallback(
    (dataclassName: string) => {
      openTab(dataclassName)
      onOpenChange(false)
    },
    [openTab, onOpenChange]
  )

  const handleSwitchToTab = useCallback(
    (tab: Tab) => {
      // Activating the tab triggers syncActiveTab (App.tsx), which restores the
      // tab's cached slice. Avoid selectDataclass here so it isn't wiped.
      setActiveTab(tab.id)
      onOpenChange(false)
    },
    [setActiveTab, onOpenChange]
  )

  const handleCloseTabInPicker = useCallback(
    (e: React.MouseEvent, tab: Tab) => {
      e.stopPropagation()
      if (tab.isClosable !== false && !tab.isPinned) closeTab(tab.id)
    },
    [closeTab]
  )

  const handleSwitchTabsKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const columns =
        typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 3 : 2
      const maxIndex = filteredTabs.length - 1
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSwitchTabsSelectedIndex((i) => Math.min(i + columns, maxIndex))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSwitchTabsSelectedIndex((i) => Math.max(i - columns, 0))
          break
        case 'ArrowRight':
          e.preventDefault()
          setSwitchTabsSelectedIndex((i) => Math.min(i + 1, maxIndex))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setSwitchTabsSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredTabs[switchTabsSelectedIndex]) {
            handleSwitchToTab(filteredTabs[switchTabsSelectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          if (switchTabsSearch.trim()) {
            setSwitchTabsSearch('')
            const currentTabIndex = tabs.findIndex((t) => t.id === activeTabId)
            setSwitchTabsSelectedIndex(currentTabIndex >= 0 ? currentTabIndex : 0)
          } else {
            setSwitchTabsMode(false)
            setSwitchTabsSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
          break
      }
    },
    [filteredTabs, switchTabsSelectedIndex, switchTabsSearch, handleSwitchToTab, tabs, activeTabId]
  )

  useEffect(() => {
    if (switchTabsMode) {
      window.addEventListener('keydown', handleSwitchTabsKeyDown, true)
      return () => window.removeEventListener('keydown', handleSwitchTabsKeyDown, true)
    }
  }, [switchTabsMode, handleSwitchTabsKeyDown])

  useEffect(() => {
    if (switchTabsMode) {
      if (tabs.length === 0) {
        setSwitchTabsMode(false)
        setTimeout(() => inputRef.current?.focus(), 0)
      } else {
        setSwitchTabsSelectedIndex((i) => Math.min(i, Math.max(0, filteredTabs.length - 1)))
      }
    }
  }, [switchTabsMode, tabs.length, filteredTabs.length])

  useEffect(() => {
    if (switchTabsMode && switchTabsGridRef.current) {
      const el = switchTabsGridRef.current.querySelector(
        `[data-switch-tab-index="${switchTabsSelectedIndex}"]`
      )
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [switchTabsMode, switchTabsSelectedIndex])

  const executeCommand = useCallback((cmd: Command) => {
    saveRecentCommand(cmd.id)
    setRecentCommands(getRecentCommands())
    cmd.action()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) executeCommand(filteredCommands[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          onOpenChange(false)
          break
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onOpenChange]
  )

  const handleGoToKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handleGoTo()
          break
        case 'Escape':
          e.preventDefault()
          setGoToEntityMode(false)
          setGoToPageMode(false)
          setGoToValue('')
          setTimeout(() => inputRef.current?.focus(), 0)
          break
        case 'Backspace':
          if (goToValue === '') {
            e.preventDefault()
            setGoToEntityMode(false)
            setGoToPageMode(false)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
          break
      }
    },
    [handleGoTo, goToValue]
  )

  const handleDataclassPickerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredDataclasses.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredDataclasses[selectedIndex]) {
            if (dataclassDataMode) {
              handleOpenDataclassData(filteredDataclasses[selectedIndex].name)
            } else {
              handleSelectDataclass(filteredDataclasses[selectedIndex].name)
            }
          }
          break
        case 'Escape':
          e.preventDefault()
          setDataclassSelectMode(false)
          setDataclassDataMode(false)
          setDataclassSearch('')
          setTimeout(() => inputRef.current?.focus(), 0)
          break
        case 'Backspace':
          if (dataclassSearch === '') {
            e.preventDefault()
            setDataclassSelectMode(false)
            setDataclassDataMode(false)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
          break
      }
    },
    [
      filteredDataclasses,
      selectedIndex,
      dataclassDataMode,
      handleSelectDataclass,
      handleOpenDataclassData,
      dataclassSearch,
    ]
  )

  useEffect(() => {
    if (dataclassSelectMode || dataclassDataMode) setSelectedIndex(0)
  }, [dataclassSelectMode, dataclassDataMode])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const goToModeProps = {
    variant: goToVariant as 'entity' | 'page',
    goToValue,
    setGoToValue,
    goToInputRef,
    t,
    onGoTo: handleGoTo,
    onKeyDown: handleGoToKeyDown,
    pagination,
    pageSize,
  }

  const dataclassPickerProps = {
    dataclassDataMode,
    dataclassSearch,
    setDataclassSearch,
    dataclassInputRef,
    onKeyDown: handleDataclassPickerKeyDown,
    dataclasses,
    filteredDataclasses,
    selectedIndex,
    setSelectedIndex,
    listRef,
    onSelectDataclass: handleSelectDataclass,
    onOpenDataclassData: handleOpenDataclassData,
    t,
  }

  const switchTabsProps = {
    switchTabsSearch,
    setSwitchTabsSearch,
    switchTabsInputRef,
    filteredTabs,
    switchTabsSelectedIndex,
    setSwitchTabsSelectedIndex,
    switchTabsGridRef,
    activeTabId,
    dataclassCustomizations,
    onSwitchToTab: handleSwitchToTab,
    onCloseTab: handleCloseTabInPicker,
    t,
  }

  const commandsModeProps = {
    search,
    setSearch: handleSearchChange,
    inputRef,
    onKeyDown: handleKeyDown,
    filteredCommands,
    groupedCommands,
    selectedIndex,
    setSelectedIndex,
    listRef,
    onExecuteCommand: executeCommand,
    selectedDataclass,
    t,
    locale: getIntlLocale(language),
  }

  const headerClassNameWhenAnchored = 'h-full min-h-0 w-full'

  const renderPaletteHeader = (className?: string) => (
    <div
      className={cn(mobile && 'flex items-center gap-1 border-border/60 border-b px-2 pt-1 pb-1')}
    >
      <div className={cn('min-w-0', mobile ? 'flex-1' : 'w-full')}>
        {goToMode ? (
          <GoToModeHeader {...goToModeProps} className={className} />
        ) : switchTabsMode ? (
          <SwitchTabsModeHeader {...switchTabsProps} className={className} />
        ) : dataclassSelectMode || dataclassDataMode ? (
          <DataclassPickerModeHeader {...dataclassPickerProps} className={className} />
        ) : (
          <CommandsModeHeader {...commandsModeProps} className={className} />
        )}
      </div>
      {mobile ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </Button>
      ) : null}
    </div>
  )

  const paletteBody = (
    <>
      {goToMode ? (
        <GoToModeContent
          variant={goToVariant}
          goToValue={goToValue}
          pagination={pagination}
          pageSize={pageSize}
          t={t}
        />
      ) : switchTabsMode ? (
        <SwitchTabsModeContent {...switchTabsProps} />
      ) : dataclassSelectMode || dataclassDataMode ? (
        <DataclassPickerModeContent {...dataclassPickerProps} />
      ) : (
        <CommandsModeContent {...commandsModeProps} />
      )}

      {/* Keyboard hints are irrelevant on touch; de-emphasize by hiding entirely. */}
      {!mobile ? (
        <div className="flex shrink-0 items-center justify-between border-border/60 border-t px-2 py-1.5 text-muted-foreground text-xs">
          {goToMode ? (
            <GoToModeFooter variant={goToVariant} t={t} />
          ) : switchTabsMode ? (
            <SwitchTabsModeFooter t={t} />
          ) : dataclassSelectMode || dataclassDataMode ? (
            <DataclassPickerModeFooter dataclassDataMode={dataclassDataMode} t={t} />
          ) : (
            <CommandsModeFooter t={t} />
          )}
        </div>
      ) : null}
    </>
  )

  const paletteContent = (
    <>
      <div className="sr-only" id="command-palette-title">
        {t('commandPalette.title')}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {renderPaletteHeader()}
        {paletteBody}
      </div>
    </>
  )

  const useAnchoredPalette = !mobile && open && anchorRef?.current && anchorPosition !== null

  if (useAnchoredPalette && typeof document !== 'undefined') {
    const pos = anchorPosition
    if (pos === null) return null
    const { top, left, width, height } = pos
    return createPortal(
      <>
        <div
          className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in"
          aria-hidden
          onClick={() => onOpenChange(false)}
        />
        <div
          role="dialog"
          aria-labelledby="command-palette-title"
          aria-modal="true"
          className="command-palette fixed z-50 flex max-h-[70vh] min-w-[var(--anchor-width)] max-w-xl flex-col overflow-hidden rounded-md border bg-background shadow-sm"
          style={{
            top,
            left,
            width: 'max(min(100vw - 2rem, 36rem), var(--anchor-width))',
            ['--anchor-width' as string]: `${width}px`,
          }}
        >
          {/* Search row overlays global search bar with same dimensions (replacement feel) */}
          <div
            className="flex w-full shrink-0 items-center rounded-t-md bg-background px-2 ring-1 ring-ring ring-offset-1 ring-offset-background"
            style={{ height, minHeight: height }}
          >
            {renderPaletteHeader(headerClassNameWhenAnchored)}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{paletteBody}</div>
        </div>
      </>,
      document.body
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'command-palette flex flex-col overflow-hidden p-0',
          mobile
            ? cn(
                'inset-0 top-0 left-0 h-dvh max-h-dvh w-full max-w-full origin-center',
                'translate-x-0 translate-y-0 rounded-none border-0',
                'pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)]'
              )
            : 'h-[70vh] max-h-125 sm:max-w-xl'
        )}
        hideCloseButton
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('commandPalette.title')}</DialogTitle>
        {paletteContent}
      </DialogContent>
    </Dialog>
  )
}
