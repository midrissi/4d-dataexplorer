import { Button, cn, ScrollArea, Tooltip, TooltipContent, TooltipTrigger } from '@4d/ui'
import {
  Database,
  Layers,
  Loader2,
  Network,
  Search,
  SearchX,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { AiActionsMenu } from '~/components/AiActions'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { PullToRefresh } from '~/components/PullToRefresh'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { Dataclass } from '~/store'
import { useDataExplorerStore } from '~/store'
import { DataclassIcon, getDataclassColorClasses } from '../DataclassCustomizeModal'
import { DataclassCountCell, DataclassLoadCountAction } from './DataclassCountCell'

function dataclassCountAria(name: string, count: number | null, entitiesLabel: string): string {
  if (count === null) return name
  return `${name} - ${count.toLocaleString()} ${entitiesLabel}`
}

type SidebarListProps = {
  filteredDataclasses: Dataclass[]
  dataclasses: Dataclass[]
  dataclassesLoading: boolean
  dataclassesError: string | null
  activeDataclassName: string | null
  sidebarViewMode: 'cards' | 'tables' | 'icons'
  dataclassCustomizations: Record<string, { color?: string; description?: string }>
  searchQuery: string
  onClearSearch: () => void
  isDataclassOpen: (dataclassName: string) => boolean
  handleDataclassClick: (dataclassName: string) => void
  handleOpenCustomize: (e: React.MouseEvent, dataclassName: string) => void
  handleHighlightInGraph: (dataclassName: string) => void
}

export function SidebarList({
  filteredDataclasses,
  dataclasses,
  dataclassesLoading,
  dataclassesError,
  activeDataclassName,
  sidebarViewMode,
  dataclassCustomizations,
  searchQuery,
  onClearSearch,
  isDataclassOpen,
  handleDataclassClick,
  handleOpenCustomize,
  handleHighlightInGraph,
}: SidebarListProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const fetchDataclasses = useDataExplorerStore((s) => s.fetchDataclasses)

  const listBody = (
    <div className="min-w-0">
      {dataclassesLoading && dataclasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">{t('loading.loadingDataclasses')}</p>
        </div>
      ) : dataclassesError ? (
        <div className="p-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
            {dataclassesError}
          </div>
        </div>
      ) : filteredDataclasses.length === 0 ? (
        <SidebarEmptyState
          hasCatalog={dataclasses.length > 0}
          catalogCount={dataclasses.length}
          searchQuery={searchQuery}
          onClearSearch={onClearSearch}
        />
      ) : sidebarViewMode === 'icons' ? (
        <SidebarListIcons
          filteredDataclasses={filteredDataclasses}
          activeDataclassName={activeDataclassName}
          dataclassCustomizations={dataclassCustomizations}
          isDataclassOpen={isDataclassOpen}
          handleDataclassClick={handleDataclassClick}
          handleOpenCustomize={handleOpenCustomize}
          handleHighlightInGraph={handleHighlightInGraph}
        />
      ) : sidebarViewMode === 'tables' ? (
        <SidebarListTable
          filteredDataclasses={filteredDataclasses}
          activeDataclassName={activeDataclassName}
          dataclassCustomizations={dataclassCustomizations}
          isDataclassOpen={isDataclassOpen}
          handleDataclassClick={handleDataclassClick}
          handleOpenCustomize={handleOpenCustomize}
          handleHighlightInGraph={handleHighlightInGraph}
        />
      ) : (
        <SidebarListCards
          filteredDataclasses={filteredDataclasses}
          activeDataclassName={activeDataclassName}
          dataclassCustomizations={dataclassCustomizations}
          isDataclassOpen={isDataclassOpen}
          handleDataclassClick={handleDataclassClick}
          handleOpenCustomize={handleOpenCustomize}
          handleHighlightInGraph={handleHighlightInGraph}
        />
      )}
    </div>
  )

  if (mobile) {
    return (
      <PullToRefresh
        className="min-h-0 min-w-0 flex-1"
        disabled={dataclassesLoading}
        label={t('sidebar.pullToRefresh')}
        onRefresh={async () => {
          await fetchDataclasses()
        }}
      >
        {listBody}
      </PullToRefresh>
    )
  }

  return <ScrollArea className="min-h-0 min-w-0 flex-1">{listBody}</ScrollArea>
}

