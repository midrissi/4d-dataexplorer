import { Button, Checkbox, cn, Label } from '@4d/ui'
import {
  ChevronLeft,
  Clock3,
  Code2,
  Download,
  MousePointerClick,
  Play,
  Square,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CopyAsMenu } from '~/components/CopyAs/CopyAsMenu'
import { EmptyPanel } from '~/components/EmptyPanel'
import { EnvThisProvider } from '~/components/Environments/env-this-context'
import { MobileFullscreenSheet } from '~/components/MobileFullscreenSheet'
import { PostmanExportModal } from '~/components/PostmanExport'
import { QueryExplainToggle } from '~/components/QueryExplain/QueryExplainToggle'
import { RequestHeadersParamsEditor } from '~/components/RequestKeyValue'
import { RequestResponseSplit } from '~/components/RequestResponseSplit'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { consoleService } from '~/lib/console'
import { copyableFromMethodSeed } from '~/lib/copy-as'
import { resolveEnvTemplates } from '~/lib/env'
import { getActiveEnvMap, mergeUnresolved } from '~/lib/env/runtime'
import { buildMethodThis } from '~/lib/env/this-context-builders'
import {
  keyValuePairsToRecord,
  nonemptyKeyValuePairs,
  resolveKeyValuePairs,
} from '~/lib/key-value-pairs'
import { methodSeedToHttpSeed } from '~/lib/method-seed-to-http-seed'
import { isModClick, isModShiftClick } from '~/lib/mod-click'
import { getBaseUrl, isMobileShell } from '~/lib/platform'
import {
  methodSeedExportLabel,
  methodSeedToPostmanItem,
  type PostmanExportItemInput,
} from '~/lib/postman'
import { areQueryExplainParamsEnabled, setQueryExplainParams } from '~/lib/query-explain/params'
import type { HttpClientResponse, HttpKeyValuePair } from '~/store/http-client-types'
import type {
  MethodExecutorSeed,
  MethodScope,
  RuntimeArgument,
} from '~/store/method-executor-types'
import { useMethodFavouritesStore } from '~/store/method-favourites'
import { useMethodRunHistoryStore } from '~/store/method-run-history'
import { sameMethodConfig } from '~/store/same-method-config'
import { platformModLabel } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import {
  createDefaultMethodQueryParams,
  hasExtraMethodQueryParams,
  resolveMethodQueryParams,
} from './default-method-query-params'
import { type DetectedMethodResult, detectMethodResult } from './detect-method-result'
import { MethodAdvancedSection } from './MethodAdvancedSection'
import { MethodFavourites } from './MethodFavourites'
import { MethodRunHistory } from './MethodRunHistory'
import { MethodSelector } from './MethodSelector'
import { flushPendingWrapperText, MethodWrapperEditor } from './MethodWrapperEditor'
import { methodExecutionErrorResponse, methodRequestUrl } from './method-execution-error'
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
  const [queryParams, setQueryParams] = useState<HttpKeyValuePair[]>(() =>
    resolveMethodQueryParams(seed?.queryParams)
  )
  const [headers, setHeaders] = useState<HttpKeyValuePair[]>(() => seed?.headers ?? [])
  const [advancedOpen, setAdvancedOpen] = useState(
    () =>
      Boolean(seed?.wrapperEnabled) ||
      hasExtraMethodQueryParams(seed?.queryParams) ||
      Boolean(seed?.headers?.length)
  )
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
  /** Pre-flight validation messages under the composer (not execution failures). */
  const [error, setError] = useState<string | null>(null)
  /** Execution / network failures shown in the result panel (like HTTP Client). */
  const [errorResponse, setErrorResponse] = useState<HttpClientResponse | null>(null)
  const [executing, setExecuting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
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
    setQueryParams(resolveMethodQueryParams(config.queryParams))
    setHeaders(config.headers ?? [])
    setAdvancedOpen(
      Boolean(config.wrapperEnabled) ||
        hasExtraMethodQueryParams(config.queryParams) ||
        Boolean(config.headers?.length)
    )
    setArgumentsList(initialArguments(config))
    setResult(null)
    setRawBody(undefined)
    setResponseMeta(null)
    setError(null)
    setErrorResponse(null)
    setLinkedFavouriteId(favouriteId)
    if (mobile) setMobileStep(config.methodName ? 'args' : 'method')
  }

  const chooseMethod = (
    item: MethodCatalogItem,
    options?: { forceNew?: boolean; openInHttpClient?: boolean }
  ) => {
    const seed = {
      scope: item.scope,
      methodName: item.methodName,
      dataClass: item.dataClass,
      singletonName: item.singletonName,
      key: item.scope === 'entity' ? key || undefined : undefined,
      entitySetId: item.scope === 'entitySelection' ? entitySetId || undefined : undefined,
      paramsText: item.paramsText,
      allowedOnHTTPGET: item.allowedOnHTTPGET,
      arguments: withPositionalNames(parseParamsText(item.paramsText)),
    }
    if (options?.openInHttpClient) {
      useTabsStore.getState().openHttpClientTab(methodSeedToHttpSeed(seed), { forceNew: true })
      return
    }
    if (options?.forceNew) {
      useTabsStore.getState().openMethodExecutorTab(seed, { forceNew: true, activate: false })
      return
    }
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
    setErrorResponse(null)
    setLinkedFavouriteId(null)
    if (mobile) setMobileStep('args')
  }

  const openSeededConfig = (
    config: MethodExecutorSeed,
    favouriteId: string | null,
    event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }
  ) => {
    if (isModShiftClick(event)) {
      useTabsStore.getState().openHttpClientTab(methodSeedToHttpSeed(config), { forceNew: true })
      setSidePanel('none')
      return
    }
    if (isModClick(event)) {
      useTabsStore.getState().openMethodExecutorTab(config, { forceNew: true, activate: false })
      setSidePanel('none')
      return
    }
    applyConfig(config, favouriteId)
    setSidePanel('none')
  }

  const clearMethod = () => {
    setMethodName('')
    setArgumentsList([])
    setWrapperEnabled(false)
    setWrapperText(DEFAULT_METHOD_WRAPPER_TEXT)
    setQueryParams(createDefaultMethodQueryParams())
    setHeaders([])
    setKey('')
    setEntitySetId('')
    setFilter('')
    setOrderby('')
    setResult(null)
    setRawBody(undefined)
    setResponseMeta(null)
    setError(null)
    setErrorResponse(null)
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
    queryParams: nonemptyKeyValuePairs(queryParams),
    headers: nonemptyKeyValuePairs(headers),
  })

  const builderSeed = useMemo(
    () => ({
      scope,
      methodName,
      dataClass: scope === 'singleton' ? undefined : dataClass || undefined,
      singletonName: scope === 'singleton' ? singletonName || undefined : undefined,
      key: key || undefined,
      entitySetId: entitySetId || undefined,
      filter: entitySetId.trim() ? undefined : filter || undefined,
      orderby: entitySetId.trim() ? undefined : orderby || undefined,
      allowedOnHTTPGET,
      useGet,
      arguments: argumentsList,
      wrapperEnabled: wrapperEnabled || undefined,
      wrapperText: wrapperEnabled && wrapperText.trim() ? wrapperText : undefined,
      queryParams: nonemptyKeyValuePairs(queryParams),
      headers: nonemptyKeyValuePairs(headers),
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
      allowedOnHTTPGET,
      useGet,
      argumentsList,
      wrapperEnabled,
      wrapperText,
      queryParams,
      headers,
    ]
  )

  // Keep the tab seed in sync so method / args / wrapper / params / headers survive reload.
  useEffect(() => {
    const tab = useTabsStore.getState().tabs.find((item) => item.id === tabId)
    if (tab?.type !== 'method-executor') return
    if (tab.seed && sameMethodConfig(tab.seed, builderSeed)) return
    useTabsStore.getState().setMethodExecutorTabSeed(tabId, builderSeed)
  }, [builderSeed, tabId])

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
        queryParams,
        headers,
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
      queryParams,
      headers,
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

  const advancedBadgeCount =
    (wrapperEnabled ? 1 : 0) +
    queryParams.filter((pair) => pair.enabled && pair.key.trim()).length +
    headers.filter((pair) => pair.enabled && pair.key.trim()).length

  const advancedEditors = (
    <MethodAdvancedSection
      open={advancedOpen}
      onOpenChange={setAdvancedOpen}
      badgeCount={advancedBadgeCount}
    >
      <MethodWrapperEditor
        enabled={wrapperEnabled}
        onEnabledChange={(next) => {
          setWrapperEnabled(next)
          if (next) {
            setUseGet(false)
            setAdvancedOpen(true)
          }
        }}
        value={wrapperText}
        onChange={(next) => {
          setWrapperText(next)
          if (next.trim()) setUseGet(false)
        }}
      />
      <RequestHeadersParamsEditor
        params={queryParams}
        headers={headers}
        onParamsChange={setQueryParams}
        onHeadersChange={setHeaders}
        thisRoot={methodThis}
      />
    </MethodAdvancedSection>
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
      queryParams,
      headers,
    })
    const resolveOpts = { this: thisRoot }
    const resolvedArgs = resolveRuntimeArgumentsEnv(args, resolveOpts)
    const resolvedKey = resolveEnvTemplates(key, map, resolveOpts)
    const resolvedEntitySetId = resolveEnvTemplates(entitySetId, map, resolveOpts)
    const resolvedFilter = resolveEnvTemplates(filter, map, resolveOpts)
    const resolvedOrderby = resolveEnvTemplates(orderby, map, resolveOpts)
    const resolvedWrapperText = resolveEnvTemplates(liveWrapperText, map, resolveOpts)
    const resolvedQuery = resolveKeyValuePairs(queryParams, map, thisRoot)
    const resolvedHeaders = resolveKeyValuePairs(headers, map, thisRoot)
    const unresolved = mergeUnresolved(
      resolvedArgs.unresolved,
      resolvedKey.unresolved,
      resolvedEntitySetId.unresolved,
      resolvedFilter.unresolved,
      resolvedOrderby.unresolved,
      resolvedWrapperText.unresolved,
      resolvedQuery.unresolved,
      resolvedHeaders.unresolved
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
    const requestHeaders = keyValuePairsToRecord(resolvedHeaders.pairs)
    const requestQuery = keyValuePairsToRecord(resolvedQuery.pairs)

    try {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setExecuting(true)
      setError(null)
      setErrorResponse(null)
      setResult(null)
      setRawBody(undefined)
      setResponseMeta(null)
      const startedAt = performance.now()
      const requestUrl = methodRequestUrl(
        {
          scope,
          methodName,
          dataClass: scope === 'singleton' ? undefined : dataClass || undefined,
          singletonName: scope === 'singleton' ? singletonName || undefined : undefined,
          key: resolvedKey.text || undefined,
          entitySetId: resolvedEntitySetId.text || undefined,
        },
        requestQuery
      )
      try {
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
          signal: controller.signal,
          // `$method` lives in Advanced → Params (default entityset); do not re-inject.
          createEntitySet: false,
          headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
          query: Object.keys(requestQuery).length > 0 ? requestQuery : undefined,
        })
        if (controller.signal.aborted) return
        const detected = detectMethodResult(response.unwrap(), { webform: response.webform() })
        setResult(detected)
        setRawBody(response.body)
        setResponseMeta(methodResponseMetaFromCall(response))
        setErrorResponse(null)
        addRun(
          {
            ...currentConfig(),
            arguments: args,
            useGet: useGetRequest,
            wrapperEnabled: wrapperEnabled || undefined,
            wrapperText: wrapperEnabled && liveWrapperText.trim() ? liveWrapperText : undefined,
            queryParams: nonemptyKeyValuePairs(queryParams),
            headers: nonemptyKeyValuePairs(headers),
          },
          detected.kind
        )
        if (mobile) setMobileStep('result')
      } catch (reason) {
        const durationMs = performance.now() - startedAt
        setResult(null)
        setRawBody(undefined)
        setResponseMeta(null)
        setErrorResponse(
          methodExecutionErrorResponse(reason, {
            url: requestUrl,
            durationMs,
          })
        )
        if (mobile) setMobileStep('result')
      }
    } finally {
      setExecuting(false)
    }
  }

  const cancelExecution = () => {
    abortRef.current?.abort()
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

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
                {advancedEditors}
                {error ? (
                  <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mobileStep === 'result' ? (
              <div className="flex h-full min-h-0 flex-col">
                <ResultPanel
                  result={result}
                  rawBody={rawBody}
                  responseMeta={responseMeta}
                  errorResponse={errorResponse}
                  methodSelected={Boolean(methodName)}
                />
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
                <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                  <QueryExplainToggle
                    checked={areQueryExplainParamsEnabled(queryParams)}
                    disabled={executing}
                    onCheckedChange={(checked) =>
                      setQueryParams((current) => setQueryExplainParams(current, checked))
                    }
                  />
                </div>
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
                  <CopyAsMenu
                    getRequest={() => copyableFromMethodSeed(currentConfig(), getBaseUrl())}
                    disabled={!canExecute}
                    variant="outline"
                    triggerClassName="h-11 w-11"
                    iconClassName="h-4 w-4"
                  />
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
                  {executing ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-11 px-4"
                      onClick={cancelExecution}
                    >
                      <Square className="mr-1.5 h-3.5 w-3.5" />
                      {t('methodExecutor.cancel')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-11 px-4"
                      onClick={() => void execute()}
                      disabled={!canExecute}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      {t('methodExecutor.execute')}
                    </Button>
                  )}
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
                onOpenRun={(config, event) => {
                  const match = favourites.find((item) => sameMethodConfig(item.config, config))
                  openSeededConfig(config, match?.id ?? null, event)
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
                onOpenFavourite={(favourite, event) => {
                  openSeededConfig(favourite.config, favourite.id, event)
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
                onOpenFavourite={(favourite, event) => {
                  openSeededConfig(favourite.config, favourite.id, event)
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
                onOpenRun={(config, event) => {
                  const match = favourites.find((item) => sameMethodConfig(item.config, config))
                  openSeededConfig(config, match?.id ?? null, event)
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

              {methodName ? (
                <>
                  <RuntimeArgumentsEditor
                    argumentsList={argumentsList}
                    dataClasses={dataClasses}
                    onChange={setArgumentsList}
                  />

                  {advancedEditors}

                  {error ? (
                    <p className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                      {error}
                    </p>
                  ) : null}
                </>
              ) : (
                <EmptyPanel
                  icon={Code2}
                  badgeIcon={MousePointerClick}
                  badgeTone="primary"
                  title={t('methodExecutor.selectMethodTitle')}
                  description={t('methodExecutor.selectMethodDescription')}
                  ghost="none"
                  bordered
                  size="sm"
                  className="min-h-0"
                />
              )}

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-2 backdrop-blur">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  {methodName ? (
                    <QueryExplainToggle
                      checked={areQueryExplainParamsEnabled(queryParams)}
                      disabled={executing}
                      onCheckedChange={(checked) =>
                        setQueryParams((current) => setQueryExplainParams(current, checked))
                      }
                    />
                  ) : null}
                  {!methodName ? (
                    <span className="text-muted-foreground text-xs">
                      {t('methodExecutor.chooseMethodFirst')}
                    </span>
                  ) : allowedOnHTTPGET ? (
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
                </div>
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
                  <CopyAsMenu
                    getRequest={() => copyableFromMethodSeed(currentConfig(), getBaseUrl())}
                    disabled={!canExecute}
                    variant="outline"
                    triggerClassName={cn(mobile ? 'h-11 w-11' : 'h-8 w-8')}
                    iconClassName="h-3.5 w-3.5"
                  />
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
                  {executing ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className={cn(mobile ? 'h-11 px-4' : 'h-8')}
                      onClick={cancelExecution}
                    >
                      <Square className="mr-1.5 h-3.5 w-3.5" />
                      {t('methodExecutor.cancel')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={canExecute ? 'default' : 'outline'}
                      className={cn(mobile ? 'h-11 px-4' : 'h-8')}
                      onClick={() => void execute()}
                      disabled={!canExecute}
                      title={
                        methodName
                          ? `${t('methodExecutor.execute')} (${platformModLabel()}+Enter)`
                          : t('methodExecutor.chooseMethodFirst')
                      }
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      {t('methodExecutor.execute')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        }
        response={
          <>
            <div className="mb-2 shrink-0">
              <h2 className="font-medium text-sm">{t('methodExecutor.result')}</h2>
              <p className="text-muted-foreground text-xs">
                {methodName
                  ? t('methodExecutor.resultHint')
                  : t('methodExecutor.chooseMethodFirst')}
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ResultPanel
                result={result}
                rawBody={rawBody}
                responseMeta={responseMeta}
                errorResponse={errorResponse}
                methodSelected={Boolean(methodName)}
              />
            </div>
          </>
        }
      />
      {exportModal}
    </EnvThisProvider>
  )
}
