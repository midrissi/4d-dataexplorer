import { cn } from '@4d/ui'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { GenerateAllDescriptionsProgress } from '~/lib/generate-all-metadata-descriptions'
import './assistant-metadata-editor.css'

type GenerateAllProgressProps = {
  bulkProgress?: GenerateAllDescriptionsProgress | null
  fieldLabel?: string
  onCancel: () => void
  className?: string
}

export function GenerateAllProgress({
  bulkProgress,
  fieldLabel,
  onCancel,
  className,
}: GenerateAllProgressProps) {
  const { t } = useTranslation()

  const isBulk = bulkProgress !== undefined
  const current = bulkProgress?.current ?? 0
  const total = bulkProgress?.total ?? 0
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  const indeterminate = isBulk ? !bulkProgress || total === 0 : true

  const label = isBulk
    ? bulkProgress
      ? `${t(`assistantMetadata.taskType.${bulkProgress.task.type}`)} · ${bulkProgress.task.label}`
      : t('assistantMetadata.generateAllStarting')
    : (fieldLabel ?? t('assistantMetadata.generating'))

  return (
    <output
      className={cn('ai-generate-all-progress', className)}
      aria-live="polite"
      aria-busy="true"
      aria-label={
        isBulk && bulkProgress
          ? t('assistantMetadata.generateAllProgress', {
              current: bulkProgress.current,
              total: bulkProgress.total,
              label: bulkProgress.task.label,
            })
          : (fieldLabel ?? t('assistantMetadata.generating'))
      }
    >
      <span className="ai-generate-all-progress__icon" aria-hidden>
        {indeterminate ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
        )}
      </span>

      {isBulk && bulkProgress && total > 0 ? (
        <span className="ai-generate-all-progress__count">
          {t('assistantMetadata.generateAllProgressCount', { current, total })}
        </span>
      ) : null}

      <span
        key={
          isBulk && bulkProgress ? `${bulkProgress.current}-${bulkProgress.task.label}` : fieldLabel
        }
        className="ai-generate-all-progress__label"
      >
        {label}
      </span>

      <span
        className={cn(
          'ai-generate-all-progress__track',
          indeterminate && 'ai-generate-all-progress__track--indeterminate'
        )}
        aria-hidden
      >
        <span
          className="ai-generate-all-progress__fill"
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </span>

      <button
        type="button"
        className="ai-generate-all-progress__cancel"
        onClick={onCancel}
        aria-label={t('assistantMetadata.generateAllCancel')}
        title={t('assistantMetadata.generateAllCancel')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </output>
  )
}
