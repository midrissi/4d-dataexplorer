import {
  Button,
  cn,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Home, Loader2, Network, Settings } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { formatCount } from '~/lib/utils'
import { useDataExplorerStore } from '~/store'
import { formatShortcut, getShortcutById, useShortcuts } from '~/store/settings'
import { useActiveDataclassName, useIsHomeTabActive, useTabsStore } from '~/store/tabs'
import {
  DataclassCustomizeModal,
  DataclassIcon,
  getDataclassColorClasses,
} from '../DataclassCustomizeModal'

type SidebarCollapsedProps = {
  dataclassCustomizations: Record<string, { color?: string; description?: string }>
  customizeDataclass: string | null
  customizeModalOpen: boolean
  setCustomizeModalOpen: (open: boolean) => void
  setCustomizeDataclass: (name: string | null) => void
  handleDataclassClick: (dataclassName: string) => void
  handleHighlightInGraph: (dataclassName: string) => void
  isDataclassOpen: (dataclassName: string) => boolean
}

export function SidebarCollapsed({
  dataclassCustomizations,
  customizeDataclass,
  customizeModalOpen,
  setCustomizeModalOpen,
  setCustomizeDataclass,
  handleDataclassClick,
  handleHighlightInGraph,
  isDataclassOpen,
}: SidebarCollapsedProps) {
  const { dataclasses, dataclassesLoading } = useDataExplorerStore()
  const { openHomeTab } = useTabsStore()
  const activeDataclassName = useActiveDataclassName()
  const isHomeActive = useIsHomeTabActive()
  const shortcuts = useShortcuts()
  const openHomeShortcut = getShortcutById(shortcuts, 'open-home')
  const { t } = useTranslation()

  return (
    <div className="flex h-full w-full flex-col bg-muted/30">
      <TooltipProvider delayDuration={100}>
        {/* Home button */}
        <div className="relative flex flex-col items-center py-1">
          {isHomeActive && (
            <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openHomeTab}
                className={cn(
                  'group relative h-8 w-8 transition-colors hover:bg-transparent',
                  isHomeActive ? 'text-foreground' : 'text-muted-foreground/70'
                )}
              >
                <span
                  className={cn(
                    'absolute inset-0.5 rounded-sm opacity-0 transition-opacity',
                    'group-hover:bg-sidebar-accent group-hover:opacity-100',
                    isHomeActive && 'bg-sidebar-accent opacity-100'
                  )}
                />
                <Home className="relative h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={4}>
              <p className="font-medium text-xs">
                Home
                {openHomeShortcut?.enabled && (
                  <kbd className="ml-2 rounded bg-muted px-1.5 font-mono text-xs">
                    {formatShortcut(openHomeShortcut)}
                  </kbd>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-2 h-px bg-border/60" />

        <ScrollArea className="flex-1">
          <nav className="flex flex-col py-1" aria-label={t('sidebar.dataclassesAria')}>
            {dataclassesLoading && dataclasses.length === 0 ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              dataclasses.map((dataclass) => {
                const isActive = activeDataclassName === dataclass.name
                const isOpen = isDataclassOpen(dataclass.name)
                const customization = dataclassCustomizations[dataclass.name]
                const colorClasses = getDataclassColorClasses(customization)

                return (
                  <Tooltip key={dataclass.name}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleDataclassClick(dataclass.name)}
                        style={colorClasses.style}
                        className="group relative h-8 w-full transition-colors hover:bg-transparent"
                      >
                        {isActive && (
                          <span
                            className={cn(
                              'absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full',
                              colorClasses.bg
                            )}
                          />
                        )}
                        {isOpen && !isActive && (
                          <span className="absolute top-1/2 left-0 h-3 w-0.5 -translate-y-1/2 rounded-r-full bg-muted-foreground/40" />
                        )}
                        <span
                          className={cn(
                            'absolute inset-0.5 rounded-sm opacity-0 transition-opacity',
                            'group-hover:bg-sidebar-accent group-hover:opacity-100',
                            isActive && 'bg-sidebar-accent opacity-100'
                          )}
                        />
                        <div className="relative">
                          <DataclassIcon
                            customization={customization}
                            className={cn(
                              'relative h-3.5 w-3.5 transition-colors',
                              customization?.color
                                ? colorClasses.text
                                : isActive
                                  ? 'text-foreground'
                                  : isOpen
                                    ? 'text-muted-foreground group-hover:text-foreground'
                                    : 'text-muted-foreground/70 group-hover:text-foreground'
                            )}
                          />
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={4} className="max-w-50">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <p className="font-semibold">{dataclass.name}</p>
                            {customization?.description && (
                              <p className="text-muted-foreground text-xs">
                                {customization.description}
                              </p>
                            )}
                            <p className="text-muted-foreground text-xs">
                              {formatCount(dataclass.count)} entities
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconXs"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleHighlightInGraph(dataclass.name)
                              }}
                              title={t('sidebar.highlightInGraph')}
                            >
                              <Network className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconXs"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setCustomizeDataclass(dataclass.name)
                                setCustomizeModalOpen(true)
                              }}
                              title={t('sidebar.customize')}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="flex gap-2 text-xs">
                            <span className={cn('flex items-center gap-1', colorClasses.text)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', colorClasses.bg)} />
                              Open
                            </span>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })
            )}
          </nav>
        </ScrollArea>
      </TooltipProvider>

      {customizeDataclass && (
        <DataclassCustomizeModal
          open={customizeModalOpen}
          onOpenChange={setCustomizeModalOpen}
          dataclassName={customizeDataclass}
          currentCustomization={dataclassCustomizations[customizeDataclass]}
        />
      )}
    </div>
  )
}
