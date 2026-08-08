import { cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import {
  contentTypeFromHeaders,
  isFailedHttpStatus,
  type MethodResponseMeta,
} from './method-response-meta'

export function MethodResponseStatusBar({ meta }: { meta: MethodResponseMeta }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const failed = isFailedHttpStatus(meta.status)
  const contentType = contentTypeFromHeaders(meta.headers)
  const chip = cn(
    'rounded-md font-medium tabular-nums',
    mobile ? 'px-2.5 py-1.5 text-xs' : 'rounded px-2 py-0.5 text-[11px]'
  )

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="status"
      aria-label={t('httpClient.responseStatusAria')}
    >
      <span
        className={cn(
          chip,
          'font-semibold',
          failed ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'
        )}
      >
        {meta.status} {meta.statusText}
      </span>
      <span className={cn(chip, 'bg-muted text-muted-foreground')}>
        {meta.durationMs.toFixed(0)} ms
      </span>
      {contentType ? (
        <span
          className={cn(
            chip,
            'min-w-0 bg-muted text-muted-foreground',
            mobile ? 'max-w-full break-all' : 'max-w-55 truncate'
          )}
          title={contentType}
        >
          {contentType}
        </span>
      ) : null}
    </div>
  )
}
