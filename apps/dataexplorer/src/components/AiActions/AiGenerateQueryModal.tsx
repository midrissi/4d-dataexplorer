import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@4d/ui'
import { Filter, Search, SortAsc } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { startGenerateQueryAiTask } from '~/lib/ai-task-runner'
import {
  AiModalShell,
  AiPrimaryButton,
  AiPromptField,
  type AiPromptFieldHandle,
} from './AiModalShell'
import { AiPromptExamples } from './AiPromptExamples'

type AiGenerateQueryModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataclassName: string
}

export function AiGenerateQueryModal({
  open,
  onOpenChange,
  dataclassName,
}: AiGenerateQueryModalProps) {
  const { t } = useTranslation()
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
      setError(t('query.generatePromptRequired'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await startGenerateQueryAiTask({
        dataclassName,
        prompt: trimmed,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-border p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">{t('query.generateTitle')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('query.generateSubtitle', { dataclass: dataclassName })}
        </DialogDescription>

        <AiModalShell
          icon={Filter}
          title={t('query.generateTitle')}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span>{t('query.generateSubtitleBefore')}</span>
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
                {submitting ? t('query.generating') : t('query.generateSubmit')}
              </AiPrimaryButton>
            </>
          }
        >
          <AiPromptField
            ref={promptRef}
            id="ai-generate-query-prompt"
            label={t('query.generatePrompt')}
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => void handleSubmit()}
            placeholder={t('query.generatePromptPlaceholder')}
            disabled={submitting}
            autoFocus
          />

          <AiPromptExamples
            kind="query"
            dataclassName={dataclassName}
            open={open}
            selectedPrompt={prompt}
            disabled={submitting}
            icons={[Filter, Search, SortAsc]}
            title={t('query.generateExamples')}
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
