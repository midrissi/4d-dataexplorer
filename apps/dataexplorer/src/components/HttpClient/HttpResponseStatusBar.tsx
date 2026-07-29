import { cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { formatByteSize } from '~/lib/http-client'
import { isMobileShell } from '~/lib/platform'
import type { HttpClientResponse } from '~/store/http-client-types'

type HttpResponseStatusBarProps = {
  response: HttpClientResponse
}

export function HttpResponseStatusBar({ response }: HttpResponseStatusBarProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const failed = Boolean(response.error) || (response.status > 0 && response.status >= 400)

  const chip = cn(
    'rounded-md font-medium tabular-nums',
    mobile ? 'px-2.5 py-1.5 text-xs' : 'rounded px-2 py-0.5 text-[11px]'
  )

  return (
    <div
      className={cn('flex flex-wrap items-center', mobile ? 'gap-2' : 'gap-2')}
      role="status"
      aria-label={t('httpClient.responseStatusAria')}
    >
      {response.error ? (
        <span className={cn(chip, 'bg-destructive/15 font-semibold text-destructive')}>
          {t('httpClient.error')}
        </span>
      ) : (
        <span
          className={cn(
            chip,
            'font-semibold',
            failed ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'
          )}
        >
          {response.status} {response.statusText}
        </span>
      )}
      <span className={cn(chip, 'bg-muted text-muted-foreground')}>
        {response.durationMs.toFixed(0)} ms
      </span>
      <span className={cn(chip, 'bg-muted text-muted-foreground')}>
        {formatByteSize(response.sizeBytes)}
      </span>
      {response.contentType ? (
        <span
          className={cn(
            chip,
            'min-w-0 bg-muted text-muted-foreground',
            mobile ? 'max-w-full break-all' : 'max-w-55 truncate'
          )}
          title={response.contentType}
        >
          {response.contentType}
        </span>
      ) : null}
    </div>
  )
}
