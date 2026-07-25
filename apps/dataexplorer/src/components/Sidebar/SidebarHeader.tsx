import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@4d/ui'
import {
  ChevronsLeft,
  Dices,
  Home,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  RefreshCw,
  Search,
  SortAsc,
  Table2,
  X,
} from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from '~/i18n'
import { formatCount } from '~/lib/utils'
import { useDataExplorerStore } from '~/store'
import {
  COLOR_PRESETS,
  type DataclassCustomization,
  formatShortcut,
  ICON_PRESETS,
  useDataclassCustomizations,
  useSettingsStore,
  useShortcut,
  useSidebarViewMode,
} from '~/store/settings'
import { useIsHomeTabActive } from '~/store/tabs'
import { SORT_LABEL_KEYS, SORT_OPTIONS, type SortOption } from './types'

type SidebarHeaderProps = {
  totalEntities: number
  searchQuery: string
  setSearchQuery: (q: string) => void
  sortOption: SortOption
  setSortOption: (opt: SortOption) => void
  openHomeTab: () => void
  handleOpenAllDataclasses: () => void
}

export function SidebarHeader({
  totalEntities,
  searchQuery,
  setSearchQuery,
  sortOption,
  setSortOption,
  openHomeTab,
  handleOpenAllDataclasses,
}: SidebarHeaderProps) {
  const { dataclasses, dataclassesLoading, fetchDataclasses } = useDataExplorerStore()
  const sidebarViewMode = useSidebarViewMode()
  const setSidebarViewMode = useSettingsStore((state) => state.setSidebarViewMode)
  const dataclassCustomizations = useDataclassCustomizations()
  const setDataclassCustomizations = useSettingsStore((state) => state.setDataclassCustomizations)
  const isHomeActive = useIsHomeTabActive()
  const searchShortcut = useShortcut('search-dataclasses')
  const openHomeShortcut = useShortcut('open-home')
  const toggleSidebarShortcut = useShortcut('toggle-sidebar')
  const toggleSidebarCollapsed = useSettingsStore((state) => state.toggleSidebarCollapsed)
  const { t } = useTranslation()

  const randomizeDataclassIcons = useCallback(() => {
    if (dataclasses.length === 0) return
    const colorKeys = Object.keys(COLOR_PRESETS).filter((key) => key !== 'default')
    const updates: Record<string, DataclassCustomization> = {}
    for (const dataclass of dataclasses) {
      const existing = dataclassCustomizations[dataclass.name]
      updates[dataclass.name] = {
        ...existing,
        icon: ICON_PRESETS[Math.floor(Math.random() * ICON_PRESETS.length)],
        color: colorKeys[Math.floor(Math.random() * colorKeys.length)],
      }
    }
    setDataclassCustomizations(updates)
  }, [dataclasses, dataclassCustomizations, setDataclassCustomizations])

  return (
    <div className="flex h-auto min-h-0 flex-col gap-2 border-border/60 border-b p-2 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-xs">{t('sidebar.dataclasses')}</h2>
          <p className="text-muted-foreground text-xs">
            {formatCount(totalEntities)} {t('sidebar.totalEntities')}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={toggleSidebarCollapsed}
              aria-label={t('layout.collapseSidebar')}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('layout.collapseSidebar')}
            {toggleSidebarShortcut?.enabled ? (
              <kbd className="ml-2 rounded bg-muted px-1.5 font-mono text-xs">
                {formatShortcut(toggleSidebarShortcut)}
              </kbd>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center justify-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isHomeActive ? 'secondary' : 'ghost'}
              size="icon"
              className="h-6 w-6"
              onClick={openHomeTab}
            >
              <Home className={cn('h-3.5 w-3.5', isHomeActive && 'text-primary')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('sidebar.openHomeTab')}
            {openHomeShortcut?.enabled && (
              <kbd className="ml-2 rounded bg-muted px-1.5 font-mono text-xs">
                {formatShortcut(openHomeShortcut)}
              </kbd>
            )}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleOpenAllDataclasses}
              disabled={dataclassesLoading || dataclasses.length === 0}
            >
              <Layers className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('sidebar.openAllDataclasses')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={fetchDataclasses}
              disabled={dataclassesLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', dataclassesLoading && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('sidebar.refreshDataclasses')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={randomizeDataclassIcons}
              disabled={dataclassesLoading || dataclasses.length === 0}
              aria-label={t('sidebar.randomizeIcons')}
            >
              <Dices className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('sidebar.randomizeIcons')}</TooltipContent>
        </Tooltip>
        <div className="flex h-6 items-center rounded-sm border border-border bg-muted/30 p-px">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-5 w-5 rounded-r-none rounded-l-sm transition-colors',
                  sidebarViewMode === 'cards' && 'bg-background shadow-xs dark:bg-muted'
                )}
                onClick={() => setSidebarViewMode('cards')}
                aria-pressed={sidebarViewMode === 'cards'}
              >
                <LayoutGrid className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.cardsView')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-5 w-5 rounded-none transition-colors',
                  sidebarViewMode === 'tables' && 'bg-background shadow-xs dark:bg-muted'
                )}
                onClick={() => setSidebarViewMode('tables')}
                aria-pressed={sidebarViewMode === 'tables'}
              >
                <Table2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.tablesView')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-5 w-5 rounded-r-sm rounded-l-none transition-colors',
                  sidebarViewMode === 'icons' && 'bg-background shadow-xs dark:bg-muted'
                )}
                onClick={() => setSidebarViewMode('icons')}
                aria-pressed={sidebarViewMode === 'icons'}
              >
                <LayoutTemplate className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.iconsView')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-sidebar-search
            placeholder={
              searchShortcut?.enabled
                ? t('sidebar.searchPlaceholderWithShortcut', {
                    shortcut: formatShortcut(searchShortcut),
                  })
                : t('sidebar.searchPlaceholder')
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('')
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className={cn('h-6 rounded-sm pl-7 text-xs', searchQuery && 'pr-7')}
            aria-label={t('sidebar.searchAria')}
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-1 h-5 w-5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('sidebar.clearSearch')}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={sortOption !== 'none' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-6 w-6 shrink-0"
                >
                  <SortAsc className={cn('h-3.5 w-3.5', sortOption !== 'none' && 'text-primary')} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.sortDataclasses')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-44">
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSortOption(option.value)}
                className={cn(
                  'flex items-center gap-2',
                  sortOption === option.value && 'bg-primary text-primary-foreground'
                )}
              >
                <option.icon className="h-4 w-4" />
                <span>{t(SORT_LABEL_KEYS[option.value])}</span>
              </DropdownMenuItem>
            ))}
            {sortOption !== 'none' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSortOption('none')}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                  <span>{t('sidebar.clearSorting')}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
