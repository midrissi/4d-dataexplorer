import { JobProgress, JobProgressCount } from '@4d/ui'
import { Download, ImageUp, Loader2, WandSparkles } from 'lucide-react'
import { useTranslation } from '~/i18n'

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
    <JobProgress
      className={className}
      icon={<Icon className={indeterminate ? 'size-3.5 animate-spin' : 'size-3.5'} />}
      label={
        uploading ? (
          <>
            <span>{t('entity.io.anonymizeImageLabel')}</span>
            <JobProgressCount>
              {t('entity.io.anonymizeProgressCount', { current, total })}
            </JobProgressCount>
          </>
        ) : (
          label
        )
      }
      labelKey={progress.phase}
      ariaLabel={label}
      current={current}
      total={total}
      indeterminate={indeterminate}
      onCancel={onCancel}
      cancelLabel={t('entity.cancel')}
    />
  )
}
