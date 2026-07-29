import { Button, cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@4d/ui'
import type { ReactNode } from 'react'
import { MobileTabOverviewCard } from '~/components/MobileTabOverviewCard'
import { useTranslation } from '~/i18n'
import type { DataclassCustomization } from '~/store/settings'
import { isDataclassTab, type Tab } from '~/store/tabs'

function isClosableTab(tab: Tab): boolean {
  return tab.isClosable !== false && !tab.isPinned
}

type MobileTabOverviewProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: Tab[]
  activeTabId: string | null
  dataclassCustomizations: Record<string, DataclassCustomization>
  getTabDisplayName: (tab: Tab) => string
  getTabCount: (tab: Tab) => number
  renderTabIcon: (tab: Tab, className: string) => ReactNode
  onSelectTab: (tab: Tab) => void
  onCloseTab: (tabId: string) => void
  onCloseOtherTabs: (tabId: string) => void
  onCloseTabsAbove: (tabId: string) => void
  onCloseTabsBelow: (tabId: string) => void
  onCloseAllTabs: () => void
}

export function MobileTabOverview({
  open,
  onOpenChange,
  tabs,
  activeTabId,
  dataclassCustomizations,
  getTabDisplayName,
  getTabCount,
  renderTabIcon,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsAbove,
  onCloseTabsBelow,
  onCloseAllTabs,
}: MobileTabOverviewProps) {
  const { t } = useTranslation()
  const canCloseAny = tabs.some(isClosableTab)
  const canCloseExceptCurrent =
    !!activeTabId && tabs.some((tab) => tab.id !== activeTabId && isClosableTab(tab))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          'flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0',
          'top-0 left-0 gap-0 rounded-none border-0 p-0 shadow-none',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          'data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100',
          'data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0',
          'data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0'
        )}
      >
        <DialogTitle className="sr-only">{t('tabs.allTabs')}</DialogTitle>
        <DialogDescription className="sr-only">{t('tabs.moreTabsAria')}</DialogDescription>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background pt-[max(0.75rem,var(--app-safe-top))]">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-primary/12 via-primary/4 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-24 h-40 bg-linear-to-t from-muted/40 to-transparent"
            aria-hidden
          />

          <header className="relative z-10 flex items-start justify-between gap-3 px-5 pb-2">
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-lg tracking-tight">
                {t('tabs.allTabs')}
              </p>
              <p className="mt-0.5 text-muted-foreground text-sm">
                {tabs.length === 1
                  ? t('tabs.tabCountOne')
                  : t('tabs.tabCount', { count: tabs.length })}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 font-semibold text-destructive"
                disabled={!canCloseAny}
                onClick={() => onCloseAllTabs()}
              >
                {t('tabs.closeAll')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 font-medium text-muted-foreground"
                disabled={!canCloseExceptCurrent}
                onClick={() => {
                  if (activeTabId) onCloseOtherTabs(activeTabId)
                }}
              >
                {t('tabs.closeExceptCurrent')}
              </Button>
            </div>
          </header>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <div className="mx-auto grid max-w-lg grid-cols-2 items-start gap-x-3 gap-y-4 pb-4">
              {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId
                const canClose = isClosableTab(tab)
                const canCloseOthers = tabs.some(
                  (other) => other.id !== tab.id && isClosableTab(other)
                )
                const canCloseAbove = tabs.slice(0, index).some(isClosableTab)
                const canCloseBelow = tabs.slice(index + 1).some(isClosableTab)
                const customization = isDataclassTab(tab)
                  ? dataclassCustomizations[tab.dataclassName]
                  : undefined

                return (
                  <MobileTabOverviewCard
                    key={tab.id}
                    tab={tab}
                    index={index}
                    isActive={isActive}
                    displayName={getTabDisplayName(tab)}
                    count={isDataclassTab(tab) ? getTabCount(tab) : 0}
                    customization={customization}
                    canClose={canClose}
                    canCloseOthers={canCloseOthers}
                    canCloseAbove={canCloseAbove}
                    canCloseBelow={canCloseBelow}
                    renderTabIcon={renderTabIcon}
                    onSelect={() => {
                      onSelectTab(tab)
                      onOpenChange(false)
                    }}
                    onClose={canClose ? () => onCloseTab(tab.id) : undefined}
                    onCloseOthers={() => onCloseOtherTabs(tab.id)}
                    onCloseAbove={() => onCloseTabsAbove(tab.id)}
                    onCloseBelow={() => onCloseTabsBelow(tab.id)}
                  />
                )
              })}
            </div>
          </div>

          <div className="relative z-10 shrink-0 border-border/80 border-t bg-background/90 px-4 pt-3 pb-[max(0.75rem,var(--app-safe-bottom))] backdrop-blur-md">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <span className="w-16 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 text-center">
                <p className="font-semibold text-foreground text-sm tabular-nums">
                  {tabs.length === 1
                    ? t('tabs.tabCountOne')
                    : t('tabs.tabCount', { count: tabs.length })}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-16 shrink-0 justify-end px-0 font-semibold text-primary"
                onClick={() => onOpenChange(false)}
              >
                {t('tabs.done')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
