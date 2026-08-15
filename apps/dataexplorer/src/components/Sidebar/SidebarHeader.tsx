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
  Dices,
  Hash,
  Home,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  Search,
  SortAsc,
  Table2,
  X,
} from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from '~/i18n'
import {
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'
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
  countsIncomplete: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  sortOption: SortOption
  setSortOption: (opt: SortOption) => void
  openHomeTab: () => void
  handleOpenAllDataclasses: () => void
  onClose?: () => void
}

export function SidebarHeader({
  totalEntities,
  countsIncomplete,
  searchQuery,
  setSearchQuery,
  sortOption,
  setSortOption,
  openHomeTab,
  handleOpenAllDataclasses,
  onClose,
}: SidebarHeaderProps) {
  const {
    dataclasses,
    dataclassesLoading,
    fetchDataclasses,
    fetchAllDataclassCounts,
    countsLoadingAll,
  } = useDataExplorerStore()
  const sidebarViewMode = useSidebarViewMode()
  const setSidebarViewMode = useSettingsStore((state) => state.setSidebarViewMode)
  const dataclassCustomizations = useDataclassCustomizations()
  const setDataclassCustomizations = useSettingsStore((state) => state.setDataclassCustomizations)
  const isHomeActive = useIsHomeTabActive()
  const searchShortcut = useShortcut('search-dataclasses')
  const openHomeShortcut = useShortcut('open-home')
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const controlSize = mobile ? 'h-11 w-11' : 'h-6 w-6'
  const iconSize = mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'

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
    <div
      className={cn(
        'flex h-auto min-h-0 flex-col border-border/60 border-b',
        mobile ? 'gap-2 p-3 pt-2' : 'gap-2 p-2 pb-2'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className={cn('font-semibold', mobile ? 'text-base' : 'text-xs')}>
            {t('sidebar.dataclasses')}
          </h2>
          <p className={cn('text-muted-foreground', mobile ? 'text-sm' : 'text-xs')}>
            {countsIncomplete
              ? t('sidebar.countsPartial', { loaded: formatCount(totalEntities) })
              : `${formatCount(totalEntities)} ${t('sidebar.totalEntities')}`}
          </p>
        </div>
        {mobile && onClose ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 shrink-0 gap-2 px-3"
            onClick={onClose}
            aria-label={t('mobile.closeCatalog')}
          >
            <X className="h-4 w-4" />
            {t('mobile.closeCatalog')}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'flex items-center',
          mobile ? 'justify-between gap-1' : 'justify-center gap-0.5'
        )}
      >
        <div className={cn('flex items-center', mobile ? 'gap-1' : 'gap-0.5')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isHomeActive ? 'secondary' : 'ghost'}
                size="icon"
                className={controlSize}
                onClick={openHomeTab}
              >
                <Home className={cn(iconSize, isHomeActive && 'text-primary')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('sidebar.openHomeTab')}
              {openHomeShortcut?.enabled && !mobile && (
                <kbd className="ml-2 rounded bg-muted px-1.5 font-mono text-xs">
                  {formatShortcut(openHomeShortcut)}
                </kbd>
              )}
            </TooltipContent>
          </Tooltip>
          {!mobile ? (
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
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={controlSize}
                onClick={fetchDataclasses}
                disabled={dataclassesLoading}
              >
                <RefreshCw className={cn(iconSize, dataclassesLoading && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.refreshDataclasses')}</TooltipContent>
          </Tooltip>
          {countsIncomplete ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={controlSize}
                  onClick={() => void fetchAllDataclassCounts()}
                  disabled={countsLoadingAll || dataclassesLoading || dataclasses.length === 0}
                  aria-label={t('sidebar.loadAllCounts')}
                >
                  {countsLoadingAll ? (
                    <Loader2 className={cn(iconSize, 'animate-spin')} aria-hidden />
                  ) : (
                    <Hash className={iconSize} aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('sidebar.loadAllCounts')}</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={controlSize}
                onClick={randomizeDataclassIcons}
                disabled={dataclassesLoading || dataclasses.length === 0}
                aria-label={t('sidebar.randomizeIcons')}
              >
                <Dices className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.randomizeIcons')}</TooltipContent>
          </Tooltip>
        </div>
        <div
          className={cn(
            'flex items-center rounded-md border border-border bg-muted/30',
            mobile ? 'h-11 p-1' : 'h-6 p-px'
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'rounded-r-none rounded-l-sm transition-colors',
                  mobile ? 'h-9 w-9' : 'h-5 w-5',
                  sidebarViewMode === 'cards' && 'bg-background shadow-xs dark:bg-muted'
                )}
                onClick={() => setSidebarViewMode('cards')}
                aria-pressed={sidebarViewMode === 'cards'}
                aria-label={t('sidebar.cardsView')}
              >
                <LayoutGrid className={mobile ? 'h-4 w-4' : 'h-3 w-3'} />
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
                  'rounded-none transition-colors',
                  mobile ? 'h-9 w-9' : 'h-5 w-5',
                  sidebarViewMode === 'tables' && 'bg-background shadow-xs dark:bg-muted'
                )}
                onClick={() => setSidebarViewMode('tables')}
                aria-pressed={sidebarViewMode === 'tables'}
                aria-label={t('sidebar.tablesView')}
              >
                <Table2 className={mobile ? 'h-4 w-4' : 'h-3 w-3'} />
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
                  'rounded-r-sm rounded-l-none transition-colors',
                  mobile ? 'h-9 w-9' : 'h-5 w-5',
                  sidebarViewMode === 'icons' && 'bg-background shadow-xs dark:bg-muted'
                )}
                onClick={() => setSidebarViewMode('icons')}
                aria-pressed={sidebarViewMode === 'icons'}
                aria-label={t('sidebar.iconsView')}
              >
                <LayoutTemplate className={mobile ? 'h-4 w-4' : 'h-3 w-3'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.iconsView')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className={cn('flex items-center', mobile ? 'gap-2' : 'gap-1')}>
        <div className="relative min-w-0 flex-1">
          <Search
            className={cn(
              'absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground',
              mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'
            )}
          />
          <Input
            data-sidebar-search
            placeholder={
              !mobile && searchShortcut?.enabled
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
            className={cn(
              'rounded-md pl-8 text-sm',
              mobile ? 'h-11' : 'h-6 rounded-sm pl-7 text-xs',
              searchQuery && (mobile ? 'pr-10' : 'pr-7')
            )}
            aria-label={t('sidebar.searchAria')}
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className={cn(
                'absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground',
                mobile ? 'h-9 w-9' : 'h-5 w-5'
              )}
              aria-label={t('sidebar.clearSearch')}
            >
              <X className={mobile ? 'h-4 w-4' : 'h-3 w-3'} />
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
                  className={cn(controlSize, 'shrink-0')}
                >
                  <SortAsc className={cn(iconSize, sortOption !== 'none' && 'text-primary')} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('sidebar.sortDataclasses')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className={mobile ? mobileMenuContentClass() : 'w-44'}
            {...(mobile ? mobileMenuCollisionProps : { collisionPadding: 12 })}
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSortOption(option.value)}
                className={cn(
                  'flex items-center gap-2',
                  mobile && mobileMenuItemClass(),
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
                  className={cn(
                    'flex items-center gap-2 text-muted-foreground',
                    mobile && mobileMenuItemClass()
                  )}
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
