import { cn } from '@4d/ui'
import { Download, Loader2, WandSparkles } from 'lucide-react'
import { useTranslation } from '~/i18n'
import './entity-io-anonymize-progress.css'

export type AnonymizeProgress = {
  phase: 'fetching' | 'anonymizing' | 'finalizing'
  current?: number
  total?: number
}

export function EntityIoAnonymizeProgress({
  progress,
  className,
}: {
  progress: AnonymizeProgress
  className?: string
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
        : t('entity.io.anonymizeFinalizing')
  const Icon =
    progress.phase === 'fetching'
      ? Download
      : progress.phase === 'anonymizing'
        ? WandSparkles
        : Loader2

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
        <span
          key={`${progress.phase}-${current}-${total}`}
          className="entity-io-anonymize-progress__label"
        >
          {label}
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
    </output>
  )
}
