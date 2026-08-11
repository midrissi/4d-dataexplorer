import { Button, Checkbox, cn, Label } from '@4d/ui'
import { ChevronLeft, Clock3, Download, Loader2, Play, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EnvThisProvider } from '~/components/Environments/env-this-context'
import { MobileFullscreenSheet } from '~/components/MobileFullscreenSheet'
import { PostmanExportModal } from '~/components/PostmanExport'
import { RequestResponseSplit } from '~/components/RequestResponseSplit'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { consoleService } from '~/lib/console'
import { resolveEnvTemplates } from '~/lib/env'
import { getActiveEnvMap, mergeUnresolved } from '~/lib/env/runtime'
import { buildMethodThis } from '~/lib/env/this-context-builders'
import { isMobileShell } from '~/lib/platform'
import {
  methodSeedExportLabel,
  methodSeedToPostmanItem,
  type PostmanExportItemInput,
} from '~/lib/postman'
import type {
  MethodExecutorSeed,
  MethodScope,
  RuntimeArgument,
} from '~/store/method-executor-types'
import { useMethodFavouritesStore } from '~/store/method-favourites'
import { useMethodRunHistoryStore } from '~/store/method-run-history'
import { sameMethodConfig } from '~/store/same-method-config'
import { useTabsStore } from '~/store/tabs'
import { type DetectedMethodResult, detectMethodResult } from './detect-method-result'
import { MethodFavourites } from './MethodFavourites'
import { MethodRunHistory } from './MethodRunHistory'
import { MethodSelector } from './MethodSelector'
import { flushPendingWrapperText, MethodWrapperEditor } from './MethodWrapperEditor'
import { DEFAULT_METHOD_WRAPPER_TEXT } from './method-json-snippets'
import { cnMethodScopeBadge, methodScopeShortLabel } from './method-list-display'
import { type MethodResponseMeta, methodResponseMetaFromCall } from './method-response-meta'
import { parseParamsText } from './parse-params-text'
import { parseWrapperText } from './parse-wrapper-text'
import { ResultPanel } from './ResultPanel'
import {
  areRuntimeArgumentsReady,
  flushPendingArgumentValues,
  RuntimeArgumentsEditor,
  readLiveArgumentInputValues,
  withPositionalNames,
} from './RuntimeArgumentsEditor'
import { resolveRuntimeArgumentsEnv, serializeRuntimeParams } from './serialize-params'
import { type MethodCatalogItem, useMethodCatalog } from './useMethodCatalog'

type SidePanel = 'none' | 'history' | 'favourites'

function initialArguments(seed?: MethodExecutorSeed): RuntimeArgument[] {
  return withPositionalNames(seed?.arguments ?? parseParamsText(seed?.paramsText))
}

