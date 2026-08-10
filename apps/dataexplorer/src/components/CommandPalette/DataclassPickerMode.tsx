import { Button, cn } from '@4d/ui'
import { Database, Search } from 'lucide-react'
import type { RefObject } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { isMobileShell } from '~/lib/platform'
import type { TFunction } from './utils'

export type DataclassPickerModeProps = {
  dataclassDataMode: boolean
  dataclassSearch: string
  setDataclassSearch: (value: string) => void
  dataclassInputRef: RefObject<HTMLInputElement | null>
  onKeyDown: (e: React.KeyboardEvent) => void
  dataclasses: Array<{ name: string; count: number | null }>
  filteredDataclasses: Array<{ name: string; count: number | null }>
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  listRef: RefObject<HTMLDivElement | null>
  onSelectDataclass: (name: string) => void
  onOpenDataclassData: (name: string) => void
  t: TFunction
  className?: string
}

export function DataclassPickerModeHeader({
  dataclassDataMode,
  dataclassSearch,
  setDataclassSearch,
  dataclassInputRef,
  onKeyDown,
  t,
  className,
}: DataclassPickerModeProps) {
  const mobile = isMobileShell()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Database className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-primary text-sm">{dataclassDataMode ? '/' : '>'}</span>
      <input
        ref={dataclassInputRef}
        value={dataclassSearch}
        onChange={(e) => setDataclassSearch(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          dataclassDataMode
            ? t('commandPalette.searchDataclassToViewData')
            : t('commandPalette.dataclassSearchPlaceholder')
        }
        className={cn(
          'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
          mobile ? 'text-sm' : 'text-xs',
          className ? 'min-h-0' : mobile ? 'h-11' : 'h-8'
        )}
      />
      {!mobile ? (
        <kbd className="ml-auto hidden shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-xs sm:inline">
          esc
        </kbd>
      ) : null}
    </div>
  )
}

export function DataclassPickerModeContent({
  dataclassDataMode,
  filteredDataclasses,
  selectedIndex,
  setSelectedIndex,
  listRef,
  onSelectDataclass,
  onOpenDataclassData,
  t,
}: DataclassPickerModeProps) {
  const mobile = isMobileShell()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-command-palette-list>
      <div ref={listRef} className="p-1">
        {filteredDataclasses.length === 0 ? (
          <EmptyPanel
            icon={Database}
            badgeIcon={Search}
            badgeTone="amber"
            title={t('commandPalette.noDataclassesFound')}
            ghost="none"
            size="sm"
          />
        ) : (
          <div className="mb-1">
            <div className="mb-0.5 px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
              {t('sidebar.dataclasses')}
            </div>
            {filteredDataclasses.map((dc, index) => {
              const isSelected = index === selectedIndex
              const onSelect = dataclassDataMode
                ? () => onOpenDataclassData(dc.name)
                : () => onSelectDataclass(dc.name)
              return (
                <Button
                  type="button"
                  key={dc.name}
                  variant="ghost"
                  data-index={index}
                  onClick={onSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'h-auto w-full items-start justify-start gap-2 whitespace-normal rounded-sm text-left',
                    mobile ? 'min-h-11 px-2 py-2.5' : 'min-h-7 px-1.5 py-1.5',
                    isSelected && 'bg-accent text-accent-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 shrink-0',
                      isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    <Database className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div
                      className={cn(
                        'truncate font-medium leading-tight',
                        mobile ? 'text-sm' : 'text-xs'
                      )}
                    >
                      {dc.name}
                    </div>
                    <div
                      className={cn(
                        'truncate text-[11px] leading-tight',
                        isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {dc.count == null
                        ? t('sidebar.countUnknown')
                        : `${dc.count.toLocaleString()} ${t('entity.entities')}`}
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function DataclassPickerModeFooter({
  dataclassDataMode,
  t,
}: {
  dataclassDataMode: boolean
  t: TFunction
}) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↑↓</kbd>
        <span>{t('commandPalette.navigate')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↵</kbd>
        <span>{dataclassDataMode ? t('commandPalette.viewData') : t('commandPalette.select')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {t('commandPalette.escKey')}
        </kbd>
        <span>{t('commandPalette.back')}</span>
      </div>
    </>
  )
}
