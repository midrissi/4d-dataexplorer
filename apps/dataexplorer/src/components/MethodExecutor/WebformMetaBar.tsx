import { Alert, AlertDescription, AlertTitle, Badge, ClickToCopy, cn } from '@4d/ui'
import { Shield } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { MethodWebformMeta } from './detect-method-result'
import { NotificationIcon } from './NotificationIcon'
import { notificationAlertVariant } from './notification-alert-variant'

export function WebformMetaBar({ webform }: { webform: MethodWebformMeta }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const notification = webform.notification
  const stamp = webform.privilegeStamp
  if (!notification && stamp === undefined) return null

  const alertVariant = notificationAlertVariant(notification?.type)
  const typeLabel = notification?.type?.trim()

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {notification ? (
        <Alert variant={alertVariant} className="py-2.5">
          <NotificationIcon type={notification.type} />
          <AlertTitle className="flex flex-wrap items-center gap-1.5 text-foreground text-xs">
            {t('methodExecutor.notification')}
            {typeLabel ? (
              <Badge
                variant={
                  alertVariant === 'warning'
                    ? 'warning'
                    : alertVariant === 'destructive'
                      ? 'destructive'
                      : alertVariant === 'success'
                        ? 'success'
                        : 'secondary'
                }
                className="h-4 px-1.5 font-medium text-[10px] uppercase tracking-wide"
              >
                {typeLabel}
              </Badge>
            ) : null}
          </AlertTitle>
          <AlertDescription className="text-foreground text-xs leading-snug">
            {notification.message}
          </AlertDescription>
        </Alert>
      ) : null}
      {stamp !== undefined ? (
        <div
          role="status"
          aria-label={`${t('methodExecutor.privilegeStamp')}: ${stamp}`}
          className={cn(
            'flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-border/80 bg-muted/30',
            'px-2.5 py-1.5'
          )}
        >
          <span className="font-medium text-foreground text-xs">
            {t('methodExecutor.privilegeStamp')}
          </span>
          <ClickToCopy
            value={String(stamp)}
            tooltipLabel={t('common.clickToCopy')}
            tooltipCopiedLabel={t('common.copied')}
            aria-label={`${t('methodExecutor.privilegeStamp')}: ${stamp}`}
            className={cn(
              'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border bg-background font-mono text-foreground hover:bg-accent',
              mobile ? 'min-h-9 px-2 py-1.5 text-xs' : 'px-2 py-0.5 text-xs'
            )}
          >
            <Shield className="h-3 w-3 shrink-0 text-foreground/70" aria-hidden />
            <span className="min-w-0 truncate tabular-nums">{stamp}</span>
          </ClickToCopy>
        </div>
      ) : null}
    </div>
  )
}
