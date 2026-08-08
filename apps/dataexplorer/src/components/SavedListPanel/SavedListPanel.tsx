import { Button, cn, useConfirm } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

export type SavedListClearConfirm = {
  title: string
  description: string
  confirmText: string
  cancelText: string
}

/**
 * Shared chrome for History / Favourites panels (HTTP Client + Method Executor).
 * Bordered header with icon, title, count, optional extras, clear, and a scrollable list.
 */
export function SavedListPanel({
  icon: Icon,
  title,
  titleId,
  count,
  countMax,
  headerExtra,
  clearLabel,
  clearDisabled,
  onClear,
  clearConfirm,
  emptyTitle,
  emptyDescription,
  onClose,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  titleId?: string
  count?: number
  countMax?: number
  headerExtra?: ReactNode
  clearLabel: string
  clearDisabled?: boolean
  onClear: () => void
  clearConfirm: SavedListClearConfirm
  emptyTitle: string
  emptyDescription: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const mobile = isMobileShell()
  const isEmpty = (count ?? 0) === 0

  const handleClearAll = async () => {
    const ok = await confirm({
      title: clearConfirm.title,
      description: <span>{clearConfirm.description}</span>,
      confirmText: clearConfirm.confirmText,
      cancelText: clearConfirm.cancelText,
      variant: 'destructive',
    })
    if (!ok) return
    onClear()
    onClose()
  }

  return (
    <div
      className={cn(
        'overflow-hidden border-border/70 bg-muted/10 shadow-xs',
        mobile ? 'flex h-full min-h-0 flex-col border-0' : 'rounded-md border',
        className
      )}
    >
      <ConfirmDialog />
      <div
        className={cn(
          'flex items-center gap-2 border-border/60 border-b bg-muted/25 px-2 py-1',
          mobile && 'shrink-0 flex-col items-stretch gap-2 px-3 py-2'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p id={titleId} className={cn('font-medium text-xs', mobile && 'text-sm')}>
              {title}
            </p>
            {count != null && count > 0 ? (
              <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {count}
                {countMax != null ? (
                  <span className="text-muted-foreground/60">/{countMax}</span>
                ) : null}
              </span>
            ) : null}
          </div>
          {mobile ? (
            <Button
              variant="ghost"
              className="h-9 shrink-0 px-3 text-sm"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <X className="mr-1 h-4 w-4" />
              {t('common.close')}
            </Button>
          ) : null}
        </div>
        <div className={cn('flex shrink-0 items-center gap-1', mobile && 'justify-between')}>
          {headerExtra}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-2 text-[11px] text-muted-foreground', mobile && 'h-9 text-xs')}
            onClick={() => void handleClearAll()}
            disabled={clearDisabled ?? isEmpty}
          >
            {clearLabel}
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <div className="p-2">
          <EmptyPanel
            icon={Icon}
            badgeTone="muted"
            title={emptyTitle}
            description={emptyDescription}
            ghost="rows"
            bordered
            size="sm"
          />
        </div>
      ) : (
        <div
          className={cn(
            'overflow-y-auto overscroll-contain bg-background/40',
            mobile ? 'min-h-0 flex-1' : 'max-h-56'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
