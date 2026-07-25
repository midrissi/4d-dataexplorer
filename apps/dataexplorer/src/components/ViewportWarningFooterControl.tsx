import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import { Columns3, Maximize2, Monitor, PanelsLeftRight, Scaling, Scan } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from '~/i18n'

/** Minimum comfortable viewport width for the list + detail workspace. */
export const VIEWPORT_MIN_WIDTH = 1800

function subscribe(listener: () => void) {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

function getWidthSnapshot() {
  return window.innerWidth
}

function getServerSnapshot() {
  return VIEWPORT_MIN_WIDTH
}

/**
 * Status-bar control shown when the window is narrower than the recommended
 * Data Explorer workspace width. Popover mirrors the TLS trust warning chrome.
 */
export function ViewportWarningFooterControl() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const width = useSyncExternalStore(subscribe, getWidthSnapshot, getServerSnapshot)

  if (width >= VIEWPORT_MIN_WIDTH) return null

  const shortfall = VIEWPORT_MIN_WIDTH - width
  const formatPx = (n: number) => n.toLocaleString()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            'relative h-6 gap-1.5 px-2 text-[11px]',
            'border border-amber-500/25 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15',
            'dark:text-amber-200'
          )}
          aria-label={t('viewportWarning.toolbarAria')}
          aria-expanded={open}
          title={t('viewportWarning.toolbarTooltip')}
        >
          <Scaling className="h-3 w-3" />
          <span>{t('viewportWarning.toolbarLabel')}</span>
          <span
            className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500"
            aria-hidden
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-88 overflow-hidden border-amber-500/25 p-0 shadow-lg"
      >
        <div className="relative bg-amber-500/10 px-4 pt-4 pb-3">
          <Monitor
            className="pointer-events-none absolute -right-2 -bottom-3 h-24 w-24 text-amber-500/10"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/15 text-amber-600 shadow-sm dark:text-amber-300">
              <Scan className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium text-sm/snug tracking-tight">
                {t('viewportWarning.title')}
              </p>
              <p className="text-muted-foreground text-xs/relaxed">
                {t('viewportWarning.description')}
              </p>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-2 gap-2">
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-amber-500/25 bg-background px-2.5">
              <PanelsLeftRight className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0">
                <p className="text-[10px]/none text-muted-foreground uppercase tracking-wide">
                  {t('viewportWarning.currentLabel')}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px]/tight tabular-nums">
                  {t('viewportWarning.pixels', { value: formatPx(width) })}
                </p>
              </div>
            </div>
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-amber-500/25 bg-background px-2.5">
              <Maximize2 className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0">
                <p className="text-[10px]/none text-muted-foreground uppercase tracking-wide">
                  {t('viewportWarning.requiredLabel')}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px]/tight text-amber-800 tabular-nums dark:text-amber-200">
                  {t('viewportWarning.pixels', { value: formatPx(VIEWPORT_MIN_WIDTH) })}
                </p>
              </div>
            </div>
          </div>

          <div
            className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-amber-500/15"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-amber-500/70"
              style={{ width: `${Math.min(100, (width / VIEWPORT_MIN_WIDTH) * 100)}%` }}
            />
          </div>
          <p className="relative mt-1.5 font-mono text-[10px]/none text-muted-foreground tabular-nums">
            {t('viewportWarning.shortfall', { value: formatPx(shortfall) })}
          </p>
        </div>

        <div className="space-y-3 px-4 py-3">
          <ul className="space-y-2">
            <li className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <Columns3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[11px]/snug">{t('viewportWarning.crowdedTitle')}</p>
                <p className="text-[11px]/relaxed text-muted-foreground">
                  {t('viewportWarning.crowdedBody')}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[11px]/snug">{t('viewportWarning.roomTitle')}</p>
                <p className="text-[11px]/relaxed text-muted-foreground">
                  {t('viewportWarning.roomBody')}
                </p>
              </div>
            </li>
          </ul>

          <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px]/relaxed text-amber-900 dark:text-amber-100/90">
            {t('viewportWarning.guidance')}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
