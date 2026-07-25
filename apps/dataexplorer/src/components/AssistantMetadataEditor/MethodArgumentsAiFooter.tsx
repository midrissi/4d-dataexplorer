import { cn } from '@4d/ui'
import { Loader2, Sparkles } from 'lucide-react'
import { useTranslation } from '~/i18n'

type AiGenerateFooterProps = {
  onGenerate?: () => void | Promise<void>
  aiEnabled: boolean
  generating?: boolean
  tooltip?: string
  ariaLabel?: string
}

export function AiGenerateFooter({
  onGenerate,
  aiEnabled,
  generating = false,
  tooltip,
  ariaLabel,
}: AiGenerateFooterProps) {
  const { t } = useTranslation()

  if (!onGenerate) return null

  return (
    <button
      type="button"
      className={cn('method-args__generate', !aiEnabled && 'method-args__generate--disabled')}
      disabled={!aiEnabled || generating}
      onClick={() => void onGenerate()}
      aria-label={ariaLabel ?? t('assistantMetadata.generateArguments')}
      title={
        tooltip ??
        (aiEnabled
          ? t('assistantMetadata.generateArgumentsHint')
          : t('assistantMetadata.aiNotConfigured'))
      }
    >
      {generating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      <span>
        {generating ? t('assistantMetadata.generating') : t('assistantMetadata.generateArguments')}
      </span>
    </button>
  )
}
