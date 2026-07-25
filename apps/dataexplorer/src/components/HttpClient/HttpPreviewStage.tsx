import { cn } from '@4d/ui'
import { FileText, Globe, Image as ImageIcon, Lock, MonitorPlay } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from '~/i18n'

export type HttpPreviewStageKind = 'html' | 'image' | 'video' | 'audio' | 'pdf' | 'other'

type HttpPreviewStageProps = {
  children: ReactNode
  className?: string
  /** Displayed in the chrome URL / path line. */
  url?: string | null
  /** Primary label, e.g. “Binary response”. */
  title?: string | null
  /** Secondary meta, e.g. “184.0 KB · image/png”. */
  meta?: string | null
  /** Format chip, e.g. PNG / HTML / MP4. */
  badge?: string | null
  kind?: HttpPreviewStageKind
  /** Extra controls on the right of the chrome bar. */
  actions?: ReactNode
  /** Expandable details panel under the chrome. */
  details?: ReactNode
  contentClassName?: string
}

function StageIcon({ kind }: { kind: HttpPreviewStageKind }) {
  if (kind === 'image') return <ImageIcon className="h-3.5 w-3.5" />
  if (kind === 'video' || kind === 'audio') return <MonitorPlay className="h-3.5 w-3.5" />
  if (kind === 'html') return <Globe className="h-3.5 w-3.5" />
  if (kind === 'pdf') return <FileText className="h-3.5 w-3.5" />
  return <Lock className="h-3.5 w-3.5" />
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = `${parsed.pathname}${parsed.search}`
    const hostPath = `${parsed.host}${path === '/' ? '' : path}`
    return hostPath.length > 64 ? `${hostPath.slice(0, 61)}…` : hostPath
  } catch {
    return url.length > 64 ? `${url.slice(0, 61)}…` : url
  }
}

/**
 * Framed preview surface for HTTP Client HTML / media responses —
 * soft stage backdrop + compact browser chrome (optionally merged with binary meta).
 */
export function HttpPreviewStage({
  children,
  className,
  url,
  title,
  meta,
  badge,
  kind = 'other',
  actions,
  details,
  contentClassName,
}: HttpPreviewStageProps) {
  const { t } = useTranslation()
  const urlLabel = url ? shortenUrl(url) : t('httpClient.previewStageUntitled')
  const hasMetaBlock = Boolean(title || meta)

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border/80',
        'bg-muted/25 shadow-xs',
        className
      )}
    >
      <div className="relative z-10 shrink-0 border-border/70 border-b bg-background/75 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex items-center gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-muted-foreground/35" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-border/60 bg-muted/40 px-2 py-0.5">
            <span className="shrink-0 text-muted-foreground">
              <StageIcon kind={kind} />
            </span>
            <div className="min-w-0 flex-1">
              {hasMetaBlock ? (
                <>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {title ? (
                      <span className="truncate font-medium text-foreground text-xs">{title}</span>
                    ) : null}
                    {badge ? (
                      <span className="shrink-0 rounded-full border border-border/50 bg-background/80 px-1.5 py-px font-mono text-[9px] text-muted-foreground uppercase tracking-wide">
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    {meta ? <span className="truncate">{meta}</span> : null}
                    {meta && url ? <span className="shrink-0 opacity-50">·</span> : null}
                    <span
                      className="min-w-0 truncate font-mono tracking-tight"
                      title={url ?? undefined}
                    >
                      {urlLabel}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-tight">
                    {urlLabel}
                  </span>
                  {badge ? (
                    <span className="shrink-0 rounded border border-border/50 bg-background/80 px-1.5 py-0.5 font-medium text-[9px] text-foreground/80 uppercase tracking-wider">
                      {badge}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
        </div>

        {details ? (
          <div className="border-border/60 border-t bg-background/50 px-3 py-2.5">{details}</div>
        ) : null}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2.5 pt-2">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-background shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent),0_12px_32px_-16px_color-mix(in_oklab,var(--foreground)_35%,transparent)]',
            kind === 'image' && 'http-preview-checkerboard',
            kind === 'html' && 'bg-white',
            kind === 'video' && 'bg-black',
            kind === 'audio' && 'bg-muted/30',
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
