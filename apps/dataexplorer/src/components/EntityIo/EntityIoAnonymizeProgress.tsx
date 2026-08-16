import { Button, cn } from '@4d/ui'
import { Download, ImageUp, Loader2, WandSparkles, X } from 'lucide-react'
import { useTranslation } from '~/i18n'
import './entity-io-anonymize-progress.css'

export type AnonymizeProgress = {
  phase: 'fetching' | 'anonymizing' | 'uploading' | 'finalizing'
  current?: number
  total?: number
}

export function EntityIoAnonymizeProgress({
  progress,
  className,
  onCancel,
}: {
  progress: AnonymizeProgress
  className?: string
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const indeterminate = progress.phase === 'finalizing'
  const current = progress.current ?? 0
  const total = progress.total ?? 0
  const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0
  const label =
    progress.phase === 'fetching'
      ? t('entity.io.progress', { fetched: current, total: total || '…' })
      : progress.phase === 'anonymizing'
        ? t('entity.io.anonymizeProgress', { current, total })
        : progress.phase === 'uploading'
          ? t('entity.io.anonymizeImageProgress', { current, total })
          : t('entity.io.anonymizeFinalizing')
  const Icon =
    progress.phase === 'fetching'
      ? Download
      : progress.phase === 'anonymizing'
        ? WandSparkles
        : progress.phase === 'uploading'
          ? ImageUp
          : Loader2
  const uploading = progress.phase === 'uploading'

  return (
    <output
      className={cn('entity-io-anonymize-progress', className)}
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <span className="entity-io-anonymize-progress__icon" aria-hidden>
        <Icon className={cn('size-3.5', indeterminate && 'animate-spin')} />
      </span>
      <span className="entity-io-anonymize-progress__content">
        <span key={progress.phase} className="entity-io-anonymize-progress__label">
          {uploading ? (
            <>
              <span>{t('entity.io.anonymizeImageLabel')}</span>
              <span className="entity-io-anonymize-progress__count">
                {t('entity.io.anonymizeProgressCount', { current, total })}
              </span>
            </>
          ) : (
            label
          )}
        </span>
        <span
          className={cn(
            'entity-io-anonymize-progress__track',
            indeterminate && 'entity-io-anonymize-progress__track--indeterminate'
          )}
          aria-hidden
        >
          <span
            className="entity-io-anonymize-progress__fill"
            style={indeterminate ? undefined : { width: `${percent}%` }}
          />
        </span>
      </span>
      {onCancel ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onCancel}
          aria-label={t('entity.cancel')}
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </output>
  )
}
