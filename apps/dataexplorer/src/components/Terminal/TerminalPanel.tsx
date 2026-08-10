import type { CatalogAllResponse } from '@4d/rest'
import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import type { CodeEditorInstance } from '@4d/ui/code-editor'
import { BookOpen, Braces, Eraser, Terminal as TerminalIcon } from 'lucide-react'
import type * as MonacoEditor from 'monaco-editor'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { api, client } from '~/lib/api'
import { isMobileShell } from '~/lib/platform'
import { createDatastore, executeSnippet, formatTerminalResult } from '~/lib/terminal'
import { executeDotCommand, parseDotCommand } from '~/lib/terminal/dot-commands'
import { useDataExplorerStore } from '~/store'
import { useCodeEditorPrefs, useSettingsStore, useUpdateCodeEditorPrefs } from '~/store/settings'
import { useTerminalStore } from '~/store/terminal'
import { type TerminalSnippet, useTerminalSnippetsStore } from '~/store/terminal-snippets'
import { registerOrdaJsProviders } from './orda-js-completion'
import { TerminalComposer } from './TerminalComposer'
import { TerminalEmptyState } from './TerminalEmptyState'
import { TerminalHistoryNavigator } from './TerminalHistoryNavigator'
import { TerminalOutputRow } from './TerminalOutputRow'
import { snippetFileName, TerminalSnippetsFiles } from './TerminalSnippetsFiles'

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
  const historyCount = useTerminalStore((s) => s.history.length)
  const historyIndex = useTerminalStore((s) => s.historyIndex)

  const setDraft = useTerminalStore((s) => s.setDraft)
  const setRunning = useTerminalStore((s) => s.setRunning)
  const appendOutput = useTerminalStore((s) => s.appendOutput)
  const clearOutput = useTerminalStore((s) => s.clearOutput)
  const pushHistory = useTerminalStore((s) => s.pushHistory)
  const historyUp = useTerminalStore((s) => s.historyUp)
  const historyDown = useTerminalStore((s) => s.historyDown)
  const resetHistoryCursor = useTerminalStore((s) => s.resetHistoryCursor)

  const snippets = useTerminalSnippetsStore((s) => s.snippets)
  const updateSnippet = useTerminalSnippetsStore((s) => s.updateSnippet)
  const removeSnippet = useTerminalSnippetsStore((s) => s.removeSnippet)

  const [catalog, setCatalog] = useState<CatalogAllResponse | null>(null)
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null)
  const [snippetDirty, setSnippetDirty] = useState(false)
  const [startCreateRequest, setStartCreateRequest] = useState(0)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<CodeEditorInstance | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const runningRef = useRef(running)
  runningRef.current = running
  const applyingHistoryRef = useRef(false)
  const replDraftRef = useRef('')
  const activeSnippetIdRef = useRef<string | null>(null)
  activeSnippetIdRef.current = activeSnippetId

  const activeSnippet = useMemo(
    () => (activeSnippetId ? snippets.find((s) => s.id === activeSnippetId) : undefined),
    [activeSnippetId, snippets]
  )

  const dataClassNames = useMemo(() => dataclasses.map((d) => d.name), [dataclasses])
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

  // If the open snippet was deleted elsewhere, return to REPL.
  useEffect(() => {
    if (activeSnippetId && !snippets.some((s) => s.id === activeSnippetId)) {
      setActiveSnippetId(null)
      setSnippetDirty(false)
      setDraft(replDraftRef.current)
    }
  }, [activeSnippetId, snippets, setDraft])

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

  const applyDraft = useCallback(
    (code: string) => {
      setDraft(code)
      resetHistoryCursor()
      const editor = editorRef.current
      if (editor) {
        editor.setValue(code)
        const line = editor.getModel()?.getLineCount() ?? 1
        const col = editor.getModel()?.getLineMaxColumn(line) ?? 1
        editor.setPosition({ lineNumber: line, column: col })
        editor.focus()
      }
    },
    [resetHistoryCursor, setDraft]
  )

  const applyHistoryDraft = useCallback(
    (code: string) => {
      applyingHistoryRef.current = true
      setDraft(code)
      const editor = editorRef.current
      if (editor) {
        if (editor.getValue() !== code) editor.setValue(code)
        const line = editor.getModel()?.getLineCount() ?? 1
        const col = editor.getModel()?.getLineMaxColumn(line) ?? 1
        editor.setPosition({ lineNumber: line, column: col })
        editor.focus()
      }
      queueMicrotask(() => {
        applyingHistoryRef.current = false
      })
    },
    [setDraft]
  )

  const showPreviousHistory = useCallback(() => {
    const code = historyUp(editorRef.current?.getValue() ?? draftRef.current)
    if (code !== null) applyHistoryDraft(code)
  }, [applyHistoryDraft, historyUp])

  const showNextHistory = useCallback(() => {
    const code = historyDown()
    if (code !== null) applyHistoryDraft(code)
  }, [applyHistoryDraft, historyDown])

  const persistActiveSnippet = useCallback(() => {
    const id = activeSnippetIdRef.current
    if (!id) return
    const snippet = useTerminalSnippetsStore.getState().snippets.find((s) => s.id === id)
    if (!snippet) return
    const code = draftRef.current
    if (!code.trim()) return
    if (code === snippet.code) {
      setSnippetDirty(false)
      return
    }
    updateSnippet(id, { name: snippet.name, code })
    setSnippetDirty(false)
  }, [updateSnippet])

  const openSnippet = useCallback(
    (snippet: TerminalSnippet) => {
      if (activeSnippetIdRef.current === snippet.id) {
        editorRef.current?.focus()
        return
      }
      if (activeSnippetIdRef.current) {
        persistActiveSnippet()
      } else {
        replDraftRef.current = draftRef.current
      }
      setActiveSnippetId(snippet.id)
      setSnippetDirty(false)
      applyDraft(snippet.code)
    },
    [applyDraft, persistActiveSnippet]
  )

  const closeSnippet = useCallback(() => {
    persistActiveSnippet()
    setActiveSnippetId(null)
    setSnippetDirty(false)
    applyDraft(replDraftRef.current)
  }, [applyDraft, persistActiveSnippet])

  const lastSnippetIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeSnippetId) lastSnippetIdRef.current = activeSnippetId
  }, [activeSnippetId])

  const handleModeChange = useCallback(
    (next: 'repl' | 'snippet') => {
      if (next === 'repl') {
        if (activeSnippetIdRef.current) closeSnippet()
        return
      }
      if (activeSnippetIdRef.current) {
        editorRef.current?.focus()
        return
      }
      const list = useTerminalSnippetsStore.getState().snippets
      if (list.length === 0) {
        setStartCreateRequest((n) => n + 1)
        return
      }
      const lastId = lastSnippetIdRef.current
      const preferred =
        (lastId ? list.find((s) => s.id === lastId) : undefined) ??
        [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (preferred) openSnippet(preferred)
    },
    [closeSnippet, openSnippet]
  )

  const saveActiveSnippet = useCallback(() => {
    persistActiveSnippet()
  }, [persistActiveSnippet])

  const deleteActiveSnippet = useCallback(() => {
    const id = activeSnippetIdRef.current
    if (!id) return
    removeSnippet(id)
    setActiveSnippetId(null)
    setSnippetDirty(false)
    applyDraft(replDraftRef.current)
  }, [applyDraft, removeSnippet])

  const runJs = useCallback(
    async (trimmed: string) => {
      appendOutput({ kind: 'input', source: trimmed })
      pushHistory(trimmed)
      resetHistoryCursor()
      if (!activeSnippetIdRef.current) {
        clearInput()
      }
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
    [appendOutput, clearInput, pushHistory, resetHistoryCursor, setRunning]
  )

  const runCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim()
      if (!trimmed || runningRef.current) return

      // Single-line `.command` works in both REPL and Code (e.g. toolbar .help).
      const dot = parseDotCommand(trimmed)
      if (dot) {
        appendOutput({ kind: 'input', source: trimmed })
        pushHistory(trimmed)
        resetHistoryCursor()
        if (!activeSnippetIdRef.current) {
          clearInput()
        }

        const result = executeDotCommand(dot)
        if (result.kind === 'noop') {
          editorRef.current?.focus()
          return
        }
        if (result.kind === 'markdown') {
          appendOutput({ kind: 'system', markdown: result.markdown })
        } else if (result.kind === 'message') {
          appendOutput({ kind: 'system', systemMessage: result.text })
        } else if (result.kind === 'error') {
          appendOutput({ kind: 'error', errorMessage: result.message })
        } else if (result.kind === 'load') {
          appendOutput({
            kind: 'system',
            systemMessage: t('terminal.command.loaded', { name: dot.arg }),
          })
          const snippet = useTerminalSnippetsStore.getState().getByName(dot.arg)
          if (snippet) {
            openSnippet(snippet)
          } else {
            applyDraft(result.code)
          }
          return
        } else if (result.kind === 'run') {
          appendOutput({
            kind: 'system',
            systemMessage: t('terminal.command.runningSnippet', { name: dot.arg }),
          })
          await runJs(result.code)
          return
        }
        editorRef.current?.focus()
        return
      }

      if (activeSnippetIdRef.current) {
        persistActiveSnippet()
      }
      await runJs(trimmed)
    },
    [
      appendOutput,
      applyDraft,
      clearInput,
      openSnippet,
      persistActiveSnippet,
      pushHistory,
      resetHistoryCursor,
      runJs,
      t,
    ]
  )

  const handleRun = useCallback(() => {
    void runCode(draftRef.current)
  }, [runCode])

  const showHelp = useCallback(() => {
    void runCode('.help')
  }, [runCode])

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value)
      if (!applyingHistoryRef.current) resetHistoryCursor()
      const id = activeSnippetIdRef.current
      if (!id) return
      const snippet = useTerminalSnippetsStore.getState().snippets.find((s) => s.id === id)
      setSnippetDirty(!snippet || value !== snippet.code)
    },
    [resetHistoryCursor, setDraft]
  )

  const lastOutputId = output[output.length - 1]?.id
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
        snippets: useTerminalSnippetsStore.getState().snippets.map((s) => s.name),
      }))

      // Bind only when suggest is closed (`!suggestWidgetVisible`). Unconditional
      // addCommand steals Up/Down/Enter from Monaco's suggest widget.
      editor.addCommand(
        monaco.KeyCode.Enter,
        () => {
          // Code mode: Enter inserts a newline. REPL: Enter runs.
          if (activeSnippetIdRef.current) {
            editor.trigger('keyboard', 'type', { text: '\n' })
            return
          }
          void runCode(editor.getValue())
        },
        '!suggestWidgetVisible'
      )

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        // Code mode: Shift+Enter runs. REPL: Shift+Enter inserts a newline.
        if (activeSnippetIdRef.current) {
          void runCode(editor.getValue())
          return
        }
        editor.trigger('keyboard', 'type', { text: '\n' })
      })

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void runCode(editor.getValue())
      })

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (activeSnippetIdRef.current) {
          persistActiveSnippet()
        }
      })

      editor.addCommand(
        monaco.KeyCode.UpArrow,
        () => {
          const model = editor.getModel()
          const position = editor.getPosition()
          if (!model || !position) return
          if (position.lineNumber !== 1) {
            editor.trigger('keyboard', 'cursorUp', {})
            return
          }
          if (activeSnippetIdRef.current) return
          showPreviousHistory()
        },
        '!suggestWidgetVisible'
      )

      editor.addCommand(
        monaco.KeyCode.DownArrow,
        () => {
          const model = editor.getModel()
          const position = editor.getPosition()
          if (!model || !position) return
          if (position.lineNumber !== model.getLineCount()) {
            editor.trigger('keyboard', 'cursorDown', {})
            return
          }
          if (activeSnippetIdRef.current) return
          showNextHistory()
        },
        '!suggestWidgetVisible'
      )

      editor.focus()

      // Composer sits at the bottom of the dock — keep the suggest widget above the caret.
      const suggest = editor.getContribution('editor.contrib.suggestController') as {
        forceRenderingAbove?: () => void
      } | null
      suggest?.forceRenderingAbove?.()
    },
    [persistActiveSnippet, runCode, showNextHistory, showPreviousHistory]
  )

  useEffect(() => {
    return () => {
      providersRef.current?.()
      providersRef.current = null
    }
  }, [])

  const exampleChips = (
    <>
      <TerminalSnippetsFiles
        activeSnippetId={activeSnippetId}
        startCreateRequest={startCreateRequest}
        mobile={mobile}
        onOpenSnippet={openSnippet}
        onCloseSnippet={closeSnippet}
        onCreated={(snippet) => {
          openSnippet(snippet)
        }}
        onStatus={(message) => {
          appendOutput({ kind: 'system', systemMessage: message })
        }}
      />
      <Button
        size={mobile ? 'sm' : 'xs'}
        variant="ghost"
        className={cn(
          'shrink-0 touch-manipulation gap-1 text-muted-foreground',
          mobile ? 'h-9 px-2.5 text-xs' : 'h-6 px-1.5 text-[10px]'
        )}
        onClick={showHelp}
      >
        <BookOpen className={mobile ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden />
        {t('terminal.helpAction')}
      </Button>
    </>
  )

  const editorPath = activeSnippet
    ? `orda-terminal:///snippets/${activeSnippet.id}.js`
    : 'orda-terminal:///input.js'

  return (
    <section
      className="relative flex h-full min-h-0 flex-col bg-background"
      aria-label={t('terminal.title')}
    >
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
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Braces className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            <span className="font-medium text-foreground/80">{t('terminal.ordaBadge')}</span>
            {!mobile ? (
              <>
                <span className="text-border">·</span>
                <code className="rounded bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground">
                  {t('terminal.hint')}
                </code>
              </>
            ) : null}
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
                  size={mobile ? 'sm' : 'xs'}
                  variant="ghost"
                  className={cn('touch-manipulation', mobile ? 'h-9 w-9 p-0' : 'h-6 w-6 p-0')}
                  onClick={clearOutput}
                  aria-label={t('terminal.clear')}
                  disabled={output.length === 0}
                >
                  <Eraser className={mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('terminal.clear')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {mobile ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 touch-manipulation px-3"
              onClick={() => setConsoleOpen(false)}
            >
              {t('terminal.done')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-auto px-1.5 py-1.5 font-mono text-[11px]">
        {output.length === 0 ? (
          <TerminalEmptyState
            snippets={snippets}
            onOpenSnippet={openSnippet}
            onNewSnippet={() => setStartCreateRequest((n) => n + 1)}
            onShowHelp={showHelp}
          />
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
        mode={activeSnippet ? 'snippet' : 'repl'}
        fileName={activeSnippet ? snippetFileName(activeSnippet.name) : undefined}
        dirty={snippetDirty}
        editorPath={editorPath}
        mobile={mobile}
        historyNavigator={
          mobile && historyCount > 0 ? (
            <TerminalHistoryNavigator
              count={historyCount}
              index={historyIndex}
              onPrevious={showPreviousHistory}
              onNext={showNextHistory}
            />
          ) : null
        }
        onDraftChange={handleDraftChange}
        onRun={handleRun}
        onSaveFile={saveActiveSnippet}
        onDeleteFile={deleteActiveSnippet}
        onCloseFile={closeSnippet}
        onModeChange={handleModeChange}
        onEditorPrefsChange={setEditorPrefs}
        onMount={onMount}
      />
    </section>
  )
}
