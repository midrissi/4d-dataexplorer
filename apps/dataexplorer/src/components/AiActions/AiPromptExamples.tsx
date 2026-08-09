import { cn } from '@4d/ui'
import { Filter, type LucideIcon, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCloudLlmOffline } from '~/hooks/useCloudLlmOffline'
import { useTranslation } from '~/i18n'
import {
  type AiModalExampleKind,
  type AiModalPromptExample,
  buildStaticAiModalPromptExamples,
  fetchAiModalPromptExamples,
} from '~/lib/ai-modal-prompt-examples'
import { client } from '~/lib/api'
import { isAssistantLlmConfigured } from '~/lib/assistant-llm-configured'
import { AiExampleChip } from './AiModalShell'

type AiPromptExamplesProps = {
  kind: AiModalExampleKind
  dataclassName: string
  /** Currently selected prompt text (highlight matching chip). */
  selectedPrompt: string
  /** When the parent modal opens, reset to schema-aware static examples. */
  open?: boolean
  disabled?: boolean
  icons?: LucideIcon[]
  title?: string
  onSelect: (prompt: string) => void
}

export function AiPromptExamples({
  kind,
  dataclassName,
  selectedPrompt,
  open = true,
  disabled,
  icons = [Filter, Sparkles, RefreshCw],
  title,
  onSelect,
}: AiPromptExamplesProps) {
  const { t } = useTranslation()
  const [examples, setExamples] = useState<AiModalPromptExample[]>(() =>
    buildStaticAiModalPromptExamples(kind, dataclassName)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const cloudLlmOffline = useCloudLlmOffline()
  const canGenerate = isAssistantLlmConfigured() && !cloudLlmOffline

  useEffect(() => {
    if (!open) return
    abortRef.current?.abort()
    setLoading(false)
    setError(null)
    setGenerated(false)
    setExamples(buildStaticAiModalPromptExamples(kind, dataclassName))
    let cancelled = false
    void client.catalog.getAllWithMetadataCached().then((catalog) => {
      if (cancelled) return
      setExamples(buildStaticAiModalPromptExamples(kind, dataclassName, catalog))
    })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [kind, dataclassName, open])

  const handleGenerate = async () => {
    if (loading || disabled) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const next = await fetchAiModalPromptExamples({
        kind,
        dataclassName,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setExamples(next)
      setGenerated(true)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          {title ?? t('aiActions.examples')}
        </p>
        {canGenerate ? (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => void handleGenerate()}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md border border-border/80 px-1.5 font-medium text-[11px] transition-colors',
              'text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-foreground',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            title={generated ? t('aiActions.regenerateExamples') : t('aiActions.generateExamples')}
          >
            {loading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            ) : generated ? (
              <RefreshCw className="h-3 w-3" aria-hidden />
            ) : (
              <Sparkles className="h-3 w-3 text-primary" aria-hidden />
            )}
            <span>
              {loading
                ? t('aiActions.generatingExamples')
                : generated
                  ? t('aiActions.regenerateExamples')
                  : t('aiActions.generateExamples')}
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5" aria-busy={loading || undefined}>
        {examples.map((example, index) => (
          <AiExampleChip
            key={example.id}
            label={example.prompt}
            icon={icons[index % icons.length] ?? Filter}
            selected={selectedPrompt === example.prompt}
            disabled={disabled || loading}
            onClick={() => onSelect(example.prompt)}
          />
        ))}
      </div>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
