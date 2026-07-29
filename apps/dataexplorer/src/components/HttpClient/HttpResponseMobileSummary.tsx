import { Button, cn } from '@4d/ui'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { HttpResponseStatusBar } from '~/components/HttpClient/HttpResponseStatusBar'
import { useTranslation } from '~/i18n'
import { formatByteSize } from '~/lib/http-client'
import type { HttpClientResponse } from '~/store/http-client-types'

type HttpResponseMobileSummaryProps = {
  response: HttpClientResponse
}

/**
 * Compact status strip for mobile: one glanceable line, with optional full details.
 */
export function HttpResponseMobileSummary({ response }: HttpResponseMobileSummaryProps) {
  const { t } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const failed = Boolean(response.error) || (response.status > 0 && response.status >= 400)

  const statusLabel = response.error
    ? t('httpClient.error')
    : `${response.status} ${response.statusText}`.trim()

  return (
    <div className="shrink-0 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          role="status"
          aria-label={t('httpClient.responseStatusAria')}
        >
          <span
            className={cn(
              'shrink-0 rounded-md px-2 py-1 font-semibold text-xs tabular-nums',
              response.error || failed
                ? 'bg-destructive/15 text-destructive'
                : 'bg-success/15 text-success'
            )}
          >
            {statusLabel}
          </span>
          {!response.error ? (
            <>
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {response.durationMs.toFixed(0)} ms
              </span>
              <span className="text-muted-foreground/50 text-xs" aria-hidden>
                ·
              </span>
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {formatByteSize(response.sizeBytes)}
              </span>
            </>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-1 px-2 text-muted-foreground"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {t('httpClient.details')}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', detailsOpen && 'rotate-180')}
            aria-hidden
          />
        </Button>
      </div>

      {detailsOpen ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
          <HttpResponseStatusBar response={response} />
        </div>
      ) : null}
    </div>
  )
}
