import { Button, Checkbox, cn, Label } from '@4d/ui'
import { ChevronLeft, Clock3, Loader2, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MobileFullscreenSheet } from '~/components/MobileFullscreenSheet'
import { RequestResponseSplit } from '~/components/RequestResponseSplit'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { isMobileShell } from '~/lib/platform'
import type {
  MethodExecutorSeed,
  MethodScope,
  RuntimeArgument,
} from '~/store/method-executor-types'
import { useMethodRunHistoryStore } from '~/store/method-run-history'
import { useTabsStore } from '~/store/tabs'
import { type DetectedMethodResult, detectMethodResult } from './detect-method-result'
import { MethodRunHistory } from './MethodRunHistory'
import { MethodSelector } from './MethodSelector'
import { parseParamsText } from './parse-params-text'
import { ResultPanel } from './ResultPanel'
import {
  areRuntimeArgumentsReady,
  flushPendingArgumentValues,
  RuntimeArgumentsEditor,
  readLiveArgumentInputValues,
  withPositionalNames,
} from './RuntimeArgumentsEditor'
import { serializeRuntimeParams } from './serialize-params'
import { type MethodCatalogItem, useMethodCatalog } from './useMethodCatalog'

function initialArguments(seed?: MethodExecutorSeed): RuntimeArgument[] {
  return withPositionalNames(seed?.arguments ?? parseParamsText(seed?.paramsText))
}

