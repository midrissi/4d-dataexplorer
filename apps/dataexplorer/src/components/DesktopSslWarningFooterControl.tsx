import { Button, cn, Popover, PopoverContent, PopoverTrigger } from '@4d/ui'
import { EyeOff, KeyRound, LockKeyhole, ShieldAlert, ShieldOff, Unplug } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from '~/i18n'
import { getBaseUrl, getSkipSSL, isDesktop, onConnectionChange } from '~/lib/platform'

function isLocalDevHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '::1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    )
  } catch {
    return false
  }
}

function subscribe(listener: () => void) {
  return onConnectionChange(listener)
}

function getSkipSnapshot() {
  return getSkipSSL()
}

function getBaseUrlSnapshot() {
  return getBaseUrl()
}

/**
 * Status-bar control shown while the active desktop connection skips TLS
 * certificate verification (explicit toggle or local HTTPS host).
 */
export function DesktopSslWarningFooterControl() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const skipSSL = useSyncExternalStore(subscribe, getSkipSnapshot, () => false)
  const baseUrl = useSyncExternalStore(subscribe, getBaseUrlSnapshot, () => '')

  if (!isDesktop()) return null

  const isHttps = baseUrl.startsWith('https:')
  const localHost = Boolean(baseUrl) && isLocalDevHost(baseUrl)
  const verificationOff = skipSSL || (isHttps && localHost)
  if (!verificationOff) return null

  let hostLabel = baseUrl
  try {
    hostLabel = new URL(baseUrl).host
  } catch {
    // keep raw baseUrl
  }

  const reason = skipSSL ? t('sslWarning.reasonExplicit') : t('sslWarning.reasonLocal')

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
          aria-label={t('sslWarning.toolbarAria')}
          aria-expanded={open}
          title={t('sslWarning.toolbarTooltip')}
        >
          <ShieldAlert className="h-3 w-3" />
          <span>{t('sslWarning.toolbarLabel')}</span>
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
          <ShieldOff
            className="pointer-events-none absolute -right-2 -bottom-3 h-24 w-24 text-amber-500/10"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/15 text-amber-600 shadow-sm dark:text-amber-300">
              <ShieldOff className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium text-sm/snug tracking-tight">{t('sslWarning.title')}</p>
              <p className="text-muted-foreground text-xs/relaxed">{t('sslWarning.description')}</p>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-2 gap-2">
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-amber-500/25 bg-background px-2.5">
              <Unplug className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0">
                <p className="text-[10px]/none text-muted-foreground uppercase tracking-wide">
                  {t('sslWarning.hostLabel')}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px]/tight tabular-nums">
                  {hostLabel}
                </p>
              </div>
            </div>
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-amber-500/25 bg-background px-2.5">
              <EyeOff className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0">
                <p className="text-[10px]/none text-muted-foreground uppercase tracking-wide">
                  {t('sslWarning.reasonLabel')}
                </p>
                <p className="mt-0.5 truncate text-[11px]/tight text-amber-800 dark:text-amber-200">
                  {reason}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <ul className="space-y-2">
            <li className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[11px]/snug">
                  {t('sslWarning.stillEncryptedTitle')}
                </p>
                <p className="text-[11px]/relaxed text-muted-foreground">
                  {t('sslWarning.stillEncryptedBody')}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[11px]/snug">{t('sslWarning.trustOffTitle')}</p>
                <p className="text-[11px]/relaxed text-muted-foreground">
                  {t('sslWarning.trustOffBody')}
                </p>
              </div>
            </li>
          </ul>

          <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px]/relaxed text-amber-900 dark:text-amber-100/90">
            {t('sslWarning.guidance')}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
