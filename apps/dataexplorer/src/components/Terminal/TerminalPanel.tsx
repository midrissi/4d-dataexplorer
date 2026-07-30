import type { CatalogAllResponse } from '@4d/rest'
import {
  Button,
  type CodeEditorInstance,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Braces, Eraser, Terminal as TerminalIcon } from 'lucide-react'
import type * as MonacoEditor from 'monaco-editor'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api, client } from '~/lib/api'
import { isMobileShell } from '~/lib/platform'
import { createDatastore, executeSnippet, formatTerminalResult } from '~/lib/terminal'
import { useDataExplorerStore } from '~/store'
import { useCodeEditorPrefs, useSettingsStore, useUpdateCodeEditorPrefs } from '~/store/settings'
import { useTerminalStore } from '~/store/terminal'
import { registerOrdaJsProviders } from './orda-js-completion'
import { TerminalComposer } from './TerminalComposer'
import { TerminalEmptyState, type TerminalExampleId } from './TerminalEmptyState'
import { TerminalOutputRow } from './TerminalOutputRow'

const EXAMPLE_SNIPPETS: Record<TerminalExampleId, string> = {
  all: 'ds.Car.all()',
  query: 'ds.Car.query("ID > 0").select("name")',
  get: 'await ds.Car.get(12).select("name")',
  snippet: `const car = await ds.Car.get(12).select("name")
console.log(car)
const reservations = await ds.Reservation.query("car.ID=:1", car.getKey())
console.log(reservations)`,
}

const CHIP_IDS: TerminalExampleId[] = ['all', 'query', 'get']

