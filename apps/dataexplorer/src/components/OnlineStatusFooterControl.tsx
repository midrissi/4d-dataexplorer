import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import { CloudOff, Database, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { useOnlineStatusFlash } from '~/hooks/useOnlineStatusFlash'
import { useTranslation } from '~/i18n'

/**
 * Status-bar chip: stays up while offline, then briefly confirms “back online”.
 */
export function OnlineStatusFooterControl() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { kind, dismissFlash } = useOnlineStatusFlash()

  if (kind === 'hidden') return null

  const offline = kind === 'offline'

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && !offline) dismissFlash()
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            'relative h-6 gap-1.5 px-2 text-[11px]',
            offline
              ? 'border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15'
              : 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200'
          )}
          aria-label={offline ? t('onlineStatus.offlineAria') : t('onlineStatus.onlineAria')}
          aria-expanded={open}
          aria-live="polite"
          title={offline ? t('onlineStatus.offlineTooltip') : t('onlineStatus.onlineTooltip')}
        >
          {offline ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
          <span>{offline ? t('onlineStatus.offlineLabel') : t('onlineStatus.onlineLabel')}</span>
          <span
            className={cn(
              'absolute top-1 right-1 h-1.5 w-1.5 rounded-full',
              offline ? 'animate-pulse bg-destructive' : 'bg-emerald-500'
            )}
            aria-hidden
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className={cn(
          'w-80 overflow-hidden p-0 shadow-lg',
          offline ? 'border-destructive/25' : 'border-emerald-500/25'
        )}
      >
        <div
          className={cn(
            'relative px-4 pt-4 pb-3',
            offline ? 'bg-destructive/10' : 'bg-emerald-500/10'
          )}
        >
          {offline ? (
            <WifiOff
              className="pointer-events-none absolute -right-2 -bottom-3 h-24 w-24 text-destructive/10"
              aria-hidden
            />
          ) : (
            <Wifi
              className="pointer-events-none absolute -right-2 -bottom-3 h-24 w-24 text-emerald-500/10"
              aria-hidden
            />
          )}
          <div className="relative flex items-start gap-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm',
                offline
                  ? 'border-destructive/35 bg-destructive/15 text-destructive'
                  : 'border-emerald-500/35 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
              )}
            >
              {offline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium text-sm/snug tracking-tight">
                {offline ? t('onlineStatus.offlineTitle') : t('onlineStatus.onlineTitle')}
              </p>
              <p className="text-muted-foreground text-xs/relaxed">
                {offline
                  ? t('onlineStatus.offlineDescription')
                  : t('onlineStatus.onlineDescription')}
              </p>
            </div>
          </div>
        </div>

        {offline ? (
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[11px]/snug">{t('onlineStatus.lanTitle')}</p>
                <p className="text-[11px]/relaxed text-muted-foreground">
                  {t('onlineStatus.lanBody')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[11px]/snug">{t('onlineStatus.cloudTitle')}</p>
                <p className="text-[11px]/relaxed text-muted-foreground">
                  {t('onlineStatus.cloudBody')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-[11px]/relaxed text-emerald-900 dark:text-emerald-100/90">
              {t('onlineStatus.onlineGuidance')}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
