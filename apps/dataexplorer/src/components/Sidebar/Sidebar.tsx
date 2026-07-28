import { TooltipProvider } from '@4d/ui'
import { useCallback, useMemo, useState } from 'react'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import { useDataExplorerStore } from '~/store'
import {
  useDataclassCustomizations,
  useSettingsStore,
  useSidebarSortOption,
  useSidebarViewMode,
} from '~/store/settings'
import { isDataclassTab, useActiveDataclassName, useTabsStore } from '~/store/tabs'
import { DataclassCustomizeModal } from '../DataclassCustomizeModal'
import { SidebarCollapsed } from './SidebarCollapsed'
import { SidebarFooter } from './SidebarFooter'
import { SidebarHeader } from './SidebarHeader'
import { SidebarList } from './SidebarList'
import type { SidebarProps } from './types'

export function Sidebar({ collapsed = false, onDataclassOpened }: SidebarProps) {
  const { dataclasses, dataclassesLoading, dataclassesError } = useDataExplorerStore()
  const { tabs, openTab, openAllDataclasses, openHomeTab, openGraphTab } = useTabsStore()
  const activeDataclassName = useActiveDataclassName()
  const [searchQuery, setSearchQuery] = useState('')
  const sortOption = useSidebarSortOption()
  const setSortOption = useSettingsStore((s) => s.setSidebarSortOption)
  const sidebarViewMode = useSidebarViewMode()
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false)
  const [customizeDataclass, setCustomizeDataclass] = useState<string | null>(null)

  const dataclassCustomizations = useDataclassCustomizations()

  const handleOpenCustomize = useCallback((e: React.MouseEvent, dataclassName: string) => {
    e.stopPropagation()
    setCustomizeDataclass(dataclassName)
    setCustomizeModalOpen(true)
  }, [])

  const handleDataclassClick = useCallback(
    (dataclassName: string) => {
      openTab(dataclassName)
      onDataclassOpened?.()
    },
    [openTab, onDataclassOpened]
  )

  const handleHighlightInGraph = useCallback(
    (dataclassName: string) => {
      if (isMobileShell()) return
      openGraphTab().then(() => {
        eventBus.emit('highlight-dataclass-in-graph', dataclassName)
      })
    },
    [openGraphTab]
  )

  const handleOpenAllDataclasses = useCallback(() => {
    const dataclassNames = dataclasses.map((c) => c.name)
    openAllDataclasses(dataclassNames)
  }, [dataclasses, openAllDataclasses])

  const isDataclassOpen = useCallback(
    (dataclassName: string) => {
      return tabs.some((t) => isDataclassTab(t) && t.dataclassName === dataclassName)
    },
    [tabs]
  )

  const filteredDataclasses = useMemo(() => {
    let result = [...dataclasses]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(query))
    }

    switch (sortOption) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'count-asc':
        result.sort((a, b) => a.count - b.count)
        break
      case 'count-desc':
        result.sort((a, b) => b.count - a.count)
        break
    }

    return result
  }, [dataclasses, searchQuery, sortOption])

  const totalEntities = useMemo(
    () => dataclasses.reduce((sum, c) => sum + c.count, 0),
    [dataclasses]
  )

  if (collapsed) {
    return (
      <SidebarCollapsed
        dataclassCustomizations={dataclassCustomizations}
        customizeDataclass={customizeDataclass}
        customizeModalOpen={customizeModalOpen}
        setCustomizeModalOpen={setCustomizeModalOpen}
        setCustomizeDataclass={setCustomizeDataclass}
        handleDataclassClick={handleDataclassClick}
        handleHighlightInGraph={handleHighlightInGraph}
        isDataclassOpen={isDataclassOpen}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full min-w-0 flex-col bg-muted/30">
        <SidebarHeader
          totalEntities={totalEntities}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortOption={sortOption}
          setSortOption={setSortOption}
          openHomeTab={openHomeTab}
          handleOpenAllDataclasses={handleOpenAllDataclasses}
        />

        <SidebarList
          filteredDataclasses={filteredDataclasses}
          dataclasses={dataclasses}
          dataclassesLoading={dataclassesLoading}
          dataclassesError={dataclassesError}
          activeDataclassName={activeDataclassName}
          sidebarViewMode={sidebarViewMode}
          dataclassCustomizations={dataclassCustomizations}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          isDataclassOpen={isDataclassOpen}
          handleDataclassClick={handleDataclassClick}
          handleOpenCustomize={handleOpenCustomize}
          handleHighlightInGraph={handleHighlightInGraph}
        />

        <SidebarFooter
          filteredCount={filteredDataclasses.length}
          totalCount={dataclasses.length}
          sortOption={sortOption}
          setSortOption={setSortOption}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {customizeDataclass && (
          <DataclassCustomizeModal
            open={customizeModalOpen}
            onOpenChange={setCustomizeModalOpen}
            dataclassName={customizeDataclass}
            currentCustomization={dataclassCustomizations[customizeDataclass]}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