export function MethodExecutor({ tabId, seed }: { tabId: string; seed?: MethodExecutorSeed }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { methods, dataClasses, loading: catalogLoading, error: catalogError } = useMethodCatalog()
  const openMethodExecutorTab = useTabsStore((state) => state.openMethodExecutorTab)
  const runs = useMethodRunHistoryStore((state) => state.runs)
  const addRun = useMethodRunHistoryStore((state) => state.addRun)
  const removeRun = useMethodRunHistoryStore((state) => state.removeRun)
  const clearRuns = useMethodRunHistoryStore((state) => state.clearRuns)

  const [scope, setScope] = useState<MethodScope>(seed?.scope ?? 'dataclass')
  const [methodName, setMethodName] = useState(seed?.methodName ?? '')
  const [dataClass, setDataClass] = useState(seed?.dataClass ?? '')
  const [key, setKey] = useState(seed?.key === undefined ? '' : String(seed.key))
  const [entitySetId, setEntitySetId] = useState(seed?.entitySetId ?? '')
  const [filter, setFilter] = useState(seed?.filter ?? '')
  const [orderby, setOrderby] = useState(seed?.orderby ?? '')
  const [allowedOnHTTPGET, setAllowedOnHTTPGET] = useState(seed?.allowedOnHTTPGET ?? false)
  const [useGet, setUseGet] = useState(seed?.useGet ?? false)
  const [argumentsList, setArgumentsListState] = useState<RuntimeArgument[]>(() =>
    initialArguments(seed)
  )
  const argumentsListRef = useRef(argumentsList)
  const setArgumentsList = (next: RuntimeArgument[]) => {
    argumentsListRef.current = next
    setArgumentsListState(next)
  }
  const [result, setResult] = useState<DetectedMethodResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  // Mobile presents a wizard (pick method -> args -> result) instead of the
  // desktop request/response split; unused on desktop.
  const [mobileStep, setMobileStep] = useState<'method' | 'args' | 'result'>('method')
  const canExecuteRef = useRef(false)
  const executingRef = useRef(false)
  const executeRef = useRef<() => void>(() => {})
  const tabIdRef = useRef(tabId)
  tabIdRef.current = tabId

  const chooseMethod = (item: MethodCatalogItem) => {
    const sameTarget =
      item.scope === scope && (item.scope === 'catalog' || item.dataClass === dataClass)
    setScope(item.scope)
    setMethodName(item.methodName)
    setDataClass(item.dataClass ?? '')
    setAllowedOnHTTPGET(item.allowedOnHTTPGET ?? false)
    setUseGet(false)
    setArgumentsList(withPositionalNames(parseParamsText(item.paramsText)))
    if (!sameTarget) {
      setKey('')
      setEntitySetId('')
      setFilter('')
      setOrderby('')
    }
    setResult(null)
    setError(null)
    if (mobile) setMobileStep('args')
  }

  const clearMethod = () => {
    setMethodName('')
    setArgumentsList([])
    setKey('')
    setEntitySetId('')
    setFilter('')
    setOrderby('')
    setResult(null)
    setError(null)
  }

  const methodExists =
    !methodName ||
    methods.some(
      (method) =>
        method.methodName === methodName &&
        method.scope === scope &&
        (scope === 'catalog' || method.dataClass === dataClass)
    )

  const canExecute =
    Boolean(methodName) &&
    methodExists &&
    (scope === 'catalog' || Boolean(dataClass)) &&
    (scope !== 'entity' || Boolean(key.trim())) &&
    (scope !== 'entitySelection' || Boolean(entitySetId.trim())) &&
    areRuntimeArgumentsReady(argumentsList)

  const currentConfig = (): MethodExecutorSeed => ({
    scope,
    methodName,
    dataClass: dataClass || undefined,
    key: key || undefined,
    entitySetId: entitySetId || undefined,
    // Entity-set targets already encode the selection — do not carry query filters
    filter: entitySetId.trim() ? undefined : filter || undefined,
    orderby: entitySetId.trim() ? undefined : orderby || undefined,
    allowedOnHTTPGET,
    useGet,
    arguments: argumentsList,
  })

  const execute = async () => {
    flushPendingArgumentValues()
    const liveByName = readLiveArgumentInputValues()
    let args = argumentsListRef.current
    if (Object.keys(liveByName).length > 0) {
      args = args.map((argument, index) => {
        const live = liveByName[argument.name ?? `$${index + 1}`]
        if (live === undefined) return argument
        if (argument.kind === 'string' || argument.kind === 'number' || argument.kind === 'date') {
          return { ...argument, value: live }
        }
        if (argument.kind === 'entity') return { ...argument, key: live }
        if (argument.kind === 'entitysel') return { ...argument, entitySetId: live }
        return argument
      })
      argumentsListRef.current = args
      setArgumentsListState(args)
    }
    setError(null)
    if (!methodName) {
      setError(t('methodExecutor.chooseMethodFirst'))
      return
    }
    if (scope !== 'catalog' && !dataClass) {
      setError(t('methodExecutor.chooseDataclassError'))
      return
    }
    if (scope === 'entity' && !key.trim()) {
      setError(t('methodExecutor.entityKeyError'))
      return
    }
    if (scope === 'entitySelection' && !entitySetId.trim()) {
      setError(t('methodExecutor.entitySelectionKeyError'))
      return
    }
    if (!areRuntimeArgumentsReady(args)) {
      setError(t('methodExecutor.incompleteArgumentsError'))
      return
    }

    try {
      setExecuting(true)
      const response = await api.callMethod({
        scope,
        methodName,
        dataClass: dataClass || undefined,
        key: key || undefined,
        entitySetId: entitySetId || undefined,
        filter: entitySetId.trim() ? undefined : filter || undefined,
        orderby: entitySetId.trim() ? undefined : orderby || undefined,
        allowedOnHTTPGET: useGet,
        params: serializeRuntimeParams(args),
      })
      const detected = detectMethodResult(response)
      setResult(detected)
      addRun({ ...currentConfig(), arguments: args }, detected.kind)
      if (mobile) setMobileStep('result')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('methodExecutor.executionFailed'))
    } finally {
      setExecuting(false)
    }
  }

  canExecuteRef.current = canExecute
  executingRef.current = executing
  executeRef.current = () => {
    void execute()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return
      if (useTabsStore.getState().activeTabId !== tabIdRef.current) return
      if (!canExecuteRef.current || executingRef.current) return
      event.preventDefault()
      event.stopPropagation()
      executeRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  if (mobile) {
    const stepIndex = { method: 0, args: 1, result: 2 }[mobileStep]
    const stepTitle =
      mobileStep === 'method'
        ? t('methodExecutor.title')
        : mobileStep === 'args'
          ? methodName || t('methodExecutor.title')
          : t('methodExecutor.result')
    const stepHint =
      mobileStep === 'method'
        ? t('methodExecutor.subtitle')
        : mobileStep === 'args'
          ? t('methodExecutor.subtitle')
          : t('methodExecutor.resultHint')

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 items-center gap-1 border-b px-2 py-2">
          {mobileStep !== 'method' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setMobileStep(mobileStep === 'result' ? 'args' : 'method')}
              aria-label={t('common.back')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate font-semibold text-sm">{stepTitle}</p>
            <p className="truncate text-muted-foreground text-xs">{stepHint}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setShowHistory(true)}
            aria-label={t('methodExecutor.history')}
          >
            <Clock3 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 px-3 py-2" aria-hidden>
          {(['method', 'args', 'result'] as const).map((step, index) => (
            <span
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= stepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {mobileStep === 'method' ? (
            <MethodSelector
              scope={scope}
              methodName={methodName}
              dataClass={dataClass}
              keyValue={key}
              entitySetId={entitySetId}
              methods={methods}
              dataClasses={dataClasses}
              catalogLoading={catalogLoading}
              catalogError={catalogError}
              onScopeChange={(next) => {
                setScope(next)
                clearMethod()
              }}
              onChooseMethod={chooseMethod}
              onClearMethod={clearMethod}
              onDataClassChange={setDataClass}
              onKeyChange={setKey}
              onEntitySetIdChange={setEntitySetId}
            />
          ) : null}

          {mobileStep === 'args' ? (
            <div className="flex flex-col gap-3">
              <RuntimeArgumentsEditor
                argumentsList={argumentsList}
                dataClasses={dataClasses}
                onChange={setArgumentsList}
              />
              {error ? (
                <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">{error}</p>
              ) : null}
            </div>
          ) : null}

          {mobileStep === 'result' ? (
            <div className="flex h-full min-h-0 flex-col">
              <ResultPanel result={result} />
            </div>
          ) : null}
        </div>

        <div
          className="sticky bottom-0 flex shrink-0 items-center justify-between gap-3 border-t bg-background/95 px-3 py-2.5 backdrop-blur"
          style={{ paddingBottom: 'max(0.625rem, var(--app-safe-bottom))' }}
        >
          {mobileStep === 'method' ? (
            <Button
              className="ml-auto h-11 px-4"
              disabled={
                !methodName ||
                !methodExists ||
                (scope !== 'catalog' && !dataClass) ||
                (scope === 'entity' && !key.trim()) ||
                (scope === 'entitySelection' && !entitySetId.trim())
              }
              onClick={() => setMobileStep('args')}
            >
              {t('common.next')}
            </Button>
          ) : null}

          {mobileStep === 'args' ? (
            <>
              {allowedOnHTTPGET ? (
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={useGet}
                    onCheckedChange={(checked) => setUseGet(checked === true)}
                  />
                  {t('methodExecutor.executeWithGet')}
                </Label>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t('methodExecutor.postRequest')}
                </span>
              )}
              <Button
                size="sm"
                className="ml-auto h-11 px-4"
                onClick={() => void execute()}
                disabled={executing || !canExecute}
              >
                {executing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('methodExecutor.execute')}
              </Button>
            </>
          ) : null}

          {mobileStep === 'result' ? (
            <Button
              variant="outline"
              className="ml-auto h-11 px-4"
              onClick={() => setMobileStep('args')}
            >
              {t('common.back')}
            </Button>
          ) : null}
        </div>

        {showHistory ? (
          <MobileFullscreenSheet open labelledBy="method-run-history-title">
            <MethodRunHistory
              runs={runs}
              onOpenRun={(config) => {
                openMethodExecutorTab(config)
                setShowHistory(false)
              }}
              onRemoveRun={removeRun}
              onClearRuns={clearRuns}
              onClose={() => setShowHistory(false)}
            />
          </MobileFullscreenSheet>
        ) : null}
      </div>
    )
  }

  return (
    <RequestResponseSplit
      kind="methodExecutor"
      requestClassName="bg-background p-3"
      responseClassName="min-h-105 bg-muted/10 p-3 lg:min-h-0"
      request={
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-base">{t('methodExecutor.title')}</p>
              <p className="text-muted-foreground text-xs">{t('methodExecutor.subtitle')}</p>
            </div>
            <Button
              variant={showHistory ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowHistory((visible) => !visible)}
            >
              <Clock3 className="h-3.5 w-3.5" />
              {t('methodExecutor.history')}
            </Button>
          </div>

          {showHistory ? (
            <MethodRunHistory
              runs={runs}
              onOpenRun={openMethodExecutorTab}
              onRemoveRun={removeRun}
              onClearRuns={clearRuns}
              onClose={() => setShowHistory(false)}
            />
          ) : null}

          <MethodSelector
            scope={scope}
            methodName={methodName}
            dataClass={dataClass}
            keyValue={key}
            entitySetId={entitySetId}
            methods={methods}
            dataClasses={dataClasses}
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            onScopeChange={(next) => {
              setScope(next)
              clearMethod()
            }}
            onChooseMethod={chooseMethod}
            onClearMethod={clearMethod}
            onDataClassChange={setDataClass}
            onKeyChange={setKey}
            onEntitySetIdChange={setEntitySetId}
          />

          <RuntimeArgumentsEditor
            argumentsList={argumentsList}
            dataClasses={dataClasses}
            onChange={setArgumentsList}
          />

          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">{error}</p>
          ) : null}

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-2 backdrop-blur">
            {allowedOnHTTPGET ? (
              <Label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={useGet}
                  onCheckedChange={(checked) => setUseGet(checked === true)}
                />
                {t('methodExecutor.executeWithGet')}
              </Label>
            ) : (
              <span className="text-muted-foreground text-xs">
                {t('methodExecutor.postRequest')}
              </span>
            )}
            <Button
              size="sm"
              className={cn(mobile ? 'h-11 px-4' : 'h-8')}
              onClick={() => void execute()}
              disabled={executing || !canExecute}
              title={`${t('methodExecutor.execute')} (⌘/Ctrl+Enter)`}
            >
              {executing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('methodExecutor.execute')}
            </Button>
          </div>
        </div>
      }
      response={
        <>
          <div className="mb-2 shrink-0">
            <h2 className="font-medium text-sm">{t('methodExecutor.result')}</h2>
            <p className="text-muted-foreground text-xs">{t('methodExecutor.resultHint')}</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ResultPanel result={result} />
          </div>
        </>
      }
    />
  )
}
