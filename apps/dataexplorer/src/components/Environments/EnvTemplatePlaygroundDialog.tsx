import {
  Alert,
  AlertDescription,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TemplatedTextarea,
} from '@4d/ui'
import {
  AlertTriangle,
  Braces,
  Check,
  Copy,
  FlaskConical,
  Play,
  RotateCw,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import {
  EnvTemplatePlaygroundExamples,
  PLAYGROUND_EXAMPLES,
  type PlaygroundExample,
  type PlaygroundExampleId,
  PlaygroundSection,
} from '~/components/Environments/EnvTemplatePlaygroundExamples'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { useTranslation } from '~/i18n'
import { resolveEnvString } from '~/lib/env/runtime'
import { isMobileShell } from '~/lib/platform'

type EvalResult = {
  text: string
  unresolved: string[]
  runId: number
}

export function EnvTemplatePlaygroundDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const inputId = useId()
  const resultId = useId()
  const envField = useTemplatedEnvFieldProps()

  const [draft, setDraft] = useState(PLAYGROUND_EXAMPLES[0].template)
  const [selectedId, setSelectedId] = useState<PlaygroundExampleId | null>(
    PLAYGROUND_EXAMPLES[0].id
  )
  const [result, setResult] = useState<EvalResult | null>(null)
  const [copiedSource, setCopiedSource] = useState<'template' | 'result' | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const evaluate = useCallback((source?: string) => {
    const text = source ?? draftRef.current
    const next = resolveEnvString(text)
    setResult({ ...next, runId: Date.now() })
    setCopiedSource(null)
  }, [])

  useEffect(() => {
    if (!open) setCopiedSource(null)
  }, [open])

  const loadExample = (example: PlaygroundExample) => {
    setSelectedId(example.id)
    setDraft(example.template)
    const next = resolveEnvString(example.template)
    setResult({ ...next, runId: Date.now() })
    setCopiedSource(null)
  }

  const onDraftChange = (next: string) => {
    setDraft(next)
    const match = PLAYGROUND_EXAMPLES.find((example) => example.template === next)
    setSelectedId(match?.id ?? null)
    setCopiedSource((prev) => (prev === 'template' ? null : prev))
  }

  const copyText = async (text: string, source: 'template' | 'result') => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSource(source)
    } catch {
      setCopiedSource(null)
    }
  }

  const hasRun = result !== null
  const unresolved = result?.unresolved ?? []
  const hasOutput = hasRun && result.text.length > 0
  const hasTemplate = draft.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl',
          mobile && 'max-w-[calc(100vw-1rem)]'
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-border/60 border-b bg-muted/20 px-3 py-2.5 text-left sm:px-4">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background shadow-xs"
              aria-hidden
            >
              <FlaskConical className="size-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-sm sm:text-base">
                {t('environments.testTemplatesTitle')}
              </DialogTitle>
              <DialogDescription className="text-[11px] leading-snug sm:text-xs">
                {t('environments.testTemplatesDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          <div className="grid min-h-0 gap-3 sm:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] sm:items-stretch">
            <EnvTemplatePlaygroundExamples selectedId={selectedId} onSelect={loadExample} />

            <div className="flex min-h-0 flex-col gap-3">
              <PlaygroundSection
                icon={Braces}
                title={t('environments.testTemplatesInputLabel')}
                titleFor={inputId}
                actions={
                  hasTemplate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                      onClick={() => void copyText(draft, 'template')}
                    >
                      {copiedSource === 'template' ? (
                        <Check className="size-3" aria-hidden />
                      ) : (
                        <Copy className="size-3" aria-hidden />
                      )}
                      {copiedSource === 'template'
                        ? t('environments.testTemplatesCopied')
                        : t('environments.testTemplatesCopyTemplate')}
                    </Button>
                  ) : null
                }
                bodyClassName="p-2"
              >
                <TemplatedTextarea
                  id={inputId}
                  value={draft}
                  onChange={onDraftChange}
                  placeholder={t('environments.testTemplatesPlaceholder')}
                  className="min-h-28 border-border/60 bg-background font-mono text-xs shadow-none focus-visible:ring-1"
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      const live = event.currentTarget.value
                      if (live !== draftRef.current) onDraftChange(live)
                      evaluate(live)
                    }
                  }}
                  {...envField}
                />
                <p className="mt-1.5 px-0.5 text-[10px] text-muted-foreground">
                  {t('environments.testTemplatesShortcut')}
                </p>
              </PlaygroundSection>

              <PlaygroundSection
                icon={Sparkles}
                title={t('environments.testTemplatesResultLabel')}
                titleFor={resultId}
                count={
                  hasRun && unresolved.length === 0 ? (
                    <span className="rounded-full border border-success/25 bg-success/10 px-1.5 py-0.5 font-mono text-[10px] text-success tabular-nums">
                      OK
                    </span>
                  ) : unresolved.length > 0 ? (
                    <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] text-warning tabular-nums">
                      {unresolved.length}
                    </span>
                  ) : null
                }
                actions={
                  hasOutput ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                      onClick={() => void copyText(result.text, 'result')}
                    >
                      {copiedSource === 'result' ? (
                        <Check className="size-3" aria-hidden />
                      ) : (
                        <Copy className="size-3" aria-hidden />
                      )}
                      {copiedSource === 'result'
                        ? t('environments.testTemplatesCopied')
                        : t('environments.testTemplatesCopyResult')}
                    </Button>
                  ) : null
                }
                bodyClassName="p-2"
                className="flex-1"
              >
                {!hasRun ? (
                  <EmptyPanel
                    icon={Sparkles}
                    badgeTone="muted"
                    title={t('environments.testTemplatesEmptyResult')}
                    description={t('environments.testTemplatesEmptyHint')}
                    ghost="rows"
                    bordered
                    size="sm"
                    className="min-h-28"
                  />
                ) : (
                  <div className="space-y-2">
                    <div
                      key={result.runId}
                      id={resultId}
                      role="status"
                      aria-live="polite"
                      className={cn(
                        'wrap-break-word fade-in-0 min-h-24 animate-in whitespace-pre-wrap rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-xs shadow-xs duration-200'
                      )}
                    >
                      {result.text || '—'}
                    </div>
                    {unresolved.length > 0 ? (
                      <Alert variant="warning" className="py-2 text-[11px]">
                        <AlertTriangle />
                        <AlertDescription className="text-warning">
                          {t('environments.testTemplatesUnresolved', {
                            keys: unresolved.join(', '),
                          })}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                )}
              </PlaygroundSection>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-border/60 border-t bg-muted/15 px-3 py-2.5 sm:gap-2 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
          <Button type="button" onClick={() => evaluate()} className="gap-1.5 shadow-xs">
            {hasRun ? (
              <RotateCw className="size-3.5" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            {hasRun
              ? t('environments.testTemplatesRerun')
              : t('environments.testTemplatesEvaluate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
