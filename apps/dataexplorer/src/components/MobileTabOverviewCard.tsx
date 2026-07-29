import { cn } from '@4d/ui'
import { Pin } from 'lucide-react'
import type { ReactNode } from 'react'
import { getDataclassColorClasses } from '~/components/DataclassCustomizeModal'
import { MobileTabOverviewCardMenu } from '~/components/MobileTabOverviewCardMenu'
import { MobileTabOverviewPreview } from '~/components/MobileTabOverviewPreview'
import { useTranslation } from '~/i18n'
import { getTabOverviewDetails } from '~/lib/tab-overview-details'
import { formatCount } from '~/lib/utils'
import type { DataclassCustomization } from '~/store/settings'
import { isDataclassTab, type Tab } from '~/store/tabs'

type MobileTabOverviewCardProps = {
  tab: Tab
  index: number
  isActive: boolean
  displayName: string
  count: number
  customization?: DataclassCustomization
  canClose: boolean
  canCloseOthers: boolean
  canCloseAbove: boolean
  canCloseBelow: boolean
  renderTabIcon: (tab: Tab, className: string) => ReactNode
  onSelect: () => void
  onClose?: () => void
  onCloseOthers: () => void
  onCloseAbove: () => void
  onCloseBelow: () => void
}

export function MobileTabOverviewCard({
  tab,
  index,
  isActive,
  displayName,
  count,
  customization,
  canClose,
  canCloseOthers,
  canCloseAbove,
  canCloseBelow,
  renderTabIcon,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAbove,
  onCloseBelow,
}: MobileTabOverviewCardProps) {
  const { t } = useTranslation()
  const colorClasses = getDataclassColorClasses(customization)
  const isDataclass = isDataclassTab(tab)
  const details = getTabOverviewDetails(tab, t, { count })
  const iconTone =
    isDataclass && customization
      ? colorClasses.text
      : isActive
        ? 'text-primary'
        : 'text-foreground/70'
  const subtitle = details.subtitle && details.subtitle !== displayName ? details.subtitle : null

  const selectLabel = [
    displayName,
    subtitle,
    isActive ? t('tabs.currentBadge') : null,
    tab.isPinned ? t('tabs.pinTab') : null,
    count > 0 ? formatCount(count) : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className="fade-in zoom-in-95 relative aspect-3/4 w-full animate-in fill-mode-both duration-300"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={selectLabel}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'absolute inset-0 flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-transform active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive
            ? 'border-primary shadow-md shadow-primary/20 ring-2 ring-primary/35'
            : 'border-border/80 hover:border-border hover:shadow-md'
        )}
      >
        <div
          className={cn(
            'relative min-h-0 w-full flex-1 overflow-hidden',
            isActive ? 'bg-primary/8' : 'bg-muted/40'
          )}
          style={colorClasses.style}
        >
          <MobileTabOverviewPreview
            tab={tab}
            isActive={isActive}
            details={details}
            iconTone={iconTone}
            renderTabIcon={renderTabIcon}
          />
        </div>

        <div className="relative z-10 flex h-14 w-full shrink-0 items-center border-border border-t bg-card px-2.5">
          <div className="flex w-full min-w-0 items-start gap-2">
            <span className={cn('mt-0.5 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5', iconTone)}>
              {renderTabIcon(tab, 'h-3.5 w-3.5')}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground text-xs">
                  {displayName}
                </span>
                {isActive ? (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 font-semibold text-[9px] text-primary-foreground">
                    {t('tabs.currentBadge')}
                  </span>
                ) : null}
                {tab.isPinned ? (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
                    aria-hidden
                  >
                    <Pin className="h-2.5 w-2.5" />
                  </span>
                ) : null}
                {count > 0 ? (
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                    {formatCount(count)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground leading-snug">
                {subtitle ?? '\u00a0'}
              </p>
            </div>
          </div>
        </div>
      </button>

      <MobileTabOverviewCardMenu
        canClose={canClose}
        canCloseOthers={canCloseOthers}
        canCloseAbove={canCloseAbove}
        canCloseBelow={canCloseBelow}
        onClose={onClose}
        onCloseOthers={onCloseOthers}
        onCloseAbove={onCloseAbove}
        onCloseBelow={onCloseBelow}
      />
    </div>
  )
}
