import {
  Button,
  CodeEditor,
  type CodeEditorInstance,
  cn,
  type EditorPrefs,
  SegmentedControl,
} from '@4d/ui'
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
const MAX_LINES = 12
const SNIPPET_MIN_LINES = 4
const SNIPPET_MIN_LINES_MOBILE = 6

function lineCountOf(draft: string): number {
  if (!draft) return 1
  return draft.split('\n').length
}

function heightForLines(lines: number): number {
  const visible = Math.min(MAX_LINES, Math.max(MIN_LINES, lines))
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
  const minLines = isSnippet ? (mobile ? SNIPPET_MIN_LINES_MOBILE : SNIPPET_MIN_LINES) : MIN_LINES
  const contentHeight = heightForLines(Math.max(minLines, lineCount))
  const [extraHeight, setExtraHeight] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset resize when editor session changes
  useEffect(() => {
    setExtraHeight(0)
  }, [mode, fileName])

  const inputHeight = Math.min(heightForLines(MAX_LINES), contentHeight + extraHeight)

  const beginResize = (clientY: number) => {
    const startY = clientY
    const startExtra = extraHeight
    const maxExtra = heightForLines(MAX_LINES) - contentHeight
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
        mobile ? 'h-9 min-w-[5.5rem] px-3 text-sm' : 'h-7 px-2.5',
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

      {isSnippet && fileName ? (
        <div
          className={cn(
            'flex items-center gap-1.5 border-border/50 border-t bg-muted/20',
            mobile ? 'min-h-11 px-2 py-1.5' : 'px-2 py-1'
          )}
        >
          <FileCode2
            className={cn('shrink-0 text-primary/80', mobile ? 'h-4 w-4' : 'h-3.5 w-3.5')}
            aria-hidden
          />
          <span
            className={cn(
              'min-w-0 truncate font-mono text-foreground',
              mobile ? 'text-xs' : 'text-[11px]'
            )}
          >
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
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant={dirty ? 'secondary' : 'ghost'}
              className={cn(
                'touch-manipulation gap-1',
                mobile ? 'h-9 px-2.5 text-xs' : 'h-6 px-1.5 text-[10px]'
              )}
              onClick={onSaveFile}
              disabled={!dirty || !draft.trim()}
            >
              <Save className={mobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden />
              {t('terminal.snippets.save')}
            </Button>
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant="ghost"
              className={cn(
                'touch-manipulation text-destructive hover:text-destructive',
                mobile ? 'h-9 w-9 p-0' : 'h-6 w-6 p-0'
              )}
              aria-label={t('terminal.snippets.delete')}
              onClick={onDeleteFile}
            >
              <Trash2 className={mobile ? 'h-4 w-4' : 'h-3 w-3'} />
            </Button>
            <Button
              size={mobile ? 'sm' : 'xs'}
              variant="ghost"
              className={cn('touch-manipulation', mobile ? 'h-9 w-9 p-0' : 'h-6 w-6 p-0')}
              aria-label={t('terminal.snippets.closeFile')}
              onClick={onCloseFile}
            >
              <X className={mobile ? 'h-4 w-4' : 'h-3 w-3'} />
            </Button>
          </div>
        </div>
      ) : null}

      <div
        style={{ height: inputHeight }}
        className={cn(
          'relative flex border-border/50 border-t bg-background/40',
          running && 'opacity-80'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 select-none items-center font-mono text-[12px]',
            isSnippet
              ? 'items-start py-1 pr-0.5 pl-1.5 text-sky-600 leading-[18px] dark:text-sky-400'
              : multiLine
                ? 'items-start py-1 pr-0.5 pl-1.5 text-emerald-600 leading-[18px] dark:text-emerald-400'
                : 'pr-0.5 pl-1.5 text-emerald-600 dark:text-emerald-400'
          )}
          aria-hidden
        >
          {isSnippet ? '▸' : '>'}
        </div>
        <div className="min-w-0 flex-1">
          <CodeEditor
            value={draft}
            onChange={(value) => onDraftChange(value ?? '')}
            language="javascript"
            height="100%"
            fontSize={mobile ? 16 : 14}
            lineHeight={LINE_PX}
            padding={{ top: PAD_Y, bottom: PAD_Y }}
            showLineNumbers={multiLine}
            wordBasedSuggestions="off"
            toolbar={false}
            path={editorPath}
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
