import { Button, cn, type EditorPrefs, SegmentedControl } from '@4d/ui'
import { CodeEditor, type CodeEditorInstance } from '@4d/ui/code-editor'
import {
  CornerDownLeft,
  FileCode2,
  Loader2,
  Play,
  Save,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react'
import type * as MonacoEditor from 'monaco-editor'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'

/** Pixel line height — keeps the caret short in the REPL input. */
const LINE_PX = 18
const PAD_Y = 4
const MIN_LINES = 1
const MAX_LINES_REPL = 12
const MAX_LINES_SNIPPET = 20
const SNIPPET_MIN_LINES = 8
const SNIPPET_MIN_LINES_MOBILE = 10
/** Matches CodeEditor toolbar `min-h-6` when snippet tools are shown. */
const SNIPPET_TOOLBAR_PX = 24

function lineCountOf(draft: string): number {
  if (!draft) return 1
  return draft.split('\n').length
}

function heightForLines(lines: number, maxLines: number): number {
  const visible = Math.min(maxLines, Math.max(MIN_LINES, lines))
  return visible * LINE_PX + PAD_Y * 2
}

export type TerminalComposerMode = 'repl' | 'snippet'

type TerminalComposerProps = {
  draft: string
  running: boolean
  editorPrefs: EditorPrefs
  exampleChips: ReactNode
  mode?: TerminalComposerMode
  /** Display name when editing a snippet file, e.g. weekendCars.js */
  fileName?: string
  dirty?: boolean
  editorPath?: string
  /** Native mobile shell — larger targets, stacked chrome, no keyboard shortcut chrome. */
  mobile?: boolean
  /** Mobile-only command history deck shown above the REPL input. */
  historyNavigator?: ReactNode
  onDraftChange: (value: string) => void
  onRun: () => void
  onSaveFile?: () => void
  onDeleteFile?: () => void
  onCloseFile?: () => void
  /** Switch between REPL prompt and snippet code editor. */
  onModeChange?: (mode: TerminalComposerMode) => void
  onEditorPrefsChange: (partial: Partial<EditorPrefs>) => void
  onMount: (editor: CodeEditorInstance, monaco: typeof MonacoEditor) => void
}

/**
 * Input chrome: file tabs / chips, Run, `>` or file prompt + Monaco.
 * Snippet mode edits a .js file inline with ORDA highlighting & autocomplete.
 */
export function TerminalComposer({
  draft,
  running,
  editorPrefs,
  exampleChips,
  mode = 'repl',
  fileName,
  dirty = false,
  editorPath = 'orda-terminal:///input.js',
  mobile = false,
  historyNavigator,
  onDraftChange,
  onRun,
  onSaveFile,
  onDeleteFile,
  onCloseFile,
  onModeChange,
  onEditorPrefsChange,
  onMount,
}: TerminalComposerProps) {
  const { t } = useTranslation()
  const isSnippet = mode === 'snippet'
  const canRun = !running && draft.trim().length > 0
  const lineCount = useMemo(() => lineCountOf(draft), [draft])
  const multiLine = isSnippet || lineCount > 1
  const maxLines = isSnippet ? MAX_LINES_SNIPPET : MAX_LINES_REPL
  const minLines = isSnippet ? (mobile ? SNIPPET_MIN_LINES_MOBILE : SNIPPET_MIN_LINES) : MIN_LINES
  const contentHeight = heightForLines(Math.max(minLines, lineCount), maxLines)
  const [extraHeight, setExtraHeight] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset resize when editor session changes
  useEffect(() => {
    setExtraHeight(0)
  }, [mode, fileName])

  const inputHeight = Math.min(heightForLines(maxLines, maxLines), contentHeight + extraHeight)
  const showSnippetToolbar = isSnippet && Boolean(fileName)
  const shellHeight = showSnippetToolbar ? inputHeight + SNIPPET_TOOLBAR_PX : inputHeight

  const beginResize = (clientY: number) => {
    const startY = clientY
    const startExtra = extraHeight
    const maxExtra = heightForLines(maxLines, maxLines) - contentHeight
    const onMove = (y: number) => {
      const delta = (y - startY) * -1
      setExtraHeight(Math.min(maxExtra, Math.max(0, startExtra + delta)))
    }
    const onMouseMove = (e: MouseEvent) => onMove(e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientY)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  const modeControl = onModeChange ? (
    <SegmentedControl
      aria-label={t('terminal.modeSwitch')}
      value={isSnippet ? 'snippet' : 'repl'}
      onValueChange={onModeChange}
      size={mobile ? 'md' : 'sm'}
      fullWidth={mobile}
      className={cn('shrink-0', mobile && 'min-w-0 flex-1')}
      options={[
        {
          value: 'repl',
          label: t('terminal.modeRepl'),
          icon: TerminalIcon,
          ariaLabel: t('terminal.modeRepl'),
        },
        {
          value: 'snippet',
          label: t('terminal.modeCode'),
          icon: FileCode2,
          ariaLabel: t('terminal.modeCode'),
        },
      ]}
    />
  ) : (
    <span
      className="hidden shrink-0 rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] text-primary sm:inline"
      aria-hidden
    >
      {isSnippet ? 'js' : 'ds'}
    </span>
  )

  const runButton = (
    <Button
      size={mobile ? 'sm' : 'xs'}
      variant="default"
      className={cn(
        'shrink-0 touch-manipulation gap-1.5 shadow-sm transition-shadow',
        mobile ? 'h-9 min-w-22 px-3 text-sm' : 'h-7 px-2.5',
        canRun && 'shadow-primary/20'
      )}
      onClick={onRun}
      disabled={!canRun}
    >
      {running ? (
        <Loader2 className={cn(mobile ? 'h-4 w-4' : 'h-3 w-3', 'animate-spin')} aria-hidden />
      ) : (
        <Play className={mobile ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden />
      )}
      {t('terminal.run')}
      {!mobile ? (
        <kbd className="ml-0.5 hidden rounded bg-primary-foreground/15 px-1 font-mono text-[9px] opacity-80 sm:inline">
          {isSnippet ? '⇧↵' : '↵'}
        </kbd>
      ) : null}
    </Button>
  )

  const snippetToolbarLeading = showSnippetToolbar ? (
    <>
      <FileCode2 className="h-3 w-3 shrink-0 text-primary/80" aria-hidden />
      <span className="min-w-0 truncate font-mono text-[10px] text-foreground leading-none">
        {fileName}
        {dirty ? (
          <span
            className="ml-1 text-amber-600 dark:text-amber-400"
            title={t('terminal.snippets.dirty')}
          >
            •
          </span>
        ) : null}
      </span>
    </>
  ) : null

  const snippetToolbarTrailing = showSnippetToolbar ? (
    <>
      <Button
        size="xs"
        variant={dirty ? 'secondary' : 'ghost'}
        className={cn(
          'touch-manipulation gap-1',
          mobile ? 'h-7 px-2 text-[10px]' : 'h-5 px-1.5 text-[10px]'
        )}
        onClick={onSaveFile}
        disabled={!dirty || !draft.trim()}
      >
        <Save className="h-3 w-3" aria-hidden />
        {t('terminal.snippets.save')}
      </Button>
      <Button
        size="xs"
        variant="ghost"
        className={cn(
          'touch-manipulation text-destructive hover:text-destructive',
          mobile ? 'h-7 w-7 p-0' : 'h-5 w-5 p-0'
        )}
        aria-label={t('terminal.snippets.delete')}
        onClick={onDeleteFile}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      <Button
        size="xs"
        variant="ghost"
        className={cn('touch-manipulation', mobile ? 'h-7 w-7 p-0' : 'h-5 w-5 p-0')}
        aria-label={t('terminal.snippets.closeFile')}
        onClick={onCloseFile}
      >
        <X className="h-3 w-3" />
      </Button>
    </>
  ) : null

  return (
    <div className="shrink-0 overflow-visible border-border/80 border-t bg-linear-to-b from-muted/30 to-background pb-[max(0px,env(safe-area-inset-bottom,0px))]">
      <button
        type="button"
        className={cn(
          'group flex w-full cursor-ns-resize touch-manipulation items-center justify-center border-border/40 border-b hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
          mobile ? 'h-3' : 'h-2'
        )}
        aria-label={t('terminal.resizeInput')}
        onMouseDown={(event) => {
          event.preventDefault()
          beginResize(event.clientY)
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          if (!touch) return
          beginResize(touch.clientY)
        }}
      >
        <span
          className={cn(
            'rounded-full bg-border transition-colors group-hover:bg-primary/50 group-focus-visible:bg-primary/50',
            mobile ? 'h-1 w-10' : 'h-0.5 w-8'
          )}
          aria-hidden
        />
      </button>

      {mobile ? (
        <div className="flex flex-col gap-2 px-2 py-2">
          <div className="flex items-center gap-2">
            {modeControl}
            {runButton}
          </div>
          <div className="scrollbar-none flex min-w-0 items-stretch gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {exampleChips}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {modeControl}
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">{exampleChips}</div>
          {runButton}
        </div>
      )}

      {mobile && !isSnippet ? historyNavigator : null}

      <div
        style={{ height: shellHeight }}
        className={cn(
          'relative flex overflow-hidden border-border/50 border-t bg-background/40',
          running && 'opacity-80'
        )}
      >
        {!isSnippet ? (
          <div
            className={cn(
              'flex shrink-0 select-none items-center font-mono text-[12px]',
              multiLine
                ? 'items-start py-1 pr-0.5 pl-1.5 text-emerald-600 leading-4.5 dark:text-emerald-400'
                : 'pr-0.5 pl-1.5 text-emerald-600 dark:text-emerald-400'
            )}
            aria-hidden
          >
            {'>'}
          </div>
        ) : null}
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CodeEditor
            value={draft}
            onChange={(value) => onDraftChange(value ?? '')}
            language="javascript"
            height={inputHeight}
            fontSize={mobile ? 16 : 14}
            lineHeight={LINE_PX}
            padding={{ top: PAD_Y, bottom: PAD_Y }}
            showLineNumbers={multiLine}
            wordBasedSuggestions="off"
            toolbar={
              showSnippetToolbar
                ? {
                    position: 'top',
                    tools: ['format', 'copy', 'undo', 'redo', 'zoom-in', 'zoom-out', 'word-wrap'],
                    leading: snippetToolbarLeading,
                    trailing: snippetToolbarTrailing,
                  }
                : false
            }
            path={editorPath}
            editorPrefs={editorPrefs}
            onEditorPrefsChange={onEditorPrefsChange}
            onMount={onMount}
            className={cn(
              'min-h-0 flex-1 rounded-none border-0 [&_.monaco-editor]:outline-none',
              '[&_.monaco-editor_.overflow-guard]:pl-0!',
              !multiLine &&
                '[&_.monaco-editor_.margin-view-overlays]:w-0! [&_.monaco-editor_.margin]:w-0!'
            )}
          />
        </div>
        {!mobile && !multiLine && !isSnippet ? (
          <div className="pointer-events-none absolute right-2 bottom-1 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground/80 backdrop-blur-sm">
            <CornerDownLeft className="h-2.5 w-2.5" aria-hidden />
            {t('terminal.runHint')}
          </div>
        ) : !mobile && isSnippet ? (
          <div className="pointer-events-none absolute right-2 bottom-1 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground/80 backdrop-blur-sm">
            {t('terminal.runHintCode')}
          </div>
        ) : mobile ? (
          <div className="pointer-events-none absolute right-2 bottom-1.5 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
            {t('terminal.runHintMobile')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
