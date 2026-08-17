import { JobProgress, JobProgressCount } from '@4d/ui'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from '~/i18n'

export type CreateEntityProgressState = {
  phase: 'emptying' | 'preparing' | 'creating' | 'refreshing'
  current?: number
  total?: number
}

export function CreateEntityProgress({
  progress,
  dataclassName,
  className,
  onCancel,
}: {
  progress: CreateEntityProgressState
  dataclassName: string
  className?: string
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const current = progress.current ?? 0
  const total = progress.total ?? 0
  const indeterminate = progress.phase === 'emptying' || progress.phase === 'refreshing'
  const shortLabel =
    progress.phase === 'emptying'
      ? t('createEntity.progressEmptying', { dataclass: dataclassName })
      : progress.phase === 'preparing'
        ? t('createEntity.progressPreparing')
        : progress.phase === 'creating'
          ? t('createEntity.progressCreating')
          : t('createEntity.progressRefreshing')
  const ariaLabel =
    indeterminate || total <= 0
      ? shortLabel
      : t('createEntity.progressWithCount', { label: shortLabel, current, total })
  const Icon =
    progress.phase === 'emptying'
      ? Trash2
      : progress.phase === 'refreshing'
        ? RefreshCw
        : progress.phase === 'preparing'
          ? Loader2
          : Plus

  return (
    <JobProgress
      className={className}
      icon={
        <Icon
          className={
            indeterminate || progress.phase === 'preparing' ? 'size-3.5 animate-spin' : 'size-3.5'
          }
        />
      }
      label={
        indeterminate ? (
          shortLabel
        ) : (
          <>
            <span>{shortLabel}</span>
            <JobProgressCount>
              {t('createEntity.progressCount', { current, total })}
            </JobProgressCount>
          </>
        )
      }
      labelKey={progress.phase}
      ariaLabel={ariaLabel}
      current={current}
      total={total}
      indeterminate={indeterminate}
      onCancel={onCancel}
      cancelLabel={t('createEntity.cancel')}
    />
  )
}
