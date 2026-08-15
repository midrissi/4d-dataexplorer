import {
  createLanguageService,
  DiagnosticSeverity,
  type LanguageService,
} from '@4d/orda-language-service'
import {
  Button,
  ClickToCopy,
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { CodeEditor, type CodeEditorInstance } from '@4d/ui/code-editor'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import type * as MonacoEditor from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiGenerateQueryModal } from '~/components/AiActions'
import { AssistantSparklesIcon } from '~/components/AssistantSparklesIcon'
import { EmptyPanel } from '~/components/EmptyPanel'
import { EnvThisProvider } from '~/components/Environments/env-this-context'
import {
  flushPendingArgumentValues,
  RuntimeArgumentsEditor,
  readLiveArgumentInputValues,
} from '~/components/MethodExecutor/RuntimeArgumentsEditor'
import { QueryExplainToggle } from '~/components/QueryExplain/QueryExplainToggle'
import { useAssistantLlmConfigured } from '~/hooks/useAssistantLlmConfigured'
import { useCloudLlmOffline } from '~/hooks/useCloudLlmOffline'
import { getIntlLocale, useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { buildQueryThis } from '~/lib/env/this-context-builders'
import {
  mobileFullscreenDialogClass,
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'
import { formatTime } from '~/lib/utils'
import { useDataExplorerStore } from '~/store'
import {
  useAiTasksStore,
  useHasRunningAiQueryTaskForDataclass,
  useRunningAiQueryTaskIdForDataclass,
} from '~/store/ai-tasks'
import { useHistoryStore } from '~/store/history'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { useDefaultQueryRunMode, usePageSize } from '~/store/settings'
import {
  isDataclassTab,
  normalizeQueryOptions,
  type QueryOptions,
  useActiveDataclassTab,
  useTabsStore,
} from '~/store/tabs'
import { AttributePathInput } from './AttributePathInput'
import { AttributeTagsInput, parseSelectAttributes } from './AttributeTagsInput'
import { filterParamToRuntimeArgument, runtimeArgumentToFilterParam } from './filter-param-runtime'
import { mapOrdaCompletionKind } from './orda-completion'
import { formatOrdaHoverMarkdown } from './orda-hover'
import {
  ORDA_LANGUAGE_CONFIGURATION,
  ORDA_LANGUAGE_ID,
  ORDA_MONARCH_LANGUAGE,
} from './orda-language'
import { offsetToEditorPosition } from './orda-position'
import { clearOrdaProviders, replaceOrdaProviders } from './orda-providers'

const FILTER_ARGUMENT_KINDS = [
  'string',
  'number',
  'boolean',
  'date',
  'custom',
] as const satisfies ReadonlyArray<RuntimeArgument['kind']>

export function QueryBuilder() {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  const mobile = isMobileShell()
  const { selectedDataclass, fetchEntities, entitiesLoading } = useDataExplorerStore()
  const defaultQueryRunMode = useDefaultQueryRunMode()
  const pageSize = usePageSize()
  const defaultCreateEntitySet = defaultQueryRunMode === 'runAsSelection'
  const llmConfigured = useAssistantLlmConfigured()
  const cloudLlmOffline = useCloudLlmOffline()
  const [generateQueryOpen, setGenerateQueryOpen] = useState(false)
  const queryGenerating = useHasRunningAiQueryTaskForDataclass(selectedDataclass ?? undefined)
  const runningQueryTaskId = useRunningAiQueryTaskIdForDataclass(selectedDataclass ?? undefined)
  const openAiTask = useAiTasksStore((state) => state.openTask)

  const activeDataclassTab = useActiveDataclassTab()
  const setQueryOptions = useTabsStore((state) => state.setQueryOptions)
  const setQueryExpanded = useTabsStore((state) => state.setQueryExpanded)
  const resetQueryOptions = useTabsStore((state) => state.resetQueryOptions)
  const setEntitySetId = useTabsStore((state) => state.setEntitySetId)

  const boundEntitySetId = activeDataclassTab?.entitySetId ?? ''

  const isExpanded = activeDataclassTab?.queryExpanded ?? false
  const queryPanelHeight = activeDataclassTab?.queryPanelHeight ?? null

  // Get query options from active tab, with defaults for any missing fields
  const queryOptions: QueryOptions = useMemo(
    () =>
      normalizeQueryOptions({
        filter: activeDataclassTab?.queryOptions?.filter,
        filterParams: activeDataclassTab?.queryOptions?.filterParams,
        sort: activeDataclassTab?.queryOptions?.sort,
        order: activeDataclassTab?.queryOptions?.order,
        select: activeDataclassTab?.queryOptions?.select,
        top: activeDataclassTab?.queryOptions?.top,
        limit: (activeDataclassTab?.queryOptions as { limit?: number } | undefined)?.limit,
        explain: activeDataclassTab?.queryOptions?.explain,
      }),
    [
      activeDataclassTab?.queryOptions?.filter,
      activeDataclassTab?.queryOptions?.filterParams,
      activeDataclassTab?.queryOptions?.sort,
      activeDataclassTab?.queryOptions?.order,
      activeDataclassTab?.queryOptions?.select,
      activeDataclassTab?.queryOptions?.top,
      activeDataclassTab?.queryOptions?.explain,
      activeDataclassTab?.queryOptions,
    ]
  )

  const { addToHistory, removeFromHistory, clearHistory, getHistory } = useHistoryStore()

  const [showHistory, setShowHistory] = useState(false)
  // localFilter is the filter expression string
  const [localFilter, setLocalFilter] = useState(() => queryOptions.filter)
  const [localEntitySetId, setLocalEntitySetId] = useState(boundEntitySetId)
  const [entitySetIdEditing, setEntitySetIdEditing] = useState(false)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [entitySetError, setEntitySetError] = useState<string | null>(null)
  const [ordaService, setOrdaService] = useState<LanguageService | null>(null)

  const filterEditorRef = useRef<CodeEditorInstance | null>(null)
  const ordaServiceRef = useRef<LanguageService | null>(null)
  const ordaLanguageConfiguredRef = useRef(false)
  const localFilterRef = useRef(localFilter)
  localFilterRef.current = localFilter

  ordaServiceRef.current = ordaService

  // Sync local filter with query options when tab changes or store rehydrates.
  useEffect(() => {
    setLocalFilter(queryOptions.filter)
  }, [queryOptions.filter])

  useEffect(() => {
    let cancelled = false

    if (!selectedDataclass) {
      setOrdaService(null)
      return
    }

    api
      .getCatalog()
      .then((catalog) => {
        if (cancelled) return
        setOrdaService(createLanguageService(catalog, selectedDataclass))
      })
      .catch(() => {
        if (cancelled) return
        setOrdaService(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDataclass])

  const activeDataclassTabId = activeDataclassTab?.id
  const previousDataclassTabId = useRef(activeDataclassTabId)
  const entitySetInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalEntitySetId(boundEntitySetId)
    setEntitySetError(null)
  }, [boundEntitySetId])

  useEffect(() => {
    if (previousDataclassTabId.current !== activeDataclassTabId) {
      previousDataclassTabId.current = activeDataclassTabId
      setEntitySetIdEditing(false)
    }
  }, [activeDataclassTabId])

  useEffect(() => {
    const input = entitySetInputRef.current
    if (!input) return

    if (entitySetIdEditing) {
      input.focus()
      input.select()
      return
    }

    // Collapse selection after validate/cancel; text stays selectable in read-only mode
    const end = input.value.length
    input.setSelectionRange(end, end)
    input.blur()
  }, [entitySetIdEditing])

  const history = selectedDataclass ? getHistory(selectedDataclass) : []

  const handleSetQueryOptions = useCallback(
    (options: Partial<QueryOptions>) => {
      if (activeDataclassTab) {
        setQueryOptions(activeDataclassTab.id, options)
      }
    },
    [activeDataclassTab, setQueryOptions]
  )

  // Persist filter drafts like sort/select so a page refresh keeps the expression.
  // (Previously only Run wrote filter into the tab store.)
  const handleFilterChange = useCallback(
    (value: string) => {
      setLocalFilter(value)
      handleSetQueryOptions({ filter: value })
    },
    [handleSetQueryOptions]
  )

  const handleResetQueryOptions = useCallback(() => {
    if (activeDataclassTab) {
      resetQueryOptions(activeDataclassTab.id)
    }
  }, [activeDataclassTab, resetQueryOptions])

  const handleCollapse = useCallback(() => {
    if (activeDataclassTab) {
      setQueryExpanded(activeDataclassTab.id, false)
    }
  }, [activeDataclassTab, setQueryExpanded])

  const handleRun = useCallback(
    (createEntitySet?: boolean) => {
      const shouldCreateEntitySet = createEntitySet ?? defaultCreateEntitySet
      setFilterError(null)
      setEntitySetError(null)
      setEntitySetIdEditing(false)
      setLocalEntitySetId('')

      // Commit in-progress param drafts before reading query options for the run.
      flushPendingArgumentValues()
      const tabsState = useTabsStore.getState()
      const tab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
      let storedOptions =
        tab && isDataclassTab(tab) ? normalizeQueryOptions(tab.queryOptions) : queryOptions

      // Cmd/Ctrl+Enter while focused in a param field: trust the live DOM values.
      const liveByName = readLiveArgumentInputValues()
      if (Object.keys(liveByName).length > 0 && storedOptions.filterParams.length > 0) {
        const filterParams = storedOptions.filterParams.map((param, index) => {
          const live = liveByName[`:${index + 1}`]
          return live !== undefined ? { ...param, value: live } : param
        })
        storedOptions = { ...storedOptions, filterParams }
      }

      const newQueryOptions = {
        ...storedOptions,
        filter: localFilter,
        filterParams: storedOptions.filterParams,
      }
      handleSetQueryOptions({ filter: localFilter, filterParams: storedOptions.filterParams })

      fetchEntities(1, newQueryOptions, { createEntitySet: shouldCreateEntitySet }).then(() => {
        if (selectedDataclass) {
          const currentPagination = useDataExplorerStore.getState().pagination
          addToHistory(selectedDataclass, newQueryOptions, currentPagination?.total)
        }
        // Mobile: fold the panel so results are visible after run.
        if (isMobileShell() && activeDataclassTab) {
          setQueryExpanded(activeDataclassTab.id, false)
        }
      })
    },
    [
      localFilter,
      queryOptions,
      handleSetQueryOptions,
      fetchEntities,
      selectedDataclass,
      addToHistory,
      defaultCreateEntitySet,
      activeDataclassTab,
      setQueryExpanded,
    ]
  )

  const handleReset = useCallback(() => {
    handleResetQueryOptions()
    setLocalFilter('')
    setLocalEntitySetId('')
    setEntitySetIdEditing(false)
    setFilterError(null)
    setEntitySetError(null)
    fetchEntities(
      1,
      {
        filter: '',
        filterParams: [],
        sort: '',
        order: 'desc',
        select: '',
        top: pageSize,
      },
      { createEntitySet: false }
    )
  }, [handleResetQueryOptions, fetchEntities, pageSize])

  const displayedEntitySetId = entitySetIdEditing
    ? localEntitySetId
    : boundEntitySetId || localEntitySetId
  const entitySetActionCount =
    (entitySetIdEditing ? 2 : 0) +
    (!entitySetIdEditing && displayedEntitySetId.trim() ? 1 : 0) +
    (!entitySetIdEditing ? 2 : 0)
  const entitySetInputPadding =
    entitySetActionCount >= 3 ? 'pr-24' : entitySetActionCount === 2 ? 'pr-16' : 'pr-9'

  const handleCancelEntitySetEdit = useCallback(() => {
    setLocalEntitySetId(boundEntitySetId)
    setEntitySetIdEditing(false)
    setEntitySetError(null)
  }, [boundEntitySetId])

  const handleStartEntitySetEdit = useCallback(() => {
    setLocalEntitySetId(boundEntitySetId || localEntitySetId)
    setEntitySetIdEditing(true)
    setEntitySetError(null)
  }, [boundEntitySetId, localEntitySetId])

  const handleLoadEntitySet = useCallback(() => {
    const id = (entitySetIdEditing ? localEntitySetId : boundEntitySetId || localEntitySetId).trim()
    if (!activeDataclassTab) return

    setEntitySetError(null)
    setEntitySetIdEditing(false)

    if (!id) {
      setLocalEntitySetId('')
      setEntitySetId(activeDataclassTab.id, null)
      fetchEntities(1)
      return
    }

    setLocalEntitySetId(id)
    setEntitySetId(activeDataclassTab.id, id)
    fetchEntities(1)
  }, [
    entitySetIdEditing,
    localEntitySetId,
    boundEntitySetId,
    activeDataclassTab,
    setEntitySetId,
    fetchEntities,
  ])

  const handleEntitySetKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!entitySetIdEditing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancelEntitySetEdit()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleLoadEntitySet()
      }
    },
    [entitySetIdEditing, handleCancelEntitySetEdit, handleLoadEntitySet]
  )

  const handleApplyHistory = useCallback(
    (item: (typeof history)[0]) => {
      handleSetQueryOptions(item.query)
      setLocalFilter(item.query.filter)
      setFilterError(null)
      fetchEntities(1, item.query)
      setShowHistory(false)
    },
    [handleSetQueryOptions, fetchEntities]
  )

  const handleOpenGenerateQuery = useCallback(() => {
    if (runningQueryTaskId) {
      openAiTask(runningQueryTaskId)
      return
    }
    setGenerateQueryOpen(true)
  }, [openAiTask, runningQueryTaskId])

  const handleRemoveHistory = useCallback(
    (itemId: string) => {
      if (selectedDataclass) {
        removeFromHistory(selectedDataclass, itemId)
      }
    },
    [selectedDataclass, removeFromHistory]
  )

  const filterAnnotations = useMemo(() => {
    if (!ordaService || !localFilter.trim()) return []

    return ordaService.validate(localFilter).map((diagnostic) => {
      const { row, column } = offsetToEditorPosition(localFilter, diagnostic.range.start)
      return {
        row,
        column,
        text: diagnostic.message,
        type: diagnostic.severity === DiagnosticSeverity.Warning ? 'warning' : 'error',
      } as const
    })
  }, [localFilter, ordaService])

  const registerOrdaProviders = useCallback((monaco: typeof MonacoEditor) => {
    const completionProvider = monaco.languages.registerCompletionItemProvider(ORDA_LANGUAGE_ID, {
      triggerCharacters: ['.', ' ', ':', '=', '!', '<', '>'],
      provideCompletionItems(
        model: MonacoEditor.editor.ITextModel,
        position: MonacoEditor.Position
      ) {
        const editorModel = filterEditorRef.current?.getModel()
        if (!editorModel || model !== editorModel) return { suggestions: [] }

        const service = ordaServiceRef.current
        if (!service) return { suggestions: [] }

        const query = model.getValue()
        const offset = model.getOffsetAt(position)
        const items = service.complete(query, offset)

        const seen = new Set<string>()
        const suggestions = items.flatMap((item) => {
          // Prefer label+kind so identical attribute rows from overlapping
          // providers / catalog dupes collapse even when insertText differs.
          const dedupeKey = `${item.kind}\0${item.label}`
          if (seen.has(dedupeKey)) return []
          seen.add(dedupeKey)

          const word = model.getWordUntilPosition(position)
          const range = item.range
            ? (() => {
                const start = model.getPositionAt(item.range.start)
                const end = model.getPositionAt(item.range.end)
                return {
                  startLineNumber: start.lineNumber,
                  startColumn: start.column,
                  endLineNumber: end.lineNumber,
                  endColumn: end.column,
                }
              })()
            : {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
              }

          const monacoKind = mapOrdaCompletionKind(item.kind, monaco)

          return [
            {
              label: item.label,
              insertText: item.insertText,
              insertTextRules: item.isSnippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              kind: monacoKind,
              detail: item.detail,
              documentation: item.documentation,
              sortText: String(item.sortOrder ?? 999).padStart(4, '0'),
              range,
              command: item.insertText.endsWith('.')
                ? {
                    id: 'editor.action.triggerSuggest',
                    title: 'Trigger Suggest',
                  }
                : undefined,
            },
          ]
        })

        return { suggestions }
      },
    })

    const hoverProvider = monaco.languages.registerHoverProvider(ORDA_LANGUAGE_ID, {
      provideHover(model: MonacoEditor.editor.ITextModel, position: MonacoEditor.Position) {
        const editorModel = filterEditorRef.current?.getModel()
        if (!editorModel || model !== editorModel) return null

        const service = ordaServiceRef.current
        if (!service) return null

        const query = model.getValue()
        const offset = model.getOffsetAt(position)
        const info = service.hover(query, offset)
        if (!info) return null

        const start = model.getPositionAt(info.range.start)
        const end = model.getPositionAt(info.range.end)

        return {
          range: {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
          },
          contents: [
            {
              value: formatOrdaHoverMarkdown(info.contents.value),
              supportThemeIcons: true,
              supportHtml: true,
            },
          ],
        }
      },
    })

    const formatProvider = monaco.languages.registerDocumentFormattingEditProvider(
      ORDA_LANGUAGE_ID,
      {
        provideDocumentFormattingEdits(model: MonacoEditor.editor.ITextModel) {
          const editorModel = filterEditorRef.current?.getModel()
          if (!editorModel || model !== editorModel) return []

          const service = ordaServiceRef.current
          if (!service) return []

          const source = model.getValue()
          const formatted = service.format(source)
          if (formatted === source) return []

          return [{ range: model.getFullModelRange(), text: formatted }]
        },
      }
    )

    replaceOrdaProviders([completionProvider, hoverProvider, formatProvider])
  }, [])

  const handleFilterEditorMount = useCallback(
    (editor: CodeEditorInstance, monaco: typeof MonacoEditor) => {
      filterEditorRef.current = editor

      if (
        !monaco.languages
          .getLanguages()
          .some((lang: { id: string }) => lang.id === ORDA_LANGUAGE_ID)
      ) {
        monaco.languages.register({ id: ORDA_LANGUAGE_ID })
      }

      if (!ordaLanguageConfiguredRef.current) {
        monaco.languages.setMonarchTokensProvider(ORDA_LANGUAGE_ID, ORDA_MONARCH_LANGUAGE)
        monaco.languages.setLanguageConfiguration(ORDA_LANGUAGE_ID, ORDA_LANGUAGE_CONFIGURATION)
        ordaLanguageConfiguredRef.current = true
      }

      // keepCurrentModel can restore a stale path model after collapse/remount;
      // align with the React-controlled filter string on every mount.
      const expected = localFilterRef.current
      if (editor.getValue() !== expected) {
        editor.setValue(expected)
      }

      registerOrdaProviders(monaco)
    },
    [registerOrdaProviders]
  )

  useEffect(() => {
    return () => {
      clearOrdaProviders()
    }
  }, [])

  const handleClearHistory = useCallback(() => {
    if (selectedDataclass) {
      clearHistory(selectedDataclass)
    }
  }, [selectedDataclass, clearHistory])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleRun()
      }
    },
    [handleRun]
  )

  const formatQuery = (query: typeof queryOptions) => {
    const parts: string[] = []
    if (query.filter) {
      parts.push(query.filter.length > 30 ? `${query.filter.slice(0, 30)}...` : query.filter)
    }
    if (query.filterParams?.length) {
      parts.push(`${query.filterParams.length} param(s)`)
    }
    if (query.sort) {
      parts.push(`sort: ${query.sort} ${query.order}`)
    }
    if (query.select) {
      parts.push(`fields: ${query.select}`)
    }
    if (query.top !== 100) {
      parts.push(`$top: ${query.top}`)
    }
    return parts.join(' | ') || t('query.customQuery')
  }

  const filterParams = queryOptions.filterParams ?? []
  const filterParamIdsRef = useRef<string[]>([])

  const filterArguments = useMemo(() => {
    const ids = filterParamIdsRef.current.slice(0, filterParams.length)
    while (ids.length < filterParams.length) {
      ids.push(crypto.randomUUID())
    }
    filterParamIdsRef.current = ids
    return filterParams.map((param, index) =>
      filterParamToRuntimeArgument(param, index, ids[index] ?? crypto.randomUUID())
    )
  }, [filterParams])

  const queryThis = useMemo(
    () =>
      buildQueryThis({
        dataclassName: selectedDataclass ?? '',
        queryOptions: {
          filter: localFilter,
          filterParams,
          sort: queryOptions.sort,
          order: queryOptions.order,
          select: queryOptions.select,
          top: queryOptions.top,
        },
        entitySetId: boundEntitySetId || null,
      }),
    [
      selectedDataclass,
      localFilter,
      filterParams,
      queryOptions.sort,
      queryOptions.order,
      queryOptions.select,
      queryOptions.top,
      boundEntitySetId,
    ]
  )

  const selectedAttributeCount = parseSelectAttributes(queryOptions.select).length

  const historyPanelBody = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-sm">{t('query.queryHistory')}</span>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-destructive"
            onClick={handleClearHistory}
          >
            <Trash2 className="h-3 w-3" />
            {t('query.clearAll')}
          </Button>
        )}
      </div>
      {history.length === 0 ? (
        <EmptyPanel
          icon={History}
          title={t('query.noQueryHistoryYet')}
          description={t('query.noQueryHistoryDescription')}
          ghost="rows"
          bordered
          size="sm"
        />
      ) : (
        <ScrollArea className={mobile ? undefined : 'max-h-50'}>
          <div className="space-y-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 rounded-md p-2 hover:bg-muted"
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start text-left"
                  onClick={() => handleApplyHistory(item)}
                >
                  <code className="block truncate font-mono text-xs">
                    {formatQuery(item.query)}
                  </code>
                  <span className="text-muted-foreground text-xs">
                    {formatTime(item.timestamp, locale)}
                    {item.resultsCount !== undefined && ` · ${item.resultsCount} results`}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'shrink-0 transition-opacity',
                    mobile ? 'h-9 w-9' : 'h-6 w-6 opacity-0 group-hover:opacity-100'
                  )}
                  onClick={() => handleRemoveHistory(item.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  )

  const handleFilterArgumentsChange = useCallback(
    (argumentsList: RuntimeArgument[]) => {
      filterParamIdsRef.current = argumentsList.map((argument) => argument.id)
      handleSetQueryOptions({
        filterParams: argumentsList.map(runtimeArgumentToFilterParam),
      })
    },
    [handleSetQueryOptions]
  )

  return (
    <search
      data-query-builder-panel
      className={cn(
        'shrink-0 border-b',
        isExpanded && (mobile || queryPanelHeight != null) && 'flex flex-col overflow-hidden',
        mobile && isExpanded && 'max-h-[min(70dvh,36rem)]'
      )}
      style={
        !mobile && isExpanded && queryPanelHeight != null
          ? { height: `${queryPanelHeight}px` }
          : undefined
      }
      onKeyDown={handleKeyDown}
    >
      {/* Collapsed header — stays pinned so Run / Close remain reachable on mobile */}
      <div
        className={cn(
          '@container/query flex shrink-0 flex-wrap items-center gap-1.5 bg-background p-2 pr-4.5',
          mobile && 'z-10 gap-1.5 border-b'
        )}
      >
        <Button
          variant="ghost"
          size="xs"
          className={cn('gap-1 px-2 text-xs', mobile ? 'h-9' : 'h-6')}
          onClick={() => activeDataclassTab && setQueryExpanded(activeDataclassTab.id, !isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('common.collapsePanel') : t('common.expandPanel')}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {t('query.query')}
        </Button>
        {mobile && isExpanded ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-9 w-9 px-0"
            onClick={handleCollapse}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
        <div className="flex min-w-0 flex-1 basis-24 items-center gap-1.5">
          {!isExpanded && queryOptions.explain ? (
            <span className="inline-flex h-6 shrink-0 items-center rounded-sm bg-primary/10 px-1.5 font-medium text-[10px] text-primary uppercase leading-none">
              {t('queryExplain.badge')}
            </span>
          ) : null}
          {!isExpanded && boundEntitySetId ? (
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <code className="inline-flex h-6 min-w-0 max-w-full cursor-default items-center truncate rounded bg-muted px-2 font-mono text-muted-foreground text-xs leading-none">
                    {t('query.entitySetId')}:{' '}
                    {boundEntitySetId.length > 16
                      ? `${boundEntitySetId.slice(0, 16)}…`
                      : boundEntitySetId}
                  </code>
                </TooltipTrigger>
                <TooltipContent className="wrap-break-word max-w-sm font-mono text-xs">
                  {boundEntitySetId}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {!isExpanded && queryOptions.filter ? (
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <code className="inline-flex h-6 min-w-0 max-w-full cursor-default items-center truncate rounded bg-muted px-2 font-mono text-muted-foreground text-xs leading-none">
                    {queryOptions.filter.length > 50
                      ? `${queryOptions.filter.slice(0, 50)}…`
                      : queryOptions.filter}
                  </code>
                </TooltipTrigger>
                <TooltipContent className="wrap-break-word max-w-sm font-mono text-xs">
                  {queryOptions.filter}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className={cn(
                    'gap-1 px-1.5 text-xs',
                    showHistory && 'bg-accent',
                    mobile ? 'h-9 w-9 px-0' : 'h-6'
                  )}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-3.5 w-3.5" />
                  {history.length > 0 && !mobile && (
                    <span className="text-muted-foreground text-xs">{history.length}</span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('query.queryHistory')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className={cn(
                    'gap-1 @[28rem]/query:px-2 px-1.5 text-xs',
                    mobile ? 'h-9 w-9 px-0' : 'h-6'
                  )}
                  onClick={handleReset}
                  disabled={entitiesLoading}
                  aria-label={t('query.reset')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="@[28rem]/query:inline hidden">{t('query.reset')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('entity.resetQuery')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* On mobile when expanded, Run lives in the sticky footer below fields. */}
          {!(mobile && isExpanded) ? (
            <div className="flex items-center">
              <Button
                variant="default"
                size="xs"
                className={cn(
                  'gap-1 rounded-r-none @[28rem]/query:px-2 px-1.5 text-xs',
                  mobile ? 'h-9 px-2.5' : 'h-6'
                )}
                onClick={() => handleRun()}
                disabled={entitiesLoading}
              >
                <Play className="h-3.5 w-3.5" />
                <span className={mobile ? 'inline' : '@[22rem]/query:inline hidden'}>
                  {defaultCreateEntitySet ? t('query.runAsSelection') : t('query.run')}
                </span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="xs"
                    className={cn(
                      'rounded-l-none border-primary-foreground/20 border-l px-1.5',
                      mobile ? 'h-9 w-8' : 'h-6'
                    )}
                    disabled={entitiesLoading}
                    aria-label={t('query.runOptions')}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={mobile ? mobileMenuContentClass() : 'w-64'}
                  {...(mobile
                    ? mobileMenuCollisionProps
                    : { collisionPadding: 12, avoidCollisions: true })}
                >
                  <DropdownMenuItem
                    onClick={() => handleRun(false)}
                    className={cn(
                      'flex flex-col items-start gap-0.5',
                      mobile && mobileMenuItemClass('items-start')
                    )}
                  >
                    <span className="font-medium">{t('query.run')}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('query.runDescription')}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRun(true)}
                    className={cn(
                      'flex flex-col items-start gap-0.5',
                      mobile && mobileMenuItemClass('items-start')
                    )}
                  >
                    <span className="font-medium">{t('query.runAsSelection')}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('query.runAsSelectionDescription')}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>

      {/* History panel — a full-screen sheet on mobile (no hover affordances
          there), an inline dropdown panel on desktop. */}
      {showHistory && !mobile && (
        <div className="border-t bg-muted/30 px-3 py-2">{historyPanelBody}</div>
      )}
      {mobile && (
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className={mobileFullscreenDialogClass('overflow-hidden')} hideCloseButton>
            <DialogTitle className="sr-only">{t('query.queryHistory')}</DialogTitle>
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-border border-b px-2">
              <span className="pl-1 font-medium text-base">{t('query.queryHistory')}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setShowHistory(false)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{historyPanelBody}</div>
          </DialogContent>
        </Dialog>
      )}

      {/* Expanded content — capped by default; height becomes resizable via EntityList handle */}
      {isExpanded && (
        <div
          className={cn(
            'space-y-3 overflow-y-auto overscroll-contain px-3 pb-3',
            mobile || queryPanelHeight != null ? 'min-h-0 flex-1' : 'max-h-[min(45vh,28rem)]'
          )}
        >
          {/* Entity set ID */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('query.entitySetId')}</Label>
            <div className="relative">
              <Input
                ref={entitySetInputRef}
                value={displayedEntitySetId}
                onChange={(e) => {
                  setLocalEntitySetId(e.target.value)
                  setEntitySetError(null)
                }}
                readOnly={!entitySetIdEditing}
                onDoubleClick={() => {
                  if (!entitySetIdEditing) handleStartEntitySetEdit()
                }}
                onKeyDown={handleEntitySetKeyDown}
                placeholder={t('query.entitySetIdPlaceholder')}
                className={cn(
                  'h-7 w-full font-mono text-foreground text-xs',
                  entitySetInputPadding,
                  !entitySetIdEditing && 'cursor-default'
                )}
              />
              <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-0.5">
                {entitySetIdEditing ? (
                  <>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="pointer-events-auto h-7 w-7"
                            onClick={handleLoadEntitySet}
                            disabled={entitiesLoading}
                            aria-label={t('query.loadEntitySet')}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('query.loadEntitySet')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="pointer-events-auto h-7 w-7"
                            onClick={handleCancelEntitySetEdit}
                            aria-label={t('query.cancelEntitySetEdit')}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('query.cancelEntitySetEdit')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : (
                  <>
                    {displayedEntitySetId.trim() ? (
                      <ClickToCopy
                        value={displayedEntitySetId}
                        tooltipLabel={t('query.copyEntitySetId')}
                        tooltipCopiedLabel={t('common.copied')}
                        className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                        aria-label={t('query.copyEntitySetId')}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </ClickToCopy>
                    ) : null}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="pointer-events-auto h-7 w-7"
                            onClick={handleLoadEntitySet}
                            disabled={entitiesLoading}
                            aria-label={t('query.loadEntitySet')}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('query.loadEntitySet')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="pointer-events-auto h-7 w-7"
                            onClick={handleStartEntitySetEdit}
                            aria-label={t('query.editEntitySetId')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('query.editEntitySetId')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
            </div>
            {entitySetError && <p className="text-destructive text-xs">{entitySetError}</p>}
            <p className="text-muted-foreground text-xs">
              {mobile ? t('query.entitySetIdHelpMobile') : t('query.entitySetIdHelp')}
            </p>
          </div>

          {/* Filter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t('query.filterExpression')}</Label>
              {llmConfigured && selectedDataclass ? (
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-primary/20 bg-primary/5 text-primary text-xs hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
                          disabled={cloudLlmOffline && !queryGenerating}
                          onClick={handleOpenGenerateQuery}
                          aria-label={
                            cloudLlmOffline
                              ? t('assistant.requiresInternet')
                              : queryGenerating
                                ? t('query.viewGeneratingTask')
                                : t('query.generateWithAi')
                          }
                        >
                          <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
                            {queryGenerating ? (
                              <span
                                aria-hidden
                                className="size-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
                              />
                            ) : (
                              <AssistantSparklesIcon className="size-3.5" twinkle />
                            )}
                          </span>
                          {queryGenerating ? t('query.generating') : t('query.generateWithAi')}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56 text-xs">
                      {cloudLlmOffline
                        ? t('assistant.requiresInternet')
                        : queryGenerating
                          ? t('query.viewGeneratingTaskHint')
                          : t('query.generateWithAiHint')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <CodeEditor
              language={ORDA_LANGUAGE_ID}
              path={`orda-filter://${activeDataclassTab?.id ?? 'default'}`}
              value={localFilter}
              onChange={handleFilterChange}
              onMount={handleFilterEditorMount}
              annotations={filterAnnotations}
              height="140px"
              fontSize={13}
              toolbar
              showLineNumbers
              wordWrap
              wordBasedSuggestions="off"
              className="rounded-md border"
            />
            {filterError && <p className="text-destructive text-xs">{filterError}</p>}
            <p className="text-muted-foreground text-xs">{t('query.filterHelp')}</p>
          </div>

          {/* Filter parameters (for :1, :2, ... placeholders) */}
          {localFilter.trim() ? (
            <EnvThisProvider value={queryThis}>
              <RuntimeArgumentsEditor
                argumentsList={filterArguments}
                dataClasses={[]}
                allowedKinds={FILTER_ARGUMENT_KINDS}
                namePrefix=":"
                className="border-t-0 pt-0"
                onChange={handleFilterArgumentsChange}
              />
            </EnvThisProvider>
          ) : null}

          {/* Options row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Sort */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('query.sortBy')}</Label>
              <AttributePathInput
                value={queryOptions.sort}
                onChange={(sort) => handleSetQueryOptions({ sort })}
                service={ordaService}
                placeholder={t('query.sortByPlaceholder')}
                aria-label={t('query.sortBy')}
                className="h-6 text-xs"
              />
            </div>

            {/* Order */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t('query.order')}</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-6 w-full justify-start gap-1.5 text-xs"
                      onClick={() =>
                        handleSetQueryOptions({
                          order: queryOptions.order === 'desc' ? 'asc' : 'desc',
                        })
                      }
                    >
                      {queryOptions.order === 'desc' ? (
                        <ArrowDownAZ className="h-4 w-4" />
                      ) : (
                        <ArrowUpAZ className="h-4 w-4" />
                      )}
                      <span className="text-sm">
                        {queryOptions.order === 'desc' ? t('query.desc') : t('query.asc')}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {queryOptions.order === 'desc'
                      ? t('query.orderToggleTooltipAsc')
                      : t('query.orderToggleTooltipDesc')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Select fields */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-xs">{t('query.attributes')}</Label>
              {selectedAttributeCount > 0 ? (
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {selectedAttributeCount}
                </span>
              ) : null}
            </div>
            <AttributeTagsInput
              value={queryOptions.select}
              onChange={(select) => handleSetQueryOptions({ select })}
              service={ordaService}
              aria-label={t('query.attributes')}
            />
          </div>

          <QueryExplainToggle
            checked={queryOptions.explain === true}
            disabled={entitiesLoading}
            onCheckedChange={(checked) => handleSetQueryOptions({ explain: checked })}
          />

          {!mobile ? (
            <p className="text-muted-foreground text-xs">{t('query.runQueryShortcut')}</p>
          ) : null}
        </div>
      )}

      {/* Mobile Run bar — pinned under the scrollable fields so Close / Run stay tappable */}
      {mobile && isExpanded ? (
        <div className="flex shrink-0 items-stretch gap-2 border-t bg-background p-2 pb-[max(0.5rem,var(--app-safe-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 gap-2 px-3 text-sm"
            onClick={handleCollapse}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
            {t('common.close')}
          </Button>
          <Button
            variant="default"
            className="h-11 min-w-0 flex-1 gap-2 text-sm"
            onClick={() => handleRun()}
            disabled={entitiesLoading}
          >
            <Play className="h-4 w-4" />
            {defaultCreateEntitySet ? t('query.runAsSelection') : t('query.run')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                className="h-11 w-11 shrink-0 border-primary-foreground/20 border-l px-0"
                disabled={entitiesLoading}
                aria-label={t('query.runOptions')}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              className={mobileMenuContentClass()}
              {...mobileMenuCollisionProps}
            >
              <DropdownMenuItem
                onClick={() => handleRun(false)}
                className={mobileMenuItemClass('flex flex-col items-start gap-0.5')}
              >
                <span className="font-medium">{t('query.run')}</span>
                <span className="text-muted-foreground text-xs">{t('query.runDescription')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleRun(true)}
                className={mobileMenuItemClass('flex flex-col items-start gap-0.5')}
              >
                <span className="font-medium">{t('query.runAsSelection')}</span>
                <span className="text-muted-foreground text-xs">
                  {t('query.runAsSelectionDescription')}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {selectedDataclass ? (
        <AiGenerateQueryModal
          open={generateQueryOpen}
          onOpenChange={setGenerateQueryOpen}
          dataclassName={selectedDataclass}
        />
      ) : null}
    </search>
  )
}
