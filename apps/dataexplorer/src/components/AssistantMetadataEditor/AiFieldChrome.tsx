import {
  cn,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Loader2, Sparkles } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from '~/i18n'
import './assistant-metadata-editor.css'

const aiFieldControlReset =
  'ai-field__control border-0 bg-transparent shadow-none rounded-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0'

type AiActionProps = {
  onGenerate?: () => void | Promise<void>
  aiEnabled: boolean
  generating?: boolean
  tooltip?: string
  ariaLabel?: string
  variant: 'inline' | 'chip' | 'overlay'
  showLabel?: boolean
}

function AiGenerateAction({
  onGenerate,
  aiEnabled,
  generating = false,
  tooltip,
  ariaLabel,
  variant,
  showLabel = false,
}: AiActionProps) {
  const { t } = useTranslation()

  if (!onGenerate) return null

  const resolvedTooltip =
    tooltip ??
    (aiEnabled ? t('assistantMetadata.generateWithAiHint') : t('assistantMetadata.aiNotConfigured'))

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'ai-field__action',
              variant === 'inline' && 'ai-field__action--inline',
              variant === 'chip' && 'ai-field__action--chip',
              variant === 'overlay' && 'ai-field__action--overlay ai-field__action--chip'
            )}
            disabled={!aiEnabled || generating}
            onClick={() => void onGenerate()}
            aria-label={ariaLabel ?? t('assistantMetadata.generateWithAi')}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
            {showLabel ? (
              <span>
                {generating
                  ? t('assistantMetadata.generating')
                  : t('assistantMetadata.generateWithAi')}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56 text-xs">
          {resolvedTooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

type AiInputFieldProps = Omit<ComponentProps<typeof Input>, 'className'> & {
  className?: string
  onGenerate?: () => void | Promise<void>
  aiEnabled: boolean
  generating?: boolean
}

export function AiInputField({
  className,
  onGenerate,
  aiEnabled,
  generating,
  ...inputProps
}: AiInputFieldProps) {
  return (
    <div className={cn('ai-field flex min-w-0 items-stretch', className)}>
      <Input
        {...inputProps}
        className={cn(aiFieldControlReset, 'h-6 min-w-0 flex-1 px-2 py-0 text-xs md:text-xs')}
      />
      {onGenerate ? (
        <>
          <div className="ai-field__divider" aria-hidden />
          <AiGenerateAction
            variant="inline"
            onGenerate={onGenerate}
            aiEnabled={aiEnabled}
            generating={generating}
          />
        </>
      ) : null}
    </div>
  )
}

type AiTextareaFieldProps = Omit<ComponentProps<typeof Textarea>, 'className'> & {
  className?: string
  onGenerate?: () => void | Promise<void>
  aiEnabled: boolean
  generating?: boolean
}

export function AiTextareaField({
  className,
  onGenerate,
  aiEnabled,
  generating,
  ...textareaProps
}: AiTextareaFieldProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('ai-field ai-field--textarea flex flex-col', className)}>
      <Textarea
        {...textareaProps}
        className={cn(aiFieldControlReset, 'min-h-[5.5rem] resize-y px-3 py-2 text-sm md:text-sm')}
      />
      {onGenerate ? (
        <div className="ai-field__footer">
          <span className="ai-field__hint">{t('assistantMetadata.aiFieldHint')}</span>
          <AiGenerateAction
            variant="chip"
            showLabel
            onGenerate={onGenerate}
            aiEnabled={aiEnabled}
            generating={generating}
          />
        </div>
      ) : null}
    </div>
  )
}

type AiEditorFieldProps = {
  children: ReactNode
  className?: string
  onGenerate?: () => void | Promise<void>
  aiEnabled: boolean
  generating?: boolean
  tooltip?: string
  ariaLabel?: string
}

export function AiEditorField({
  children,
  className,
  onGenerate,
  aiEnabled,
  generating,
  tooltip,
  ariaLabel,
}: AiEditorFieldProps) {
  return (
    <div className={cn('ai-field ai-field--editor', className)}>
      {children}
      <AiGenerateAction
        variant="overlay"
        showLabel
        onGenerate={onGenerate}
        aiEnabled={aiEnabled}
        generating={generating}
        tooltip={tooltip}
        ariaLabel={ariaLabel}
      />
    </div>
  )
}