export function MethodExecutor({ tabId, seed }: { tabId: string; seed?: MethodExecutorSeed }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const {
    methods,
    dataClasses,
    singletons,
    loading: catalogLoading,
    error: catalogError,
  } = useMethodCatalog()
  const runs = useMethodRunHistoryStore((state) => state.runs)
  const addRun = useMethodRunHistoryStore((state) => state.addRun)
  const removeRun = useMethodRunHistoryStore((state) => state.removeRun)
  const clearRuns = useMethodRunHistoryStore((state) => state.clearRuns)
  const favourites = useMethodFavouritesStore((state) => state.favourites)
  const addFavourite = useMethodFavouritesStore((state) => state.addFavourite)
  const updateFavourite = useMethodFavouritesStore((state) => state.updateFavourite)
  const duplicateFavourite = useMethodFavouritesStore((state) => state.duplicateFavourite)
  const removeFavourite = useMethodFavouritesStore((state) => state.removeFavourite)
  const clearFavourites = useMethodFavouritesStore((state) => state.clearFavourites)
  const updateFavouriteMeta = useMethodFavouritesStore((state) => state.updateFavouriteMeta)

  const [scope, setScope] = useState<MethodScope>(seed?.scope ?? 'catalog')
  const [methodName, setMethodName] = useState(seed?.methodName ?? '')
  const [dataClass, setDataClass] = useState(seed?.dataClass ?? '')
  const [singletonName, setSingletonName] = useState(seed?.singletonName ?? '')
  const [key, setKey] = useState(seed?.key === undefined ? '' : String(seed.key))
  const [entitySetId, setEntitySetId] = useState(seed?.entitySetId ?? '')
  const [filter, setFilter] = useState(seed?.filter ?? '')
  const [orderby, setOrderby] = useState(seed?.orderby ?? '')
  const [allowedOnHTTPGET, setAllowedOnHTTPGET] = useState(seed?.allowedOnHTTPGET ?? false)
  const [useGet, setUseGet] = useState(seed?.useGet ?? false)
  const [wrapperEnabled, setWrapperEnabled] = useState(
    seed?.wrapperEnabled ?? Boolean(seed?.wrapperText?.trim())
  )
  const [wrapperText, setWrapperText] = useState(seed?.wrapperText ?? DEFAULT_METHOD_WRAPPER_TEXT)
  const [argumentsList, setArgumentsListState] = useState<RuntimeArgument[]>(() =>
    initialArguments(seed)
  )
  const argumentsListRef = useRef(argumentsList)
  const setArgumentsList = (next: RuntimeArgument[]) => {
    argumentsListRef.current = next
    setArgumentsListState(next)
  }
  const [result, setResult] = useState<DetectedMethodResult | null>(null)
  const [rawBody, setRawBody] = useState<unknown>(undefined)
  const [responseMeta, setResponseMeta] = useState<MethodResponseMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [sidePanel, setSidePanel] = useState<SidePanel>('none')
  const [exportOpen, setExportOpen] = useState(false)
  /** Favourite opened or last saved from this editor — enables update when the request changes. */
  const [linkedFavouriteId, setLinkedFavouriteId] = useState<string | null>(() => {
    if (!seed) return null
    return (
      useMethodFavouritesStore
        .getState()
        .favourites.find((item) => sameMethodConfig(item.config, seed))?.id ?? null
    )
  })
  // Mobile presents a wizard (pick method -> args -> result) instead of the
  // desktop request/response split; unused on desktop.
  const [mobileStep, setMobileStep] = useState<'method' | 'args' | 'result'>('method')
  const canExecuteRef = useRef(false)
  const executingRef = useRef(false)
  const executeRef = useRef<() => void>(() => {})
  const tabIdRef = useRef(tabId)
  tabIdRef.current = tabId

  const applyConfig = (config: MethodExecutorSeed, favouriteId: string | null = null) => {
    setScope(config.scope)
    setMethodName(config.methodName)
    setDataClass(config.dataClass ?? '')
    setSingletonName(config.singletonName ?? '')
    setKey(config.key === undefined ? '' : String(config.key))
    setEntitySetId(config.entitySetId ?? '')
    setFilter(config.filter ?? '')
    setOrderby(config.orderby ?? '')
    setAllowedOnHTTPGET(config.allowedOnHTTPGET ?? false)
    setUseGet(config.useGet ?? false)
    setWrapperEnabled(config.wrapperEnabled ?? Boolean(config.wrapperText?.trim()))
    setWrapperText(config.wrapperText ?? DEFAULT_METHOD_WRAPPER_TEXT)
    setArgumentsList(initialArguments(config))
    setResult(null)
    setRawBody(undefined)
    setResponseMeta(null)
    setError(null)
    setLinkedFavouriteId(favouriteId)
    if (mobile) setMobileStep(config.methodName ? 'args' : 'method')
  }

  const chooseMethod = (item: MethodCatalogItem) => {
    const sameTarget =
      item.scope === scope &&
      (item.scope === 'catalog' ||
        (item.scope === 'singleton'
          ? item.singletonName === singletonName
          : item.dataClass === dataClass))
    setScope(item.scope)
    setMethodName(item.methodName)
    setDataClass(item.dataClass ?? '')
    setSingletonName(item.singletonName ?? '')
    setAllowedOnHTTPGET(item.allowedOnHTTPGET ?? false)
    setUseGet(false)
    setWrapperEnabled(false)
    setWrapperText(DEFAULT_METHOD_WRAPPER_TEXT)
    setArgumentsList(withPositionalNames(parseParamsText(item.paramsText)))
    if (!sameTarget) {
      setKey('')
      setEntitySetId('')
      setFilter('')
      setOrderby('')
    }
    setResult(null)
    setRawBody(undefined)
    setResponseMeta(null)
    setError(null)
    setLinkedFavouriteId(null)
    if (mobile) setMobileStep('args')
  }

  const clearMethod = () => {
    setMethodName('')
    setArgumentsList([])
    setWrapperEnabled(false)
    setWrapperText(DEFAULT_METHOD_WRAPPER_TEXT)
    setKey('')
    setEntitySetId('')
    setFilter('')
    setOrderby('')
    setResult(null)
    setRawBody(undefined)
    setResponseMeta(null)
    setError(null)
    setLinkedFavouriteId(null)
  }

  const methodExists =
    !methodName ||
    methods.some(
      (method) =>
        method.methodName === methodName &&
        method.scope === scope &&
        (scope === 'catalog' ||
          (scope === 'singleton'
            ? method.singletonName === singletonName
            : method.dataClass === dataClass))
    )

  const canExecute =
    Boolean(methodName) &&
    methodExists &&
    (scope === 'catalog' ||
      (scope === 'singleton' ? Boolean(singletonName) : Boolean(dataClass))) &&
    (scope !== 'entity' || Boolean(key.trim())) &&
    (scope !== 'entitySelection' || Boolean(entitySetId.trim())) &&
    areRuntimeArgumentsReady(argumentsList)

  const currentConfig = (): MethodExecutorSeed => ({
    scope,
    methodName,
    dataClass: scope === 'singleton' ? undefined : dataClass || undefined,
    singletonName: scope === 'singleton' ? singletonName || undefined : undefined,
    key: key || undefined,
    entitySetId: entitySetId || undefined,
    // Entity-set targets already encode the selection — do not carry query filters
    filter: entitySetId.trim() ? undefined : filter || undefined,
    orderby: entitySetId.trim() ? undefined : orderby || undefined,
    allowedOnHTTPGET,
    useGet,
    arguments: argumentsList,
    wrapperEnabled: wrapperEnabled || undefined,
    wrapperText: wrapperEnabled && wrapperText.trim() ? wrapperText : undefined,
  })

  const builderSeed = currentConfig()
  const methodThis = useMemo(
    () =>
      buildMethodThis({
        scope,
        methodName,
        dataClass: dataClass || undefined,
        singletonName: singletonName || undefined,
        key,
        entitySetId,
        filter,
        orderby,
        arguments: argumentsList,
        wrapperText,
        wrapperEnabled,
      }),
    [
      scope,
      methodName,
      dataClass,
      singletonName,
      key,
      entitySetId,
      filter,
      orderby,
      argumentsList,
      wrapperText,
      wrapperEnabled,
    ]
  )
  const linkedFavourite = linkedFavouriteId
    ? favourites.find((item) => item.id === linkedFavouriteId)
    : undefined
  const isCurrentFavourite =
    Boolean(methodName) && favourites.some((item) => sameMethodConfig(item.config, builderSeed))
  const canUpdateFavourite =
    Boolean(methodName) &&
    linkedFavourite != null &&
    !sameMethodConfig(linkedFavourite.config, builderSeed)
  const favouriteButtonLabel = isCurrentFavourite
    ? t('methodExecutor.removeFavourite')
    : canUpdateFavourite
      ? t('methodExecutor.updateFavourite')
      : t('methodExecutor.addFavourite')
  const currentExportLabel = methodName ? methodSeedExportLabel(builderSeed) : ''
  const currentExportItems: PostmanExportItemInput[] = methodName
    ? [
        {
          id: 'current',
          name: currentExportLabel,
          listDetail: currentExportLabel,
          badgeLabel: methodScopeShortLabel(builderSeed.scope),
          badgeClassName: cn(cnMethodScopeBadge(builderSeed.scope), 'normal-case'),
          item: methodSeedToPostmanItem(builderSeed, { name: currentExportLabel }),
        },
      ]
    : []
  const exportModal = (
    <PostmanExportModal
      open={exportOpen}
      onOpenChange={setExportOpen}
      items={currentExportItems}
      defaultCollectionName={t('postmanExport.defaultMethodName')}
      signatureLabel={t('favouriteMeta.viewSignature')}
      itemsSectionLabel={t('postmanExport.currentRequestSection')}
    />
  )

  const toggleCurrentFavourite = () => {
    if (!methodName) return
    const config = currentConfig()
    if (isCurrentFavourite) {
      const existing = favourites.find((item) => sameMethodConfig(item.config, config))
      if (existing) {
        removeFavourite(existing.id)
        if (linkedFavouriteId === existing.id) setLinkedFavouriteId(null)
      }
      return
    }
    if (linkedFavourite && canUpdateFavourite) {
      updateFavourite(linkedFavourite.id, config)
      return
    }
    const id = addFavourite(config)
    if (id) setLinkedFavouriteId(id)
  }

  // Drop the link if the favourite was removed elsewhere (clear all / other tab).
  useEffect(() => {
    if (linkedFavouriteId && !favourites.some((item) => item.id === linkedFavouriteId)) {
      setLinkedFavouriteId(null)
    }
  }, [favourites, linkedFavouriteId])

  const execute = async () => {
    flushPendingArgumentValues()
    const flushedWrapper = wrapperEnabled ? flushPendingWrapperText() : undefined
    const liveWrapperText =
      wrapperEnabled && flushedWrapper !== undefined
        ? flushedWrapper
        : wrapperEnabled
          ? wrapperText
          : ''
    if (wrapperEnabled && flushedWrapper !== undefined && flushedWrapper !== wrapperText) {
      setWrapperText(flushedWrapper)
      if (flushedWrapper.trim()) setUseGet(false)
    }
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
    if (scope === 'singleton' && !singletonName) {
      setError(t('methodExecutor.chooseSingletonError'))
      return
    }
    if (scope !== 'catalog' && scope !== 'singleton' && !dataClass) {
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

    let wrapper: Record<string, unknown> | undefined
    const map = getActiveEnvMap()
    const thisRoot = buildMethodThis({
      scope,
      methodName,
      dataClass: dataClass || undefined,
      singletonName: singletonName || undefined,
      key,
      entitySetId,
      filter,
      orderby,
      arguments: args,
      wrapperText: liveWrapperText,
      wrapperEnabled,
    })
    const resolveOpts = { this: thisRoot }
    const resolvedArgs = resolveRuntimeArgumentsEnv(args, resolveOpts)
    const resolvedKey = resolveEnvTemplates(key, map, resolveOpts)
    const resolvedEntitySetId = resolveEnvTemplates(entitySetId, map, resolveOpts)
    const resolvedFilter = resolveEnvTemplates(filter, map, resolveOpts)
    const resolvedOrderby = resolveEnvTemplates(orderby, map, resolveOpts)
    const resolvedWrapperText = resolveEnvTemplates(liveWrapperText, map, resolveOpts)
    const unresolved = mergeUnresolved(
      resolvedArgs.unresolved,
      resolvedKey.unresolved,
      resolvedEntitySetId.unresolved,
      resolvedFilter.unresolved,
      resolvedOrderby.unresolved,
      resolvedWrapperText.unresolved
    )
    if (unresolved.length > 0) {
      consoleService.warn(t('environments.unresolvedWarning', { keys: unresolved.join(', ') }))
    }

    if (wrapperEnabled) {
      try {
        wrapper = parseWrapperText(resolvedWrapperText.text)
      } catch {
        setError(t('methodExecutor.invalidWrapperError'))
        return
      }
      if (wrapper === undefined) {
        setError(t('methodExecutor.invalidWrapperError'))
        return
      }
    }
    // Wrapper is POST-only; ignore GET when a wrapper object is present
    const useGetRequest = useGet && wrapper === undefined

    try {
      setExecuting(true)
      const response = await api.callMethod({
        scope,
        methodName,
        dataClass: scope === 'singleton' ? undefined : dataClass || undefined,
        singletonName: scope === 'singleton' ? singletonName || undefined : undefined,
        key: resolvedKey.text || undefined,
        entitySetId: resolvedEntitySetId.text || undefined,
        filter: resolvedEntitySetId.text.trim() ? undefined : resolvedFilter.text || undefined,
        orderby: resolvedEntitySetId.text.trim() ? undefined : resolvedOrderby.text || undefined,
        allowedOnHTTPGET: useGetRequest,
        params: serializeRuntimeParams(resolvedArgs.argumentsList),
        wrapper,
      })
      const detected = detectMethodResult(response.unwrap(), { webform: response.webform() })
      setResult(detected)
      setRawBody(response.body)
      setResponseMeta(methodResponseMetaFromCall(response))
      addRun(
        {
          ...currentConfig(),
          arguments: args,
          useGet: useGetRequest,
          wrapperEnabled: wrapperEnabled || undefined,
          wrapperText: wrapperEnabled && liveWrapperText.trim() ? liveWrapperText : undefined,
        },
        detected.kind
      )
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
      <EnvThisProvider value={methodThis}>
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
              onClick={() => setSidePanel('favourites')}
              aria-label={t('methodExecutor.favourites')}
            >
              <Star className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSidePanel('history')}
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
                singletonName={singletonName}
                keyValue={key}
                entitySetId={entitySetId}
                methods={methods}
                dataClasses={dataClasses}
                singletons={singletons}
                catalogLoading={catalogLoading}
                catalogError={catalogError}
                onScopeChange={(next) => {
                  setScope(next)
                  clearMethod()
                }}
                onChooseMethod={chooseMethod}
                onClearMethod={clearMethod}
                onDataClassChange={setDataClass}
                onSingletonNameChange={setSingletonName}
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
                <MethodWrapperEditor
                  enabled={wrapperEnabled}
                  onEnabledChange={(next) => {
                    setWrapperEnabled(next)
                    if (next) setUseGet(false)
                  }}
                  value={wrapperText}
                  onChange={(next) => {
                    setWrapperText(next)
                    if (next.trim()) setUseGet(false)
                  }}
                />
                {error ? (
                  <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mobileStep === 'result' ? (
              <div className="flex h-full min-h-0 flex-col">
                <ResultPanel result={result} rawBody={rawBody} responseMeta={responseMeta} />
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
                  (scope === 'singleton' ? !singletonName : scope !== 'catalog' && !dataClass) ||
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
                  <Label
                    className="flex items-center gap-2 text-xs"
                    title={wrapperEnabled ? t('methodExecutor.wrapperRequiresPost') : undefined}
                  >
                    <Checkbox
                      checked={useGet}
                      disabled={wrapperEnabled}
                      onCheckedChange={(checked) => setUseGet(checked === true)}
                    />
                    {t('methodExecutor.executeWithGet')}
                  </Label>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {t('methodExecutor.postRequest')}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={!canExecute}
                    onClick={toggleCurrentFavourite}
                    aria-label={favouriteButtonLabel}
                    title={favouriteButtonLabel}
                    aria-pressed={isCurrentFavourite}
                  >
                    <Star
                      className={cn(
                        'h-4 w-4',
                        isCurrentFavourite && 'fill-current text-amber-500',
                        canUpdateFavourite && !isCurrentFavourite && 'text-amber-500'
                      )}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={!canExecute}
                    onClick={() => setExportOpen(true)}
                    aria-label={t('methodExecutor.exportCurrent')}
                    title={t('methodExecutor.exportCurrent')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-11 px-4"
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
                </div>
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

          {sidePanel === 'history' ? (
            <MobileFullscreenSheet open labelledBy="method-run-history-title">
              <MethodRunHistory
                runs={runs}
                onOpenRun={(config) => {
                  const match = favourites.find((item) => sameMethodConfig(item.config, config))
                  applyConfig(config, match?.id ?? null)
                  setSidePanel('none')
                }}
                onRemoveRun={removeRun}
                onClearRuns={clearRuns}
                onClose={() => setSidePanel('none')}
              />
            </MobileFullscreenSheet>
          ) : null}
          {exportModal}
          {sidePanel === 'favourites' ? (
            <MobileFullscreenSheet open labelledBy="method-favourites-title">
              <MethodFavourites
                favourites={favourites}
                onOpenFavourite={(favourite) => {
                  applyConfig(favourite.config, favourite.id)
                  setSidePanel('none')
                }}
                onRemoveFavourite={removeFavourite}
                onClearFavourites={clearFavourites}
                onUpdateFavouriteMeta={updateFavouriteMeta}
                onDuplicateFavourite={duplicateFavourite}
                onClose={() => setSidePanel('none')}
              />
            </MobileFullscreenSheet>
          ) : null}
        </div>
      </EnvThisProvider>
    )
  }

  return (
    <EnvThisProvider value={methodThis}>
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
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant={sidePanel === 'favourites' ? 'secondary' : 'outline'}
                  size="xs"
                  className="h-6 gap-1 px-2"
                  onClick={() =>
                    setSidePanel((panel) => (panel === 'favourites' ? 'none' : 'favourites'))
                  }
                >
                  <Star className="h-3.5 w-3.5" />
                  {t('methodExecutor.favourites')}
                </Button>
                <Button
                  variant={sidePanel === 'history' ? 'secondary' : 'outline'}
                  size="xs"
                  className="h-6 gap-1 px-2"
                  onClick={() =>
                    setSidePanel((panel) => (panel === 'history' ? 'none' : 'history'))
                  }
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {t('methodExecutor.history')}
                </Button>
              </div>
            </div>

            {sidePanel === 'favourites' ? (
              <MethodFavourites
                favourites={favourites}
                onOpenFavourite={(favourite) => {
                  applyConfig(favourite.config, favourite.id)
                  setSidePanel('none')
                }}
                onRemoveFavourite={removeFavourite}
                onClearFavourites={clearFavourites}
                onUpdateFavouriteMeta={updateFavouriteMeta}
                onDuplicateFavourite={duplicateFavourite}
                onClose={() => setSidePanel('none')}
              />
            ) : null}

            {sidePanel === 'history' ? (
              <MethodRunHistory
                runs={runs}
                onOpenRun={(config) => {
                  const match = favourites.find((item) => sameMethodConfig(item.config, config))
                  applyConfig(config, match?.id ?? null)
                  setSidePanel('none')
                }}
                onRemoveRun={removeRun}
                onClearRuns={clearRuns}
                onClose={() => setSidePanel('none')}
              />
            ) : null}

            <div
              className={cn('space-y-3', sidePanel !== 'none' && 'border-border/70 border-t pt-4')}
            >
              {sidePanel !== 'none' ? (
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {t('methodExecutor.methodComposer')}
                </p>
              ) : null}

              <MethodSelector
                scope={scope}
                methodName={methodName}
                dataClass={dataClass}
                singletonName={singletonName}
                keyValue={key}
                entitySetId={entitySetId}
                methods={methods}
                dataClasses={dataClasses}
                singletons={singletons}
                catalogLoading={catalogLoading}
                catalogError={catalogError}
                onScopeChange={(next) => {
                  setScope(next)
                  clearMethod()
                }}
                onChooseMethod={chooseMethod}
                onClearMethod={clearMethod}
                onDataClassChange={setDataClass}
                onSingletonNameChange={setSingletonName}
                onKeyChange={setKey}
                onEntitySetIdChange={setEntitySetId}
              />

              <RuntimeArgumentsEditor
                argumentsList={argumentsList}
                dataClasses={dataClasses}
                onChange={setArgumentsList}
              />

              <MethodWrapperEditor
                enabled={wrapperEnabled}
                onEnabledChange={(next) => {
                  setWrapperEnabled(next)
                  if (next) setUseGet(false)
                }}
                value={wrapperText}
                onChange={(next) => {
                  setWrapperText(next)
                  if (next.trim()) setUseGet(false)
                }}
              />

              {error ? (
                <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">{error}</p>
              ) : null}

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-2 backdrop-blur">
                {allowedOnHTTPGET ? (
                  <Label
                    className="flex items-center gap-2 text-xs"
                    title={wrapperEnabled ? t('methodExecutor.wrapperRequiresPost') : undefined}
                  >
                    <Checkbox
                      checked={useGet}
                      disabled={wrapperEnabled}
                      onCheckedChange={(checked) => setUseGet(checked === true)}
                    />
                    {t('methodExecutor.executeWithGet')}
                  </Label>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {t('methodExecutor.postRequest')}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(mobile ? 'h-11 w-11' : 'h-8 w-8')}
                    disabled={!canExecute}
                    onClick={toggleCurrentFavourite}
                    aria-label={favouriteButtonLabel}
                    title={favouriteButtonLabel}
                    aria-pressed={isCurrentFavourite}
                  >
                    <Star
                      className={cn(
                        'h-3.5 w-3.5',
                        isCurrentFavourite && 'fill-current text-amber-500',
                        canUpdateFavourite && !isCurrentFavourite && 'text-amber-500'
                      )}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(mobile ? 'h-11 w-11' : 'h-8 w-8')}
                    disabled={!canExecute}
                    onClick={() => setExportOpen(true)}
                    aria-label={t('methodExecutor.exportCurrent')}
                    title={t('methodExecutor.exportCurrent')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
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
              <ResultPanel result={result} rawBody={rawBody} responseMeta={responseMeta} />
            </div>
          </>
        }
      />
      {exportModal}
    </EnvThisProvider>
  )
}
