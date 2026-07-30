import { Button, CodeEditor, type CodeEditorInstance, cn, type EditorPrefs } from '@4d/ui'
import { CornerDownLeft, Loader2, Play } from 'lucide-react'
import type * as MonacoEditor from 'monaco-editor'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'

/** Pixel line height — keeps the caret short in the REPL input. */
const LINE_PX = 18
const PAD_Y = 4
const MIN_LINES = 1
const MAX_LINES = 12

function lineCountOf(draft: string): number {
  if (!draft) return 1
  return draft.split('\n').length
}

function heightForLines(lines: number): number {
  const visible = Math.min(MAX_LINES, Math.max(MIN_LINES, lines))
  return visible * LINE_PX + PAD_Y * 2
}

type TerminalComposerProps = {
  draft: string
  running: boolean
  editorPrefs: EditorPrefs
  exampleChips: ReactNode
  onDraftChange: (value: string) => void
  onRun: () => void
  onEditorPrefsChange: (partial: Partial<EditorPrefs>) => void
  onMount: (editor: CodeEditorInstance, monaco: typeof MonacoEditor) => void
}

/**
 * Input chrome: example chips, Run, `>` prompt + Monaco.
 * Single-line by default; grows with Shift+Enter newlines and shows line numbers when multi-line.
 */
export function TerminalComposer({
  draft,
  running,
  editorPrefs,
  exampleChips,
  onDraftChange,
  onRun,
  onEditorPrefsChange,
  onMount,
}: TerminalComposerProps) {
  const { t } = useTranslation()
  const canRun = !running && draft.trim().length > 0
  const lineCount = useMemo(() => lineCountOf(draft), [draft])
  const multiLine = lineCount > 1
  const contentHeight = heightForLines(lineCount)
  const [extraHeight, setExtraHeight] = useState(0)

  useEffect(() => {
    setExtraHeight(0)
  }, [])

  const inputHeight = Math.min(heightForLines(MAX_LINES), contentHeight + extraHeight)

  return (
    <div className="shrink-0 border-border/80 border-t bg-linear-to-b from-muted/30 to-background">
      <button
        type="button"
        className="group flex h-2 w-full cursor-ns-resize items-center justify-center border-border/40 border-b hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
        aria-label={t('terminal.resizeInput')}
        onMouseDown={(event) => {
          event.preventDefault()
          const startY = event.clientY
          const startExtra = extraHeight
          const onMove = (e: MouseEvent) => {
            const delta = (e.clientY - startY) * -1
            const next = Math.max(0, startExtra + delta)
            const maxExtra = heightForLines(MAX_LINES) - contentHeight
            setExtraHeight(Math.min(maxExtra, next))
          }
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <span
          className="h-0.5 w-8 rounded-full bg-border transition-colors group-hover:bg-primary/50 group-focus-visible:bg-primary/50"
          aria-hidden
        />
      </button>

      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span
          className="hidden shrink-0 rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] text-primary sm:inline"
          aria-hidden
        >
          ds
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">{exampleChips}</div>
        <Button
          size="xs"
          variant="default"
          className={cn(
            'h-7 gap-1.5 px-2.5 shadow-sm transition-shadow',
            canRun && 'shadow-primary/20'
          )}
          onClick={onRun}
          disabled={!canRun}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3 w-3" aria-hidden />
          )}
          {t('terminal.run')}
          <kbd className="ml-0.5 hidden rounded bg-primary-foreground/15 px-1 font-mono text-[9px] opacity-80 sm:inline">
            ↵
          </kbd>
        </Button>
      </div>

      <div
        style={{ height: inputHeight }}
        className={cn(
          'relative flex border-border/50 border-t bg-background/40',
          running && 'opacity-80'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 select-none items-center font-mono text-[12px] text-emerald-600 dark:text-emerald-400',
            multiLine ? 'items-start py-1 pr-0.5 pl-1.5 leading-[18px]' : 'pr-0.5 pl-1.5'
          )}
          aria-hidden
        >
          {'>'}
        </div>
        <div className="min-w-0 flex-1">
          <CodeEditor
            value={draft}
            onChange={(value) => onDraftChange(value ?? '')}
            language="javascript"
            height="100%"
            fontSize={14}
            lineHeight={LINE_PX}
            padding={{ top: PAD_Y, bottom: PAD_Y }}
            showLineNumbers={multiLine}
            wordBasedSuggestions="off"
            toolbar={false}
            path="orda-terminal://input.js"
            editorPrefs={editorPrefs}
            onEditorPrefsChange={onEditorPrefsChange}
            onMount={onMount}
            className={cn(
              'h-full [&_.monaco-editor]:outline-none',
              '[&_.monaco-editor_.overflow-guard]:pl-0!',
              !multiLine &&
                '[&_.monaco-editor_.margin-view-overlays]:w-0! [&_.monaco-editor_.margin]:w-0!'
            )}
          />
        </div>
        {!multiLine ? (
          <div className="pointer-events-none absolute right-2 bottom-1 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground/80 backdrop-blur-sm">
            <CornerDownLeft className="h-2.5 w-2.5" aria-hidden />
            {t('terminal.runHint')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