function SidebarEmptyState({
  hasCatalog,
  catalogCount,
  searchQuery,
  onClearSearch,
}: {
  hasCatalog: boolean
  catalogCount: number
  searchQuery: string
  onClearSearch: () => void
}) {
  const { t } = useTranslation()
  const trimmed = searchQuery.trim()
  const isFiltered = hasCatalog && trimmed.length > 0

  return (
    <EmptyPanel
      icon={isFiltered ? SearchX : Database}
      badgeIcon={isFiltered ? Sparkles : Layers}
      badgeTone={isFiltered ? 'amber' : 'primary'}
      title={isFiltered ? t('sidebar.noSearchMatchesTitle') : t('sidebar.noDataclassesTitle')}
      description={
        isFiltered
          ? t('sidebar.noSearchMatchesDescription', { count: catalogCount })
          : t('sidebar.noDataclassesDescription')
      }
      ghost="cards"
      size="md"
      className="min-h-56"
      chips={
        isFiltered
          ? undefined
          : [{ icon: Layers, label: t('sidebar.emptyCatalogHint'), tone: 'primary' }]
      }
      action={
        isFiltered ? (
          <>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              <Search className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">“{trimmed}”</span>
            </span>
            <EmptyPanelAction icon={X} onClick={onClearSearch}>
              {t('sidebar.clearSearch')}
            </EmptyPanelAction>
          </>
        ) : undefined
      }
    />
  )
}

type ListItemProps = {
  filteredDataclasses: Dataclass[]
  activeDataclassName: string | null
  dataclassCustomizations: Record<string, { color?: string; description?: string }>
  isDataclassOpen: (dataclassName: string) => boolean
  handleDataclassClick: (dataclassName: string) => void
  handleOpenCustomize: (e: React.MouseEvent, dataclassName: string) => void
  handleHighlightInGraph: (dataclassName: string) => void
}