export function TerminalPanel({ hideChrome = false }: { hideChrome?: boolean } = {}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const setConsoleOpen = useSettingsStore((s) => s.setConsoleOpen)
  const dataclasses = useDataExplorerStore((s) => s.dataclasses)
  const editorPrefs = useCodeEditorPrefs()
  const setEditorPrefs = useUpdateCodeEditorPrefs()

  const output = useTerminalStore((s) => s.output)
  const draft = useTerminalStore((s) => s.draft)
  const running = useTerminalStore((s) => s.running)
  const setDraft = useTerminalStore((s) => s.setDraft)
  const setRunning = useTerminalStore((s) => s.setRunning)
  const appendOutput = useTerminalStore((s) => s.appendOutput)
  const clearOutput = useTerminalStore((s) => s.clearOutput)
  const pushHistory = useTerminalStore((s) => s.pushHistory)
  const historyUp = useTerminalStore((s) => s.historyUp)
  const historyDown = useTerminalStore((s) => s.historyDown)
  const resetHistoryCursor = useTerminalStore((s) => s.resetHistoryCursor)

  const [catalog, setCatalog] = useState<CatalogAllResponse | null>(null)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<CodeEditorInstance | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const dataClassNames = useMemo(() => dataclasses.map((d) => d.name), [dataclasses])
  const firstDc = dataClassNames[0] ?? 'Car'
  const dataClassNamesRef = useRef(dataClassNames)
  dataClassNamesRef.current = dataClassNames

  useEffect(() => {
    let cancelled = false
    api
      .getCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const catalogRef = useRef<CatalogAllResponse | null>(null)
  catalogRef.current = catalog
  const providersRef = useRef<(() => void) | null>(null)

  const clearInput = useCallback(() => {
    setDraft('')
    resetHistoryCursor()
    const editor = editorRef.current
    if (editor) {
      editor.setValue('')
      editor.focus()
    }
  }, [resetHistoryCursor, setDraft])

  const runCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim()
      if (!trimmed || running) return

      appendOutput({ kind: 'input', source: trimmed })
      pushHistory(trimmed)
      resetHistoryCursor()
      clearInput()
      setRunning(true)

      try {
        const ds = createDatastore(client, {
          dataClassNames: dataClassNamesRef.current,
          catalog: catalogRef.current,
        })
        const result = await executeSnippet(trimmed, ds)

        for (const log of result.logs) {
          for (const arg of log.args) {
            appendOutput({
              kind: 'log',
              logLevel: log.level,
              formatted: formatTerminalResult(arg),
            })
          }
        }

        if (result.ok) {
          appendOutput({
            kind: 'result',
            formatted: formatTerminalResult(result.value),
          })
        } else {
          appendOutput({
            kind: 'error',
            errorMessage: result.error,
            formatted: {
              kind: 'error',
              label: 'Error',
              message: result.error,
              value: result.cause,
            },
          })
        }
      } finally {
        setRunning(false)
        editorRef.current?.focus()
      }
    },
    [appendOutput, clearInput, pushHistory, resetHistoryCursor, running, setRunning]
  )

  const handleRun = useCallback(() => {
    void runCode(draftRef.current)
  }, [runCode])

  const insertExample = useCallback(
    (id: TerminalExampleId) => {
      const code = EXAMPLE_SNIPPETS[id]
      const substituted = code
        .replaceAll(/\bCar\b/g, firstDc)
        .replaceAll(/\bReservation\b/g, dataClassNames.find((n) => n !== firstDc) ?? firstDc)
      setDraft(substituted)
      resetHistoryCursor()
      editorRef.current?.focus()
    },
    [dataClassNames, firstDc, resetHistoryCursor, setDraft]
  )

  const lastOutputId = output[output.length - 1]?.id
  // Keep the scrollback pinned to the latest cell after each run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when a new output cell appears
  useLayoutEffect(() => {
    outputEndRef.current?.scrollIntoView({ block: 'end' })
  }, [lastOutputId])

  const onMount = useCallback(
    (editor: CodeEditorInstance, monaco: typeof MonacoEditor) => {
      editorRef.current = editor

      providersRef.current?.()
      providersRef.current = registerOrdaJsProviders(monaco, () => ({
        dataClassNames: useDataExplorerStore.getState().dataclasses.map((d) => d.name),
        catalog: catalogRef.current,
      }))

      editor.addAction({
        id: 'orda-terminal-run',
        label: 'Run',
        keybindings: [monaco.KeyCode.Enter],
        precondition: '!suggestWidgetVisible',
        run: (ed) => {
          void runCode(ed.getValue())
        },
      })

      editor.addAction({
        id: 'orda-terminal-newline',
        label: 'New line',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        run: (ed) => {
          ed.trigger('keyboard', 'type', { text: '\n' })
        },
      })

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void runCode(editor.getValue())
      })

      editor.addCommand(monaco.KeyCode.UpArrow, () => {
        const model = editor.getModel()
        const position = editor.getPosition()
        if (!model || !position) return
        if (position.lineNumber !== 1) {
          editor.trigger('keyboard', 'cursorUp', {})
          return
        }
        const prev = historyUp(editor.getValue())
        if (prev != null) {
          editor.setValue(prev)
          const line = editor.getModel()?.getLineCount() ?? 1
          const col = editor.getModel()?.getLineMaxColumn(line) ?? 1
          editor.setPosition({ lineNumber: line, column: col })
        }
      })

      editor.addCommand(monaco.KeyCode.DownArrow, () => {
        const model = editor.getModel()
        const position = editor.getPosition()
        if (!model || !position) return
        if (position.lineNumber !== model.getLineCount()) {
          editor.trigger('keyboard', 'cursorDown', {})
          return
        }
        const next = historyDown()
        if (next != null) {
          editor.setValue(next)
          const line = editor.getModel()?.getLineCount() ?? 1
          const col = editor.getModel()?.getLineMaxColumn(line) ?? 1
          editor.setPosition({ lineNumber: line, column: col })
        }
      })

      editor.focus()
    },
    [historyDown, historyUp, runCode]
  )

  useEffect(() => {
    return () => {
      providersRef.current?.()
      providersRef.current = null
    }
  }, [])

  const exampleChips = CHIP_IDS.map((id) => (
    <Button
      key={id}
      size="xs"
      variant="outline"
      className="h-6 border-border/70 bg-background/60 px-1.5 font-mono text-[10px] text-muted-foreground hover:border-primary/35 hover:bg-primary/5 hover:text-foreground"
      onClick={() => insertExample(id)}
    >
      {t(`terminal.example.${id}`)}
    </Button>
  ))

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-primary/[0.04] to-transparent"
        aria-hidden
      />

      <div
        className={cn(
          'relative z-10 flex shrink-0 items-center gap-2 border-border/70 border-b bg-background/80 px-2 backdrop-blur-sm',
          mobile ? 'min-h-11 py-1.5' : 'h-8'
        )}
      >
        {!hideChrome ? (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/40">
              <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </span>
            <span className="font-medium text-xs">{t('terminal.title')}</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Braces className="h-3 w-3 text-primary/70" aria-hidden />
            <span className="font-medium text-foreground/80">{t('terminal.ordaBadge')}</span>
            <span className="text-border">·</span>
            <code className="rounded bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground">
              {t('terminal.hint')}
            </code>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {running ? (
            <span className="mr-1 hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {t('terminal.running')}
            </span>
          ) : null}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={clearOutput}
                  aria-label={t('terminal.clear')}
                  disabled={output.length === 0}
                >
                  <Eraser className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('terminal.clear')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {mobile ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 px-3"
              onClick={() => setConsoleOpen(false)}
            >
              {t('terminal.done')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-auto px-1.5 py-1.5 font-mono text-[11px]">
        {output.length === 0 ? (
          <TerminalEmptyState onInsertExample={insertExample} />
        ) : (
          <ul className="flex flex-col">
            {output.map((cell, index) => (
              <TerminalOutputRow
                key={cell.id}
                cell={cell}
                isFirstOfRun={cell.kind === 'input' && index > 0}
              />
            ))}
            <div ref={outputEndRef} />
          </ul>
        )}
      </div>

      <TerminalComposer
        draft={draft}
        running={running}
        editorPrefs={editorPrefs}
        exampleChips={exampleChips}
        onDraftChange={(value) => {
          setDraft(value)
          resetHistoryCursor()
        }}
        onRun={handleRun}
        onEditorPrefsChange={setEditorPrefs}
        onMount={onMount}
      />
    </div>
  )
}
