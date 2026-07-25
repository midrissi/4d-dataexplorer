import { ClickToCopy, cn } from '@4d/ui'
import {
  ArrowRight,
  Ban,
  Copy,
  GlobeLock,
  Link2Off,
  Monitor,
  ShieldAlert,
  Terminal,
  Unplug,
} from 'lucide-react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import type {
  HttpClientNetworkErrorHint,
  HttpClientNetworkErrorInfo,
  HttpClientResponse,
} from '~/store/http-client-types'

const hintToneClass: Record<HttpClientNetworkErrorHint['tone'], string> = {
  amber: 'border-amber-500/30 bg-amber-500/8 text-amber-950 dark:text-amber-100',
  destructive: 'border-destructive/30 bg-destructive/8 text-destructive',
  muted: 'border-border/70 bg-muted/40 text-muted-foreground',
}

function kindIcon(kind: HttpClientNetworkErrorInfo['kind']) {
  switch (kind) {
    case 'cancelled':
      return Ban
    case 'cors':
      return GlobeLock
    case 'mixed-content':
      return ShieldAlert
    case 'network':
      return Unplug
    default:
      return Link2Off
  }
}

function hintIcon(id: HttpClientNetworkErrorHint['id']) {
  switch (id) {
    case 'cors':
      return GlobeLock
    case 'mixed-content':
      return ShieldAlert
    case 'console':
      return Terminal
    case 'desktop':
      return Monitor
  }
}

function hintCopy(
  id: HttpClientNetworkErrorHint['id'],
  t: ReturnType<typeof useTranslation>['t']
): { title: string; body: string } {
  switch (id) {
    case 'cors':
      return {
        title: t('httpClient.errorCorsTitle'),
        body: t('httpClient.errorCorsBody'),
      }
    case 'mixed-content':
      return {
        title: t('httpClient.errorMixedTitle'),
        body: t('httpClient.errorMixedBody'),
      }
    case 'console':
      return {
        title: t('httpClient.errorConsoleTitle'),
        body: t('httpClient.errorConsoleBody'),
      }
    case 'desktop':
      return {
        title: t('httpClient.errorDesktopTitle'),
        body: t('httpClient.webLimitation'),
      }
  }
}

function kindTitle(
  info: HttpClientNetworkErrorInfo,
  t: ReturnType<typeof useTranslation>['t']
): string {
  switch (info.kind) {
    case 'cancelled':
      return t('httpClient.errorCancelledTitle')
    case 'cors':
      return t('httpClient.errorCorsHeadline')
    case 'mixed-content':
      return t('httpClient.errorMixedHeadline')
    case 'network':
      return t('httpClient.errorNetworkHeadline')
    default:
      return info.title || t('httpClient.error')
  }
}

export function HttpResponseErrorBody({
  response,
  className,
}: {
  response: HttpClientResponse
  className?: string
}) {
  const { t } = useTranslation()
  const info = response.errorInfo
  const raw = response.error ?? ''

  if (!info) {
    return (
      <EmptyPanel
        icon={Link2Off}
        badgeTone="muted"
        title={t('httpClient.error')}
        description={raw || t('httpClient.errorUnknownBody')}
        ghost="none"
        bordered
        size="md"
        className={cn('h-full', className)}
      />
    )
  }

  const Icon = kindIcon(info.kind)
  const headline = kindTitle(info, t)
  const showOrigins =
    Boolean(info.pageOrigin && info.targetOrigin) && info.pageOrigin !== info.targetOrigin

  return (
    <div className={cn('relative h-full min-h-0 overflow-auto', className)}>
      <div className="relative flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-destructive/25 bg-destructive/10 shadow-[0_0_0_1px_hsl(var(--destructive)/0.08)]">
              <Icon className="h-5 w-5 text-destructive" />
            </div>
            <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-destructive text-[9px] text-destructive-foreground shadow-sm">
              !
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-destructive/15 px-2 py-0.5 font-semibold text-[10px] text-destructive uppercase tracking-wide">
                {t('httpClient.error')}
              </span>
              {info.name ? (
                <span className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {info.name}
                </span>
              ) : null}
              {info.kind !== 'unknown' && info.kind !== 'cancelled' ? (
                <span className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                  {info.kind.replace('-', ' ')}
                </span>
              ) : null}
            </div>
            <h3 className="font-semibold text-foreground text-sm leading-snug">{headline}</h3>
            {info.message && info.message !== headline ? (
              <p className="font-mono text-muted-foreground text-xs leading-relaxed">
                {info.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border/80 bg-background/70 shadow-sm backdrop-blur-sm">
          <div className="border-border/60 border-b bg-muted/30 px-3 py-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
            {t('httpClient.errorRequestDetails')}
          </div>
          <div className="divide-y divide-border/60">
            {info.url ? (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <span className="w-16 shrink-0 pt-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t('httpClient.errorUrl')}
                </span>
                <div className="min-w-0 flex-1">
                  <ClickToCopy
                    value={info.url}
                    tooltipLabel={t('common.clickToCopy')}
                    tooltipCopiedLabel={t('common.copied')}
                    className="group inline-flex max-w-full items-start gap-1.5 rounded-md text-left"
                  >
                    <span className="break-all font-mono text-foreground text-xs leading-relaxed">
                      {info.url}
                    </span>
                    <Copy className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </ClickToCopy>
                </div>
              </div>
            ) : null}

            {showOrigins ? (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <span className="w-16 shrink-0 pt-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t('httpClient.errorOrigins')}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <span className="max-w-full truncate rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground">
                    {info.pageOrigin}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="max-w-full truncate rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[11px] text-foreground">
                    {info.targetOrigin}
                  </span>
                </div>
              </div>
            ) : null}

            {info.causes.length > 0 ? (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <span className="w-16 shrink-0 pt-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t('httpClient.errorCause')}
                </span>
                <ul className="min-w-0 flex-1 space-y-1">
                  {info.causes.map((cause) => (
                    <li
                      key={cause}
                      className="break-all font-mono text-muted-foreground text-xs leading-relaxed"
                    >
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {info.hints.length > 0 ? (
          <div className="space-y-2">
            <div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
              {t('httpClient.errorWhatNext')}
            </div>
            {info.hints.map((hint) => {
              const HintIcon = hintIcon(hint.id)
              const copy = hintCopy(hint.id, t)
              return (
                <div
                  key={hint.id}
                  className={cn(
                    'flex gap-2.5 rounded-md border px-3 py-2.5',
                    hintToneClass[hint.tone]
                  )}
                >
                  <HintIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-medium text-foreground text-xs">{copy.title}</div>
                    <p className="text-[11px] leading-relaxed opacity-90">{copy.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