function SidebarListIcons({
  filteredDataclasses,
  activeDataclassName,
  dataclassCustomizations,
  isDataclassOpen,
  handleDataclassClick,
  handleOpenCustomize,
  handleHighlightInGraph,
}: ListItemProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  return (
    <nav
      className={cn(
        'grid gap-1.5',
        mobile
          ? 'grid-cols-3 gap-2 p-3 sm:grid-cols-4'
          : 'grid-cols-2 gap-1.5 p-1.5 pr-2 sm:grid-cols-3'
      )}
      aria-label={t('sidebar.dataclassesAria')}
    >
      {filteredDataclasses.map((dataclass) => {
        const isActive = activeDataclassName === dataclass.name
        const isOpen = isDataclassOpen(dataclass.name)
        const customization = dataclassCustomizations[dataclass.name]
        const colorClasses = getDataclassColorClasses(customization)
        return (
          <Tooltip key={dataclass.name}>
            <TooltipTrigger asChild>
              <div
                style={colorClasses.style}
                className={cn(
                  'group relative flex cursor-pointer flex-col items-center rounded-md transition-colors',
                  mobile ? 'gap-1.5 p-2.5' : 'gap-1 rounded-sm p-1.5',
                  'hover:bg-sidebar-accent/60',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={dataclassCountAria(
                    dataclass.name,
                    dataclass.count,
                    t('entity.entities')
                  )}
                  onClick={() => handleDataclassClick(dataclass.name)}
                  className="flex w-full flex-col items-center gap-1 rounded-sm text-left"
                >
                  <span
                    className={cn(
                      'relative flex shrink-0 items-center justify-center rounded-md transition-colors',
                      mobile ? 'h-11 w-11' : 'h-8 w-8 rounded-sm',
                      'bg-transparent group-hover:bg-sidebar-accent/40',
                      isActive && colorClasses.bgTintStrong,
                      !isActive && mobile && 'bg-muted/60'
                    )}
                  >
                    <DataclassIcon
                      customization={customization}
                      className={cn(mobile ? 'h-5 w-5' : 'h-4 w-4', colorClasses.text)}
                    />
                    {isOpen && !isActive && (
                      <span
                        className={cn(
                          'absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-background',
                          colorClasses.bg
                        )}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      'wrap-break-word line-clamp-2 min-h-0 min-w-0 max-w-full text-center font-medium leading-tight',
                      mobile ? 'text-[11px]' : 'text-xs'
                    )}
                  >
                    {dataclass.name}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-muted-foreground tabular-nums',
                      mobile ? 'text-[10px]' : 'text-[10px] opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <DataclassCountCell name={dataclass.name} count={dataclass.count} />
                  </span>
                </button>
                <div
                  className={cn(
                    'flex gap-0.5',
                    mobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <DataclassLoadCountAction name={dataclass.name} count={dataclass.count} />
                  {!mobile ? <AiActionsMenu dataclassName={dataclass.name} variant="icon" /> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconXs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleHighlightInGraph(dataclass.name)
                    }}
                    className={cn(mobile ? 'hidden' : 'h-6! w-6!')}
                    title={t('sidebar.highlightInStructureGraph')}
                  >
                    <Network className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconXs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenCustomize(e, dataclass.name)
                    }}
                    className={cn(mobile ? 'h-8! w-8!' : 'h-6! w-6!')}
                    title={t('sidebar.customize')}
                  >
                    <Settings className={mobile ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
                  </Button>
                </div>
              </div>
            </TooltipTrigger>
            {!mobile ? (
              <TooltipContent
                side="right"
                sideOffset={4}
                className="max-w-55 border border-border/80 bg-popover shadow-lg dark:border-border dark:bg-popover"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{dataclass.name}</p>
                  <p className="text-muted-foreground text-xs">
                    <DataclassCountCell
                      name={dataclass.name}
                      count={dataclass.count}
                      showEntitiesLabel
                    />
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => handleHighlightInGraph(dataclass.name)}
                    className="mt-1 h-auto justify-start gap-1.5 px-0 text-left text-primary text-xs"
                  >
                    <Network className="h-3.5 w-3.5 shrink-0" />
                    {t('sidebar.highlightInStructureGraph')}
                  </Button>
                </div>
              </TooltipContent>
            ) : null}
          </Tooltip>
        )
      })}
    </nav>
  )
}

function SidebarListTable({
  filteredDataclasses,
  activeDataclassName,
  dataclassCustomizations,
  isDataclassOpen,
  handleDataclassClick,
  handleOpenCustomize,
  handleHighlightInGraph,
}: ListItemProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()

  if (mobile) {
    return (
      <nav className="flex min-w-0 flex-col px-1" aria-label={t('sidebar.dataclassesAria')}>
        {filteredDataclasses.map((dataclass, index) => {
          const isActive = activeDataclassName === dataclass.name
          const isOpen = isDataclassOpen(dataclass.name)
          const customization = dataclassCustomizations[dataclass.name]
          const colorClasses = getDataclassColorClasses(customization)
          const isLast = index === filteredDataclasses.length - 1
          return (
            <div
              key={dataclass.name}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'page' : undefined}
              aria-label={dataclassCountAria(dataclass.name, dataclass.count, t('entity.entities'))}
              style={colorClasses.style}
              className={cn(
                'flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors',
                !isLast && 'border-border/50 border-b',
                'hover:bg-sidebar-accent/60 active:bg-sidebar-accent/80',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
              onClick={() => handleDataclassClick(dataclass.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDataclassClick(dataclass.name)
                }
              }}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
                  isActive ? colorClasses.bgTintStrong : 'bg-muted'
                )}
              >
                <DataclassIcon
                  customization={customization}
                  className={cn('h-4 w-4', colorClasses.text)}
                />
              </span>
              <span className="relative min-w-0 flex-1 overflow-hidden">
                <span className="block truncate font-medium text-sm leading-snug">
                  {dataclass.name}
                </span>
                {isOpen && !isActive ? (
                  <span
                    className={cn(
                      'absolute top-1/2 right-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full',
                      colorClasses.bg
                    )}
                  />
                ) : null}
              </span>
              <span className="shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
                <DataclassCountCell name={dataclass.name} count={dataclass.count} />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenCustomize(e, dataclass.name)
                }}
                aria-label={t('sidebar.customize')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="min-w-0 p-1 pr-2" aria-label={t('sidebar.dataclassesAria')}>
      <table className="w-full min-w-0 table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="border-border/60 border-b text-muted-foreground">
            <th className="h-6 px-1.5 font-medium text-xs" scope="col">
              Table
            </th>
            <th className="h-6 w-14 px-1.5 text-right font-medium text-xs tabular-nums" scope="col">
              Entities
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredDataclasses.map((dataclass) => {
            const isActive = activeDataclassName === dataclass.name
            const isOpen = isDataclassOpen(dataclass.name)
            const customization = dataclassCustomizations[dataclass.name]
            const colorClasses = getDataclassColorClasses(customization)
            return (
              <tr
                key={dataclass.name}
                style={colorClasses.style}
                className={cn(
                  'group h-6 border-border/40 border-b transition-colors last:border-b-0',
                  'hover:bg-sidebar-accent/60',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <td className="p-0" colSpan={2}>
                  <div className="relative flex h-6 w-full min-w-0 items-center gap-1 overflow-hidden px-1.5">
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={dataclassCountAria(
                        dataclass.name,
                        dataclass.count,
                        t('entity.entities')
                      )}
                      onClick={() => handleDataclassClick(dataclass.name)}
                      className={cn(
                        'flex h-6 min-w-0 flex-1 items-center gap-1.5 text-left',
                        'hover:bg-transparent'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-colors',
                          isActive ? colorClasses.bgTintStrong : 'bg-muted'
                        )}
                      >
                        <DataclassIcon
                          customization={customization}
                          className={cn('h-3 w-3', colorClasses.text)}
                        />
                      </span>
                      <span className="relative min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate font-medium text-xs">{dataclass.name}</span>
                        {isOpen && !isActive && (
                          <span
                            className={cn(
                              'absolute top-1/2 right-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full',
                              colorClasses.bg
                            )}
                          />
                        )}
                      </span>
                    </button>
                    <span
                      className={cn(
                        'w-10 shrink-0 text-right text-muted-foreground text-xs tabular-nums',
                        dataclass.count === null && 'group-hover:opacity-0'
                      )}
                    >
                      <DataclassCountCell name={dataclass.name} count={dataclass.count} />
                    </span>
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                      <div className="flex items-center gap-0.5 rounded-sm bg-sidebar-accent p-0.5 ring-1 ring-border/50">
                        <DataclassLoadCountAction name={dataclass.name} count={dataclass.count} />
                        <AiActionsMenu dataclassName={dataclass.name} variant="icon" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconXs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleHighlightInGraph(dataclass.name)
                          }}
                          className="h-6! w-6!"
                          title={t('sidebar.highlightInStructureGraph')}
                        >
                          <Network className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconXs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenCustomize(e, dataclass.name)
                          }}
                          className="h-6! w-6!"
                          title={t('sidebar.customize')}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </nav>
  )
}

type CardsProps = ListItemProps

function SidebarListCards({
  filteredDataclasses,
  activeDataclassName,
  dataclassCustomizations,
  isDataclassOpen,
  handleDataclassClick,
  handleOpenCustomize,
  handleHighlightInGraph,
}: CardsProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  return (
    <nav className="flex min-w-0 flex-col" aria-label={t('sidebar.dataclassesAria')}>
      {filteredDataclasses.map((dataclass, index) => {
        const isActive = activeDataclassName === dataclass.name
        const isOpen = isDataclassOpen(dataclass.name)
        const customization = dataclassCustomizations[dataclass.name]
        const colorClasses = getDataclassColorClasses(customization)
        const subtitle = customization?.description || dataclass.collectionName
        const isLast = index === filteredDataclasses.length - 1

        return (
          // div with role="button" so the whole card is clickable; cannot use <button> because it contains nested icon buttons
          <div
            key={dataclass.name}
            role="button"
            tabIndex={0}
            aria-current={isActive ? 'page' : undefined}
            aria-label={dataclassCountAria(dataclass.name, dataclass.count, t('entity.entities'))}
            style={colorClasses.style}
            className={cn(
              'group relative flex w-full min-w-0 cursor-pointer items-center overflow-hidden rounded-none border-l-2 text-left transition-colors',
              mobile ? 'min-h-14 gap-3 py-3 pr-2 pl-3' : 'gap-2 py-2.5 pr-2 pl-3',
              !isLast && 'border-border border-b',
              'hover:bg-sidebar-accent/60',
              isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
              isOpen && !isActive ? colorClasses.borderLeft : 'border-l-transparent'
            )}
            onClick={() => handleDataclassClick(dataclass.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleDataclassClick(dataclass.name)
              }
            }}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-md ring-1 ring-border/50 transition-colors',
                mobile ? 'h-10 w-10' : 'h-7 w-7',
                isActive ? colorClasses.bgTintStrong : 'bg-muted/70 group-hover:bg-muted'
              )}
            >
              <DataclassIcon
                customization={customization}
                className={cn(mobile ? 'h-4 w-4' : 'h-3.5 w-3.5', colorClasses.text)}
              />
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'min-w-0 truncate font-medium leading-snug',
                    mobile ? 'text-sm' : 'text-[13px]'
                  )}
                >
                  {dataclass.name}
                </span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50 transition-opacity',
                    isOpen && !isActive ? 'opacity-100' : 'opacity-0'
                  )}
                  aria-hidden
                />
              </div>
              {subtitle ? (
                <p
                  className={cn(
                    'mt-0.5 min-w-0 truncate text-muted-foreground leading-snug',
                    mobile ? 'text-xs' : 'text-[11px]'
                  )}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>

            <span
              className={cn(
                'shrink-0 tabular-nums',
                mobile ? 'min-w-12 text-right text-sm' : 'text-[11px]',
                isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                !mobile && dataclass.count === null && 'group-hover:opacity-0'
              )}
            >
              <DataclassCountCell name={dataclass.name} count={dataclass.count} />
            </span>

            {mobile ? (
              <>
                <DataclassLoadCountAction
                  name={dataclass.name}
                  count={dataclass.count}
                  className="h-10 w-10 shrink-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenCustomize(e, dataclass.name)
                  }}
                  aria-label={t('sidebar.customize')}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                <div
                  className={cn(
                    'flex items-center gap-0.5 rounded-sm bg-sidebar-accent p-0.5 ring-1 ring-border/50',
                    !isActive && 'shadow-sm'
                  )}
                >
                  <DataclassLoadCountAction name={dataclass.name} count={dataclass.count} />
                  <AiActionsMenu dataclassName={dataclass.name} variant="icon" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconXs"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleHighlightInGraph(dataclass.name)
                        }}
                      >
                        <Network className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('sidebar.highlightInStructureGraph')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconXs"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenCustomize(e, dataclass.name)
                        }}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('sidebar.customize')}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
