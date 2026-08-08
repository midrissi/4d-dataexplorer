import { cn } from '@4d/ui'
import { PanelLeft, Pin, Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import { DataclassIcon, getDataclassColorClasses } from '~/components/DataclassCustomizeModal'
import { EmptyPanel } from '~/components/EmptyPanel'
import { isMobileShell } from '~/lib/platform'
import type { DataclassCustomization } from '~/store/settings'
import { isDataclassTab, type Tab } from '~/store/tabs'
import type { TFunction } from './utils'
import { getTabDisplayName, getTabIcon } from './utils'

export type SwitchTabsModeProps = {
  switchTabsSearch: string
  setSwitchTabsSearch: (value: string) => void
  switchTabsInputRef: RefObject<HTMLInputElement | null>
  tabs: Tab[]
  filteredTabs: Tab[]
  switchTabsSelectedIndex: number
  setSwitchTabsSelectedIndex: (index: number) => void
  switchTabsGridRef: RefObject<HTMLDivElement | null>
  activeTabId: string | null
  dataclassCustomizations: Record<string, DataclassCustomization>
  onSwitchToTab: (tab: Tab) => void
  onCloseTab: (e: React.MouseEvent, tab: Tab) => void
  t: TFunction
  className?: string
}

export function SwitchTabsModeHeader({
  switchTabsSearch,
  setSwitchTabsSearch,
  switchTabsInputRef,
  t,
  className,
}: SwitchTabsModeProps) {
  const mobile = isMobileShell()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <PanelLeft className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-primary text-sm">@</span>
      <input
        ref={switchTabsInputRef}
        value={switchTabsSearch}
        onChange={(e) => setSwitchTabsSearch(e.target.value)}
        placeholder={t('commandPalette.switchTabPlaceholder')}
        className={cn(
          'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
          mobile ? 'text-sm' : 'text-xs',
          className ? 'min-h-0' : mobile ? 'h-11' : 'h-8'
        )}
      />
      {!mobile ? (
        <kbd className="ml-auto hidden shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-xs sm:inline">
          {t('commandPalette.escKey')}
        </kbd>
      ) : null}
    </div>
  )
}

export function SwitchTabsModeContent({
  tabs,
  filteredTabs,
  switchTabsSelectedIndex,
  setSwitchTabsSelectedIndex,
  switchTabsGridRef,
  activeTabId,
  dataclassCustomizations,
  onSwitchToTab,
  onCloseTab,
  t,
}: SwitchTabsModeProps) {
  const mobile = isMobileShell()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-command-palette-list>
      <div ref={switchTabsGridRef} className="grid grid-cols-2 gap-1 px-1.5 py-2 sm:grid-cols-3">
        {filteredTabs.length === 0 ? (
          <EmptyPanel
            icon={PanelLeft}
            badgeIcon={Search}
            badgeTone="amber"
            title={
              tabs.length === 0 ? t('commandPalette.noTabsOpen') : t('commandPalette.noTabsMatch')
            }
            ghost="none"
            size="sm"
            className="col-span-full"
          />
        ) : (
          filteredTabs.map((tab, index) => {
            const isSelected = index === switchTabsSelectedIndex
            const isCurrentTab = tab.id === activeTabId
            const canClose = tab.isClosable !== false && !tab.isPinned
            const isDataclass = isDataclassTab(tab)
            const customization = isDataclass
              ? dataclassCustomizations[tab.dataclassName]
              : undefined
            const colorClasses = getDataclassColorClasses(customization)

            const renderTabIcon = () => {
              const iconColor = isSelected
                ? 'text-primary'
                : isDataclass && customization
                  ? colorClasses.text
                  : 'text-muted-foreground'
              if (isDataclass) {
                return (
                  <DataclassIcon
                    customization={customization}
                    className={cn(
                      'size-3.5 shrink-0 transition-colors [&_svg]:size-3.5',
                      iconColor
                    )}
                  />
                )
              }
              return (
                <span className={cn('size-3.5 shrink-0 [&_svg]:size-3.5', iconColor)}>
                  {getTabIcon(tab)}
                </span>
              )
            }

            return (
              <button
                type="button"
                key={tab.id}
                data-switch-tab-index={index}
                onClick={() => onSwitchToTab(tab)}
                onMouseEnter={() => setSwitchTabsSelectedIndex(index)}
                style={colorClasses.style}
                className={cn(
                  'group relative flex w-full cursor-pointer items-center gap-1.5 rounded-sm border border-l-2 bg-transparent px-1.5 py-0 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  mobile ? 'h-11' : 'h-7',
                  isSelected ? 'border-primary bg-accent' : 'border-border',
                  !isSelected && isCurrentTab && 'border-l-primary'
                )}
              >
                <span className="flex shrink-0 items-center gap-0.5">
                  {renderTabIcon()}
                  {tab.isPinned && (
                    <Pin
                      className={cn(
                        'size-2.5 shrink-0',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                      aria-label={t('commandPalette.pinned')}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-medium',
                    mobile ? 'text-sm' : 'text-xs',
                    isSelected && 'text-primary',
                    !isSelected && isDataclass && customization && colorClasses.text
                  )}
                >
                  {getTabDisplayName(tab, t)}
                </span>
                {(isCurrentTab || canClose) && (
                  <div className="relative ml-auto flex shrink-0 items-center pr-0.5">
                    {isCurrentTab && (
                      <span className="rounded bg-primary/20 px-1 py-0.5 font-medium text-[10px] text-primary">
                        {t('settings.current')}
                      </span>
                    )}
                    {canClose && (
                      // Intentionally a span with role=button: it is nested inside the tab
                      // <button>, so a real <button> would be invalid HTML.
                      <span
                        role="button"
                        tabIndex={0}
                        className="absolute top-1/2 right-0 flex size-5 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded opacity-0 transition-colors hover:bg-accent hover:text-accent-foreground group-hover:z-10 group-hover:opacity-100 [&_svg]:size-2.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCloseTab(e, tab)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            onCloseTab(e as unknown as React.MouseEvent, tab)
                          }
                        }}
                        aria-label={`${t('common.close')} ${getTabDisplayName(tab, t)}`}
                      >
                        <X />
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export function SwitchTabsModeFooter({ t }: { t: TFunction }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↑↓←→</kbd>
        <span>{t('commandPalette.navigate')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">↵</kbd>
        <span>{t('commandPalette.switch')}</span>
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
