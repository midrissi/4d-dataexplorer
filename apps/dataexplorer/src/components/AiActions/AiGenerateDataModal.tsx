import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Database, Filter, Layers, Minimize2, Sparkles, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { AI_GENERATE_STYLES } from '~/lib/ai-actions'
import { startGenerateAiTask } from '~/lib/ai-task-runner'
import { isMobileShell } from '~/lib/platform'
import type { AiGenerateStyle } from '~/store/ai-tasks'
import { useAiTasksStore } from '~/store/ai-tasks'
import {
  AiModalShell,
  AiPrimaryButton,
  AiPromptField,
  type AiPromptFieldHandle,
} from './AiModalShell'
import { AiPromptExamples } from './AiPromptExamples'

const MIN_COUNT = 1
const MAX_COUNT = 200
const DEFAULT_COUNT = 5
const COUNT_PRESETS = [5, 10, 25] as const

const STYLE_ICONS: Record<AiGenerateStyle, typeof Sparkles> = {
  realistic: Sparkles,
  'edge-cases': Zap,
  minimal: Minimize2,
}

type AiGenerateDataModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataclassName: string
}

export function AiGenerateDataModal({
  open,
  onOpenChange,
  dataclassName,
}: AiGenerateDataModalProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const openTask = useAiTasksStore((state) => state.openTask)
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [prompt, setPrompt] = useState('')
  const [styles, setStyles] = useState<AiGenerateStyle[]>(['realistic'])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promptRef = useRef<AiPromptFieldHandle>(null)

  useEffect(() => {
    if (!open) return
    setCount(DEFAULT_COUNT)
    setPrompt('')
    setStyles(['realistic'])
    setError(null)
    setSubmitting(false)
  }, [open])

  const toggleStyle = (style: AiGenerateStyle) => {
    setStyles((current) =>
      current.includes(style) ? current.filter((item) => item !== style) : [...current, style]
    )
  }

  const handleSubmit = async () => {
    const clamped = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count) || DEFAULT_COUNT))
    setSubmitting(true)
    setError(null)
    try {
      const taskId = await startGenerateAiTask({
        dataclassName,
        count: clamped,
        prompt,
        styles,
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
        <DialogTitle className="sr-only">{t('aiActions.generateTitle')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('aiActions.generateSubtitle', { dataclass: dataclassName })}
        </DialogDescription>

        <AiModalShell
          icon={Database}
          title={t('aiActions.generateTitle')}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span>{t('aiActions.generateSubtitleBefore')}</span>
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
              <AiPrimaryButton loading={submitting} onClick={() => void handleSubmit()}>
                {t('aiActions.startGenerate')}
              </AiPrimaryButton>
            </>
          }
        >
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="ai-generate-count" className="font-medium text-xs">
                {t('aiActions.count')}
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {t('aiActions.countHint', { min: MIN_COUNT, max: MAX_COUNT })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {COUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={submitting}
                  onClick={() => setCount(preset)}
                  className={cn(
                    'h-7 min-w-9 rounded-md border px-2 font-medium text-xs transition-all',
                    count === preset
                      ? 'border-primary/40 bg-primary/15 text-primary shadow-sm'
                      : 'border-border/70 bg-background/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
                  )}
                >
                  {preset}
                </button>
              ))}
              <div className="relative min-w-0 flex-1">
                <Layers className="pointer-events-none absolute top-1/2 left-2 z-10 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="ai-generate-count"
                  type="number"
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  disabled={submitting}
                  className="h-7 w-20 rounded-md border border-border/80 bg-background/80 py-0 pr-0 pl-7 font-mono text-xs focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  aria-label={t('aiActions.count')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-xs">{t('aiActions.styles')}</p>
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-wrap gap-1.5">
                {AI_GENERATE_STYLES.map((style) => {
                  const selected = styles.includes(style.id)
                  const StyleIcon = STYLE_ICONS[style.id]
                  return (
                    <Tooltip key={style.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => toggleStyle(style.id)}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-left transition-all duration-200',
                            selected
                              ? 'border-primary/40 bg-primary/12 shadow-sm'
                              : 'border-border/70 bg-background/60 hover:border-primary/30 hover:bg-primary/5'
                          )}
                        >
                          <StyleIcon
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              selected ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                          <span
                            className={cn(
                              'font-medium text-xs',
                              selected ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {t(style.labelKey)}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-56 text-xs">
                        {t(style.descriptionKey)}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </TooltipProvider>
          </div>

          <AiPromptField
            ref={promptRef}
            id="ai-generate-prompt"
            label={t('aiActions.additionalPrompt')}
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => void handleSubmit()}
            placeholder={t('aiActions.generatePromptPlaceholder')}
            disabled={submitting}
            autoFocus
            minHeightClass="min-h-[64px]"
          />

          <AiPromptExamples
            kind="generate"
            dataclassName={dataclassName}
            open={open}
            selectedPrompt={prompt}
            disabled={submitting}
            icons={[Sparkles, Zap, Filter]}
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
