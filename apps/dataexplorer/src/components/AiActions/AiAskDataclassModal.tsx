import { Button, cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@4d/ui'
import { Filter, Info, MessageCircle, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { startAskAiTask } from '~/lib/ai-task-runner'
import { isMobileShell } from '~/lib/platform'
import { useAiTasksStore } from '~/store/ai-tasks'
import {
  AiModalShell,
  AiPrimaryButton,
  AiPromptField,
  type AiPromptFieldHandle,
} from './AiModalShell'
import { AiPromptExamples } from './AiPromptExamples'

type AiAskDataclassModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataclassName: string
}

export function AiAskDataclassModal({
  open,
  onOpenChange,
  dataclassName,
}: AiAskDataclassModalProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const openTask = useAiTasksStore((state) => state.openTask)
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promptRef = useRef<AiPromptFieldHandle>(null)

  useEffect(() => {
    if (!open) return
    setPrompt('')
    setError(null)
    setSubmitting(false)
  }, [open])

  const handleSubmit = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError(t('aiActions.askPromptRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const taskId = await startAskAiTask({
        dataclassName,
        prompt: trimmed,
      })
      onOpenChange(false)
      openTask(taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden border-border p-0',
          mobile
            ? 'inset-0 top-0 left-0 h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 rounded-none border-0'
            : 'max-w-lg sm:rounded-2xl'
        )}
      >
        <DialogTitle className="sr-only">{t('aiActions.askTitle')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('aiActions.askSubtitle', { dataclass: dataclassName })}
        </DialogDescription>

        <AiModalShell
          icon={MessageCircle}
          title={t('aiActions.askTitle')}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span>{t('aiActions.askSubtitleBefore')}</span>
              <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-1.5 py-px font-medium font-mono text-[11px] text-primary">
                {dataclassName}
              </span>
            </span>
          }
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <AiPrimaryButton
                loading={submitting}
                disabled={!prompt.trim()}
                onClick={() => void handleSubmit()}
              >
                {t('aiActions.startAsk')}
              </AiPrimaryButton>
            </>
          }
        >
          <AiPromptField
            ref={promptRef}
            id="ai-ask-prompt"
            label={t('aiActions.askPrompt')}
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => void handleSubmit()}
            placeholder={t('aiActions.askPromptPlaceholder')}
            disabled={submitting}
            autoFocus
          />

          <AiPromptExamples
            kind="ask"
            dataclassName={dataclassName}
            open={open}
            selectedPrompt={prompt}
            disabled={submitting}
            icons={[Filter, Info, Trash2]}
            title={t('aiActions.examples')}
            onSelect={(example) => {
              setPrompt(example)
              setError(null)
              requestAnimationFrame(() => promptRef.current?.focus())
            }}
          />

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-destructive text-xs">
              {error}
            </p>
          ) : null}
        </AiModalShell>
      </DialogContent>
    </Dialog>
  )
}
