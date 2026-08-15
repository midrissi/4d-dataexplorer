import {
  Button,
  ClickToCopy,
  cn,
  Input,
  Label,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowLeft,
  Binary,
  Braces,
  ChevronDown,
  CircleOff,
  Clock3,
  Cookie,
  Copy,
  Download,
  Inbox,
  Link2,
  List,
  RefreshCw,
  Route,
  Send,
  Shield,
  Square,
  Star,
  Timer,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { MobileFullscreenSheet } from '~/components/MobileFullscreenSheet'
import { PostmanExportModal } from '~/components/PostmanExport'
import { KeyValueEditor } from '~/components/RequestKeyValue'
import { RequestResponseSplit } from '~/components/RequestResponseSplit'
import { SuggestInput } from '~/components/SuggestInput'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { applyEnvTemplateDecorations, registerEnvTemplateCompletionProvider } from '~/lib/env'
import { buildHttpThis } from '~/lib/env/this-context-builders'
import {
  applyParamsToPath,
  buildRestPathCatalog,
  buildRestPathSuggestions,
  COMMON_CONTENT_TYPES,
  COMMON_REQUEST_HEADERS,
  createEmptyHttpDraft,
  draftToHttpSeed,
  executeHttpRequest,
  type HttpClientRequestDraft,
  inferRawContentType,
  joinOriginAndPath,
  listHttpBuiltInHeaders,
  mergeRestPathSuggestions,
  monacoLanguageForRaw,
  REST_QUERY_PARAMS,
  type RestPathCatalog,
  recentPathsFromHttpHistory,
  resolveHttpClientDraftEnv,
  restParamValueSuggestions,
  setBuiltInHeaderEnabled,
  syncParamsFromPath,
  upsertBuiltInHeaderOverride,
} from '~/lib/http-client'
import { isModClick } from '~/lib/mod-click'
import { getBaseUrl, isDesktop, isMobileShell, onConnectionChange } from '~/lib/platform'
import { areQueryExplainParamsEnabled, setQueryExplainParams } from '~/lib/query-explain/params'
import {
  httpSeedExportLabel,
  httpSeedToPostmanItem,
  type PostmanExportItemInput,
} from '~/lib/postman'
import { useDataExplorerStore } from '~/store'
import {
  createHttpId,
  HTTP_METHODS,
  type HttpBodyMode,
  type HttpClientResponse,
  type HttpClientSeed,
  type HttpRawLanguage,
} from '~/store/http-client-types'
import { useHttpRequestFavouritesStore } from '~/store/http-request-favourites'
import { useHttpRequestHistoryStore } from '~/store/http-request-history'
import { sameHttpSeed } from '~/store/same-http-seed'
import { platformModLabel, useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { BuiltInHeadersEditor } from './BuiltInHeadersEditor'
import { CookieJarEditor } from './CookieJarEditor'
import { FormDataEditor } from './FormDataEditor'
import { HttpFilePicker } from './HttpFilePicker'
import { HttpRequestFavourites } from './HttpRequestFavourites'
import { HttpRequestHistory } from './HttpRequestHistory'
import { HttpResponsePanel } from './HttpResponsePanel'
import { httpMethodTone, httpRequestLabel } from './http-request-display'

type RequestTab = 'params' | 'headers' | 'body' | 'settings'
type SidePanel = 'none' | 'history' | 'favourites'

function methodToneClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'POST':
      return 'text-sky-600 dark:text-sky-400'
    case 'PUT':
      return 'text-amber-600 dark:text-amber-400'
    case 'PATCH':
      return 'text-violet-600 dark:text-violet-400'
    case 'DELETE':
      return 'text-rose-600 dark:text-rose-400'
    case 'HEAD':
    case 'OPTIONS':
      return 'text-muted-foreground'
    default:
      return 'text-foreground'
  }
}

const borderlessInputClass =
  'h-full min-w-0 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0'

function SettingsSection({
  icon: Icon,
  title,
  description,
  tone = 'default',
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  tone?: 'default' | 'amber' | 'cyan'
  children: ReactNode
}) {
  const mobile = isMobileShell()
  // Advanced settings groups are collapsed by default on mobile to keep the
  // page short; desktop keeps them always expanded.
  const [open, setOpen] = useState(!mobile)
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : tone === 'cyan'
        ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
        : 'bg-primary/10 text-primary'

  const header = (
    <div className="flex items-start gap-2.5 bg-muted/20 px-3 py-2">
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm',
          toneClass
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-xs leading-none">{title}</h3>
        {description ? (
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{description}</p>
        ) : null}
      </div>
      {mobile ? (
        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      ) : null}
    </div>
  )

  return (
    <section className="overflow-hidden rounded-md border border-border/70 bg-card/60 shadow-xs">
      {mobile ? (
        <button
          type="button"
          className={cn('block min-h-11 w-full text-left', open && 'border-border/60 border-b')}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {header}
        </button>
      ) : (
        <div className="border-border/60 border-b">{header}</div>
      )}
      {open ? <div className="divide-y divide-border/60">{children}</div> : null}
    </section>
  )
}

function SettingsToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  danger,
}: {
  label: string
  hint: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-3.5 py-3 transition-colors',
        'hover:bg-muted/40',
        danger && checked && 'bg-amber-500/6'
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => onCheckedChange(!checked)}
      >
        <p className="font-medium text-sm">{label}</p>
        <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">{hint}</p>
      </button>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  )
}

export function HttpClient({ tabId, seed }: { tabId: string; seed?: HttpClientSeed }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const editorPrefs = useCodeEditorPrefs()
  const updateEditorPrefs = useUpdateCodeEditorPrefs()
  const [draft, setDraft] = useState<HttpClientRequestDraft>(() => createEmptyHttpDraft(seed))
  const envField = useTemplatedEnvFieldProps({ thisRoot: buildHttpThis(draft) })
  const [requestTab, setRequestTab] = useState<RequestTab>('params')
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<HttpClientResponse | null>(null)
  const [sidePanel, setSidePanel] = useState<SidePanel>('none')
  const [exportOpen, setExportOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'request' | 'response'>('request')
  const [seedWarnings] = useState(() => seed?.warnings ?? [])
  /** Favourite opened or last saved from this editor — enables update when the request changes. */
  const [linkedFavouriteId, setLinkedFavouriteId] = useState<string | null>(() => {
    if (!seed) return null
    return (
      useHttpRequestFavouritesStore
        .getState()
        .favourites.find((item) => sameHttpSeed(item.seed, seed))?.id ?? null
    )
  })
  const abortRef = useRef<AbortController | null>(null)
  const fileMapRef = useRef<Map<string, File>>(new Map())
  const binaryFileRef = useRef<File | null>(null)
  const [binaryFileSize, setBinaryFileSize] = useState<number | undefined>()
  const [cookieJarRevision, setCookieJarRevision] = useState(0)
  const contentTypeTouchedRef = useRef(false)
  const canSendRef = useRef(false)
  const sendingRef = useRef(false)
  const sendRef = useRef<() => void>(() => {})
  const tabIdRef = useRef(tabId)
  tabIdRef.current = tabId

  const historyRequests = useHttpRequestHistoryStore((state) => state.requests)
  const historyMaxCount = useHttpRequestHistoryStore((state) => state.maxCount)
  const addHistoryRequest = useHttpRequestHistoryStore((state) => state.addRequest)
  const removeHistoryRequest = useHttpRequestHistoryStore((state) => state.removeRequest)
  const clearHistoryRequests = useHttpRequestHistoryStore((state) => state.clearRequests)
  const setHistoryMaxCount = useHttpRequestHistoryStore((state) => state.setMaxCount)
  const favourites = useHttpRequestFavouritesStore((state) => state.favourites)
  const addFavourite = useHttpRequestFavouritesStore((state) => state.addFavourite)
  const updateFavourite = useHttpRequestFavouritesStore((state) => state.updateFavourite)
  const duplicateFavourite = useHttpRequestFavouritesStore((state) => state.duplicateFavourite)
  const removeFavourite = useHttpRequestFavouritesStore((state) => state.removeFavourite)
  const clearFavourites = useHttpRequestFavouritesStore((state) => state.clearFavourites)
  const updateFavouriteMeta = useHttpRequestFavouritesStore((state) => state.updateFavouriteMeta)

  const applySeed = (nextSeed: HttpClientSeed, favouriteId: string | null = null) => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
    fileMapRef.current = new Map()
    binaryFileRef.current = null
    setBinaryFileSize(undefined)
    contentTypeTouchedRef.current = false
    setDraft(createEmptyHttpDraft(nextSeed))
    setResponse(null)
    setLinkedFavouriteId(favouriteId)
    if (mobile) setMobilePane('request')
  }

  const openSeededRequest = (
    nextSeed: HttpClientSeed,
    favouriteId: string | null,
    event: { metaKey: boolean; ctrlKey: boolean }
  ) => {
    if (isModClick(event)) {
      useTabsStore.getState().openHttpClientTab(nextSeed)
      setSidePanel('none')
      return
    }
    applySeed(nextSeed, favouriteId)
    setSidePanel('none')
  }

  const currentOrigin = getBaseUrl().replace(/\/$/, '') || window.location.origin
  const dataclassNamesKey = useDataExplorerStore((state) =>
    state.dataclasses.map((dc) => dc.name).join('\0')
  )
  const [pathCatalog, setPathCatalog] = useState<RestPathCatalog>({})
  const pathSuggestions = useMemo(() => {
    const recent = recentPathsFromHttpHistory(historyRequests, {
      targetMode: draft.targetMode,
      customOrigin: draft.customOrigin,
    })
    const catalog = buildRestPathSuggestions(
      draft.path,
      dataclassNamesKey ? dataclassNamesKey.split('\0') : [],
      pathCatalog
    )
    const recentSet = new Set(recent.map((path) => path.toLowerCase()))
    const catalogOnly = catalog.filter((path) => !recentSet.has(path.toLowerCase()))
    const merged = mergeRestPathSuggestions(catalogOnly, recent)
    return merged.map((value) => ({
      value,
      group: recentSet.has(value.toLowerCase()) ? 'recent' : 'catalog',
    }))
  }, [
    dataclassNamesKey,
    draft.customOrigin,
    draft.path,
    draft.targetMode,
    historyRequests,
    pathCatalog,
  ])
  const pathSuggestionGroupLabels = useMemo(
    () => ({
      recent: t('httpClient.pathSuggestRecent'),
      catalog: t('httpClient.pathSuggestCatalog'),
    }),
    [t]
  )
  const serverSuggestions = useMemo(() => (currentOrigin ? [currentOrigin] : []), [currentOrigin])

  useEffect(() => {
    let cancelled = false
    void api
      .getCatalog()
      .then((catalog) => {
        if (cancelled) return
        setPathCatalog(buildRestPathCatalog(catalog.dataClasses ?? []))
      })
      .catch(() => {
        if (!cancelled) setPathCatalog({})
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const updateDraft = (patch: Partial<HttpClientRequestDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const setBody = (patch: Partial<HttpClientRequestDraft['body']>) => {
    setDraft((prev) => ({ ...prev, body: { ...prev.body, ...patch } }))
  }

  const setSettings = (patch: Partial<HttpClientRequestDraft['settings']>) => {
    setDraft((prev) => {
      const settings = { ...prev.settings, ...patch }
      let disabledBuiltInHeaders = prev.disabledBuiltInHeaders
      if (typeof patch.sendCookies === 'boolean') {
        const withoutCookie = disabledBuiltInHeaders.filter((name) => name !== 'cookie')
        disabledBuiltInHeaders = patch.sendCookies ? withoutCookie : [...withoutCookie, 'cookie']
      }
      return { ...prev, settings, disabledBuiltInHeaders }
    })
  }

  const onPathChange = (path: string) => {
    const params = syncParamsFromPath(path)
    updateDraft({ path, params })
  }

  const onParamsChange = (params: HttpClientRequestDraft['params']) => {
    const pathOnly = draft.path.split('?')[0] || '/'
    const nextPath = applyParamsToPath(pathOnly, params)
    updateDraft({ params, path: nextPath })
  }

  const setBodyMode = (mode: HttpBodyMode) => {
    setDraft((prev) => {
      const nextBody = { ...prev.body, mode }
      if (contentTypeTouchedRef.current || mode === 'none' || mode === 'form-data') {
        return { ...prev, body: nextBody }
      }

      const headers = prev.headers.filter((h) => h.key.toLowerCase() !== 'content-type')
      if (mode === 'urlencoded') {
        headers.push({
          id: createHttpId(),
          key: 'Content-Type',
          value: 'application/x-www-form-urlencoded',
          enabled: true,
        })
      } else if (mode === 'raw') {
        headers.push({
          id: createHttpId(),
          key: 'Content-Type',
          value: prev.body.rawContentType || inferRawContentType(prev.body.rawLanguage, ''),
          enabled: true,
        })
      } else if (mode === 'binary') {
        headers.push({
          id: createHttpId(),
          key: 'Content-Type',
          value: prev.body.binaryContentType || 'application/octet-stream',
          enabled: true,
        })
      }
      return { ...prev, headers, body: nextBody }
    })
  }

  const setRawLanguage = (rawLanguage: HttpRawLanguage) => {
    const rawContentType =
      rawLanguage === 'custom'
        ? draft.body.rawContentType
        : inferRawContentType(rawLanguage, draft.body.rawContentType)
    setBody({ rawLanguage, rawContentType })
    if (!contentTypeTouchedRef.current && draft.body.mode === 'raw') {
      const headers = draft.headers.map((h) =>
        h.key.toLowerCase() === 'content-type' ? { ...h, value: rawContentType } : h
      )
      const hasCt = headers.some((h) => h.key.toLowerCase() === 'content-type')
      updateDraft({
        headers: hasCt
          ? headers
          : [
              ...headers,
              {
                id: createHttpId(),
                key: 'Content-Type',
                value: rawContentType,
                enabled: true,
              },
            ],
        body: { ...draft.body, rawLanguage, rawContentType },
      })
    }
  }

  const canSend = useMemo(() => {
    if (draft.targetMode === 'custom' && !draft.customOrigin.trim()) return false
    if (draft.method === 'CUSTOM' && !draft.customMethod.trim()) return false
    return Boolean((draft.path || '/').trim())
  }, [draft])

  const builderSeed = useMemo(() => draftToHttpSeed(draft), [draft])

  // Keep the tab seed in sync so path/method/body survive page reload.
  useEffect(() => {
    const tab = useTabsStore.getState().tabs.find((item) => item.id === tabId)
    if (tab?.type !== 'http-client') return
    if (tab.seed && sameHttpSeed(tab.seed, builderSeed)) return
    useTabsStore.getState().setHttpClientTabSeed(tabId, builderSeed)
  }, [builderSeed, tabId])

  const linkedFavourite = linkedFavouriteId
    ? favourites.find((item) => item.id === linkedFavouriteId)
    : undefined
  const isCurrentFavourite = favourites.some((item) => sameHttpSeed(item.seed, builderSeed))
  const canUpdateFavourite =
    linkedFavourite != null && !sameHttpSeed(linkedFavourite.seed, builderSeed)
  const favouriteButtonLabel = isCurrentFavourite
    ? t('httpClient.removeFavourite')
    : canUpdateFavourite
      ? t('httpClient.updateFavourite')
      : t('httpClient.addFavourite')

  const toggleCurrentFavourite = () => {
    if (!canSend) return
    if (isCurrentFavourite) {
      const existing = favourites.find((item) => sameHttpSeed(item.seed, builderSeed))
      if (existing) {
        removeFavourite(existing.id)
        if (linkedFavouriteId === existing.id) setLinkedFavouriteId(null)
      }
      return
    }
    if (linkedFavourite && canUpdateFavourite) {
      updateFavourite(linkedFavourite.id, builderSeed)
      return
    }
    const id = addFavourite(builderSeed)
    if (id) setLinkedFavouriteId(id)
  }

  useEffect(() => {
    if (linkedFavouriteId && !favourites.some((item) => item.id === linkedFavouriteId)) {
      setLinkedFavouriteId(null)
    }
  }, [favourites, linkedFavouriteId])

  const currentExportItems = useMemo((): PostmanExportItemInput[] => {
    const { method, path, fullUrl, isCustomOrigin } = httpRequestLabel(builderSeed)
    const methodStyles = httpMethodTone(method)
    const fallback = isCustomOrigin ? fullUrl : path || httpSeedExportLabel(builderSeed)
    return [
      {
        id: 'current',
        name: fallback,
        listDetail: fallback,
        badgeLabel: method,
        badgeClassName: cn(methodStyles.bg, methodStyles.text),
        item: httpSeedToPostmanItem(builderSeed, { name: fallback }),
      },
    ]
  }, [builderSeed])

  const standardMethods = useMemo(() => HTTP_METHODS.filter((method) => method !== 'CUSTOM'), [])

  const methodInputValue = draft.method === 'CUSTOM' ? draft.customMethod : draft.method

  const onMethodInputChange = (value: string) => {
    const trimmed = value.trim()
    const matched = standardMethods.find((method) => method === trimmed.toUpperCase())
    if (matched) {
      updateDraft({ method: matched, customMethod: '' })
      return
    }
    updateDraft({ method: 'CUSTOM', customMethod: value })
  }

  const serverInputValue = draft.targetMode === 'current' ? currentOrigin : draft.customOrigin

  const onServerInputChange = (value: string) => {
    const trimmed = value.trim().replace(/\/$/, '')
    const current = currentOrigin.replace(/\/$/, '')
    // Allow clearing the field so a new origin can be typed; only snap to
    // "current server" when the value actually matches that origin.
    if (trimmed && trimmed.toLowerCase() === current.toLowerCase()) {
      updateDraft({ targetMode: 'current', customOrigin: '' })
      return
    }
    updateDraft({ targetMode: 'custom', customOrigin: value })
  }

  const send = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSending(true)
    setResponse(null)
    try {
      const result = await executeHttpRequest(draft, {
        signal: controller.signal,
        fileMap: fileMapRef.current,
        binaryFile: binaryFileRef.current,
      })
      setResponse(result)
      if (mobile) setMobilePane('response')
      if (!controller.signal.aborted) {
        addHistoryRequest(draftToHttpSeed(draft), {
          status: result.status,
          statusText: result.statusText,
          durationMs: result.durationMs,
          error: result.error,
        })
      }
    } finally {
      setSending(false)
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  canSendRef.current = canSend
  sendingRef.current = sending
  sendRef.current = () => {
    void send()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return
      if (useTabsStore.getState().activeTabId !== tabIdRef.current) return
      if (!canSendRef.current || sendingRef.current) return
      event.preventDefault()
      event.stopPropagation()
      sendRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    return onConnectionChange(() => {
      setCookieJarRevision((n) => n + 1)
    })
  }, [])

  const previewUrl = useMemo(() => {
    const { draft: resolved } = resolveHttpClientDraftEnv(draft)
    const origin =
      resolved.targetMode === 'custom'
        ? resolved.customOrigin.trim().replace(/\/$/, '')
        : currentOrigin
    if (!origin) return ''
    return joinOriginAndPath(origin, applyParamsToPath(resolved.path || '/', resolved.params))
  }, [currentOrigin, draft])

  const formDataFields = draft.body.formData

  const builtInHeaders = useMemo(() => {
    void cookieJarRevision
    return listHttpBuiltInHeaders(draft)
  }, [draft, cookieJarRevision])

  const tabs: Array<{ id: RequestTab; label: string; count?: number }> = [
    {
      id: 'params',
      label: t('httpClient.params'),
      count: draft.params.filter((p) => p.enabled && p.key).length || undefined,
    },
    {
      id: 'headers',
      label: t('httpClient.headers'),
      count:
        draft.headers.filter((h) => h.enabled && h.key).length +
          builtInHeaders.filter((h) => h.enabled && !h.overridden).length || undefined,
    },
    { id: 'body', label: t('httpClient.body') },
    { id: 'settings', label: t('httpClient.settings') },
  ]

  return (
    <>
      <RequestResponseSplit
        kind="httpClient"
        mobilePane={mobile ? mobilePane : undefined}
        requestClassName="bg-background p-3"
        responseClassName={cn('bg-muted/10 lg:min-h-0', mobile ? 'min-h-0 p-2.5' : 'min-h-105 p-3')}
        request={
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-base">{t('httpClient.title')}</p>
                <p className="text-muted-foreground text-xs">{t('httpClient.subtitle')}</p>
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
                  {t('httpClient.favourites')}
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
                  {t('httpClient.history')}
                </Button>
              </div>
            </div>

            {sidePanel === 'favourites' && !mobile ? (
              <HttpRequestFavourites
                favourites={favourites}
                onOpenFavourite={(favourite, event) => {
                  openSeededRequest(favourite.seed, favourite.id, event)
                }}
                onRemoveFavourite={removeFavourite}
                onClearFavourites={clearFavourites}
                onUpdateFavouriteMeta={updateFavouriteMeta}
                onDuplicateFavourite={duplicateFavourite}
                onClose={() => setSidePanel('none')}
              />
            ) : null}

            {sidePanel === 'history' && !mobile ? (
              <HttpRequestHistory
                requests={historyRequests}
                maxCount={historyMaxCount}
                onOpenRequest={(nextSeed, event) => {
                  const match = favourites.find((item) => sameHttpSeed(item.seed, nextSeed))
                  openSeededRequest(nextSeed, match?.id ?? null, event)
                }}
                onRemoveRequest={removeHistoryRequest}
                onClearRequests={clearHistoryRequests}
                onMaxCountChange={setHistoryMaxCount}
                onClose={() => setSidePanel('none')}
              />
            ) : null}

            {sidePanel === 'favourites' && mobile ? (
              <MobileFullscreenSheet open labelledBy="http-request-favourites-title">
                <HttpRequestFavourites
                  favourites={favourites}
                  onOpenFavourite={(favourite, event) => {
                    openSeededRequest(favourite.seed, favourite.id, event)
                  }}
                  onRemoveFavourite={removeFavourite}
                  onClearFavourites={clearFavourites}
                  onUpdateFavouriteMeta={updateFavouriteMeta}
                  onDuplicateFavourite={duplicateFavourite}
                  onClose={() => setSidePanel('none')}
                />
              </MobileFullscreenSheet>
            ) : null}

            {sidePanel === 'history' && mobile ? (
              <MobileFullscreenSheet open labelledBy="http-request-history-title">
                <HttpRequestHistory
                  requests={historyRequests}
                  maxCount={historyMaxCount}
                  onOpenRequest={(nextSeed, event) => {
                    const match = favourites.find((item) => sameHttpSeed(item.seed, nextSeed))
                    openSeededRequest(nextSeed, match?.id ?? null, event)
                  }}
                  onRemoveRequest={removeHistoryRequest}
                  onClearRequests={clearHistoryRequests}
                  onMaxCountChange={setHistoryMaxCount}
                  onClose={() => setSidePanel('none')}
                />
              </MobileFullscreenSheet>
            ) : null}

            <div
              className={cn(
                'space-y-3',
                sidePanel !== 'none' && !mobile && 'border-border/70 border-t pt-4'
              )}
            >
              {sidePanel !== 'none' && !mobile ? (
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {t('httpClient.requestComposer')}
                </p>
              ) : null}

              {seedWarnings.length > 0 ? (
                <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 text-xs dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t('httpClient.replayWarnings')}
                  </div>
                  <ul className="list-disc pl-4">
                    {seedWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-1">
                <div
                  className={cn(
                    'flex min-w-0 items-stretch overflow-hidden rounded-md border bg-muted/40 transition-colors',
                    mobile ? 'h-10' : 'h-6',
                    'hover:bg-muted/55',
                    'focus-within:border-ring/60 focus-within:bg-background focus-within:ring-1 focus-within:ring-ring/30'
                  )}
                >
                  <SuggestInput
                    className="w-18 shrink-0"
                    inputClassName={cn(
                      borderlessInputClass,
                      'text-center font-semibold text-xs uppercase tracking-wide',
                      methodToneClass(methodInputValue || 'GET')
                    )}
                    placeholder="GET"
                    value={methodInputValue}
                    onChange={onMethodInputChange}
                    suggestions={standardMethods}
                    aria-label={t('httpClient.method')}
                    minListWidth={112}
                  />

                  <div className="my-1 w-px shrink-0 bg-border/80" aria-hidden />

                  <SuggestInput
                    className="w-[min(22rem,40%)] shrink-0"
                    inputClassName={cn(
                      borderlessInputClass,
                      'font-mono text-xs',
                      draft.targetMode === 'current' ? 'text-muted-foreground' : 'text-foreground'
                    )}
                    placeholder={currentOrigin || 'https://example.com'}
                    value={serverInputValue}
                    onChange={onServerInputChange}
                    suggestions={serverSuggestions}
                    aria-label={t('httpClient.server')}
                    minListWidth={280}
                  />

                  <div className="my-1 w-px shrink-0 bg-border/80" aria-hidden />

                  <SuggestInput
                    className="min-w-0 flex-1"
                    inputClassName={cn(borderlessInputClass, 'font-mono text-[11px]')}
                    highlightClassName={cn(
                      borderlessInputClass,
                      'h-full min-h-0 items-center font-mono text-[11px] leading-none'
                    )}
                    placeholder="/rest/Car"
                    value={draft.path}
                    onChange={onPathChange}
                    suggestions={pathSuggestions}
                    groupLabels={pathSuggestionGroupLabels}
                    aria-label={t('httpClient.url')}
                    minListWidth={240}
                    resolveVariable={envField.resolveVariable}
                    onVariableChange={envField.onVariableChange}
                    onManageVariables={envField.onManageVariables}
                    manageVariablesLabel={envField.manageVariablesLabel}
                    writeTargets={envField.writeTargets}
                    addToLabel={envField.addToLabel}
                    unresolvedLabel={envField.unresolvedLabel}
                    valuePlaceholder={envField.valuePlaceholder}
                    variableSuggestions={envField.variableSuggestions}
                    variableGroupLabels={envField.variableGroupLabels}
                  />

                  <div className="flex shrink-0 items-center gap-0.5 border-border/80 border-l bg-background/40 p-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'shrink-0 rounded-sm',
                        mobile ? 'h-8 w-8' : 'h-5 w-5',
                        (isCurrentFavourite || canUpdateFavourite) &&
                          'text-amber-500 hover:text-amber-600'
                      )}
                      disabled={!canSend}
                      onClick={toggleCurrentFavourite}
                      aria-label={favouriteButtonLabel}
                      title={favouriteButtonLabel}
                      aria-pressed={isCurrentFavourite}
                    >
                      <Star
                        className={cn(
                          'h-3 w-3',
                          isCurrentFavourite && 'fill-current',
                          canUpdateFavourite && !isCurrentFavourite && 'text-amber-500'
                        )}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn('shrink-0 rounded-sm', mobile ? 'h-8 w-8' : 'h-5 w-5')}
                      disabled={!canSend}
                      onClick={() => setExportOpen(true)}
                      aria-label={t('httpClient.exportCurrent')}
                      title={t('httpClient.exportCurrent')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {sending ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className={cn(
                          'gap-1 rounded-sm text-[11px]',
                          mobile ? 'h-8 px-3' : 'h-5 px-2'
                        )}
                        onClick={cancel}
                      >
                        <Square className="h-3 w-3" />
                        {t('httpClient.cancel')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className={cn(
                          'gap-1 rounded-sm text-[11px] shadow-sm',
                          mobile ? 'h-8 px-3' : 'h-5 px-2'
                        )}
                        disabled={!canSend}
                        title={`${t('httpClient.send')} (${platformModLabel()}+Enter)`}
                        onClick={() => void send()}
                      >
                        <Send className="h-3 w-3" />
                        {t('httpClient.send')}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="group/url flex min-w-0 items-center gap-1 px-0.5">
                  <span className="shrink-0 rounded-sm bg-muted px-1 py-px font-medium text-[9px] text-muted-foreground uppercase tracking-wide">
                    {t('httpClient.fullUrl')}
                  </span>
                  {previewUrl ? (
                    <>
                      <p
                        className="min-w-0 truncate font-mono text-[10px] text-muted-foreground"
                        title={previewUrl}
                      >
                        {previewUrl}
                      </p>
                      <ClickToCopy
                        as="button"
                        value={previewUrl}
                        tooltipLabel={t('common.clickToCopy')}
                        tooltipCopiedLabel={t('common.copied')}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/url:opacity-100"
                        aria-label={t('common.clickToCopy')}
                      >
                        <Copy className="h-3 w-3" />
                      </ClickToCopy>
                    </>
                  ) : (
                    <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                      {t('httpClient.fullUrlEmpty')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto border-b">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      'shrink-0 cursor-pointer whitespace-nowrap border-b-2 text-xs transition-colors',
                      mobile ? 'min-h-11 px-3 py-2.5' : 'px-3 py-1.5',
                      requestTab === tab.id
                        ? 'border-primary font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setRequestTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count ? ` (${tab.count})` : null}
                  </button>
                ))}
              </div>

              <div className="min-h-55">
                {requestTab === 'params' ? (
                  <KeyValueEditor
                    pairs={draft.params}
                    onChange={onParamsChange}
                    keyPlaceholder={t('httpClient.key')}
                    valuePlaceholder={t('httpClient.value')}
                    keySuggestions={REST_QUERY_PARAMS}
                    getValueSuggestions={restParamValueSuggestions}
                    smartParamValues
                    thisRoot={buildHttpThis(draft)}
                    addLabel={t('httpClient.addParam')}
                    emptyTitle={t('httpClient.noParamsTitle')}
                    emptyDescription={t('httpClient.noParamsDescription')}
                  />
                ) : null}

                {requestTab === 'headers' ? (
                  <div className="space-y-4">
                    <BuiltInHeadersEditor
                      headers={builtInHeaders}
                      onEnabledChange={(headerName, enabled) => {
                        updateDraft(setBuiltInHeaderEnabled(draft, headerName, enabled))
                      }}
                      onValueChange={(headerName, value) => {
                        updateDraft(upsertBuiltInHeaderOverride(draft, headerName, value))
                      }}
                    />
                    <CookieJarEditor
                      disabled={
                        draft.targetMode === 'custom' ||
                        !draft.settings.sendCookies ||
                        draft.disabledBuiltInHeaders.includes('cookie')
                      }
                    />
                    <div className="space-y-2">
                      {builtInHeaders.length > 0 ? (
                        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          {t('httpClient.customHeaders')}
                        </p>
                      ) : null}
                      <KeyValueEditor
                        pairs={draft.headers}
                        onChange={(headers) => {
                          contentTypeTouchedRef.current = headers.some(
                            (h) => h.key.toLowerCase() === 'content-type'
                          )
                          updateDraft({ headers })
                        }}
                        keyPlaceholder={t('httpClient.headerName')}
                        valuePlaceholder={t('httpClient.headerValue')}
                        keySuggestions={COMMON_REQUEST_HEADERS}
                        valueSuggestions={COMMON_CONTENT_TYPES}
                        thisRoot={buildHttpThis(draft)}
                        addLabel={t('httpClient.addHeader')}
                        emptyTitle={t('httpClient.noHeadersRequestTitle')}
                        emptyDescription={t('httpClient.noHeadersRequestDescription')}
                      />
                    </div>
                  </div>
                ) : null}

                {requestTab === 'body' ? (
                  <div className="flex flex-col gap-4">
                    <SegmentedControl
                      aria-label={t('httpClient.body')}
                      value={draft.body.mode}
                      onValueChange={setBodyMode}
                      options={[
                        {
                          value: 'none',
                          label: t('httpClient.bodyNone'),
                          icon: CircleOff,
                        },
                        {
                          value: 'form-data',
                          label: t('httpClient.bodyFormData'),
                          icon: List,
                        },
                        {
                          value: 'urlencoded',
                          label: t('httpClient.bodyUrlencoded'),
                          icon: Link2,
                        },
                        {
                          value: 'raw',
                          label: t('httpClient.bodyRaw'),
                          icon: Braces,
                        },
                        {
                          value: 'binary',
                          label: t('httpClient.bodyBinary'),
                          icon: Binary,
                        },
                      ]}
                    />

                    {draft.body.mode === 'none' ? (
                      <EmptyPanel
                        icon={Inbox}
                        badgeTone="muted"
                        title={t('httpClient.bodyNoneTitle')}
                        description={t('httpClient.bodyNoneHint')}
                        ghost="none"
                        bordered
                        size="sm"
                      />
                    ) : null}

                    {draft.body.mode === 'urlencoded' ? (
                      <KeyValueEditor
                        pairs={draft.body.urlencoded}
                        onChange={(urlencoded) => setBody({ urlencoded })}
                        thisRoot={buildHttpThis(draft)}
                        addLabel={t('httpClient.addField')}
                        emptyTitle={t('httpClient.noFieldsTitle')}
                        emptyDescription={t('httpClient.noFieldsDescription')}
                      />
                    ) : null}

                    {draft.body.mode === 'form-data' ? (
                      <FormDataEditor
                        fields={formDataFields}
                        onChange={(formData) => {
                          const nextIds = new Set(formData.map((field) => field.id))
                          for (const id of [...fileMapRef.current.keys()]) {
                            if (!nextIds.has(id)) fileMapRef.current.delete(id)
                          }
                          setBody({ formData })
                        }}
                        onFileChosen={(fieldId, file) => {
                          fileMapRef.current.set(fieldId, file)
                        }}
                        thisRoot={buildHttpThis(draft)}
                      />
                    ) : null}

                    {draft.body.mode === 'raw' ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={draft.body.rawLanguage}
                            onValueChange={(value) => setRawLanguage(value as HttpRawLanguage)}
                          >
                            <SelectTrigger className="h-6 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="json">JSON</SelectItem>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="xml">XML</SelectItem>
                              <SelectItem value="html">HTML</SelectItem>
                              <SelectItem value="javascript">JavaScript</SelectItem>
                              <SelectItem value="custom">{t('httpClient.custom')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <SuggestInput
                            className="min-w-45 flex-1"
                            inputClassName="h-6 font-mono text-xs"
                            value={draft.body.rawContentType}
                            onChange={(rawContentType) => {
                              contentTypeTouchedRef.current = true
                              setBody({ rawContentType })
                            }}
                            suggestions={COMMON_CONTENT_TYPES}
                            placeholder="Content-Type"
                            minListWidth={220}
                          />
                        </div>
                        <CodeEditor
                          value={draft.body.raw}
                          onChange={(raw) => setBody({ raw })}
                          language={monacoLanguageForRaw(draft.body.rawLanguage)}
                          height="240px"
                          showLineNumbers
                          toolbar
                          editorPrefs={editorPrefs}
                          onEditorPrefsChange={updateEditorPrefs}
                          path="http-client-request-body://raw"
                          onMount={(editor, monaco) => {
                            applyEnvTemplateDecorations(editor, monaco)
                            const lang = monacoLanguageForRaw(draft.body.rawLanguage)
                            const completion = registerEnvTemplateCompletionProvider(monaco, lang)
                            const sub = editor.onDidChangeModelContent(() => {
                              applyEnvTemplateDecorations(editor, monaco)
                            })
                            editor.onDidDispose(() => {
                              sub.dispose()
                              completion.dispose()
                            })
                          }}
                        />
                      </div>
                    ) : null}

                    {draft.body.mode === 'binary' ? (
                      <HttpFilePicker
                        variant="panel"
                        fileName={draft.body.binaryFileName}
                        contentType={draft.body.binaryContentType}
                        fileSize={binaryFileSize}
                        onPick={(file) => {
                          binaryFileRef.current = file
                          setBinaryFileSize(file.size)
                          setBody({
                            binaryFileName: file.name,
                            binaryContentType: file.type || 'application/octet-stream',
                          })
                        }}
                        onClear={() => {
                          binaryFileRef.current = null
                          setBinaryFileSize(undefined)
                          setBody({
                            binaryFileName: undefined,
                            binaryContentType: undefined,
                            binaryBase64: undefined,
                          })
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}

                {requestTab === 'settings' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {draft.settings.sendCookies ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Cookie className="h-3 w-3" />
                          {t('httpClient.sendCookies')}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                        <Timer className="h-3 w-3" />
                        {draft.settings.timeoutMs ?? '—'} {t('httpClient.timeoutUnit')}
                      </span>
                      {draft.settings.followRedirects ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
                          <RefreshCw className="h-3 w-3" />
                          {t('httpClient.maxRedirects')}: {draft.settings.maxRedirects}
                        </span>
                      ) : null}
                      {isDesktop() && draft.settings.skipSsl ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                          <Shield className="h-3 w-3" />
                          {t('httpClient.skipSsl')}
                        </span>
                      ) : null}
                    </div>

                    <SettingsSection
                      icon={Route}
                      title={t('httpClient.settingsGroupRest')}
                      description={t('httpClient.settingsGroupRestHint')}
                    >
                      <SettingsToggleRow
                        label={t('httpClient.settingsQueryExplain')}
                        hint={t('httpClient.settingsQueryExplainHint')}
                        checked={areQueryExplainParamsEnabled(draft.params)}
                        onCheckedChange={(checked) =>
                          onParamsChange(setQueryExplainParams(draft.params, checked))
                        }
                      />
                    </SettingsSection>

                    <SettingsSection
                      icon={Cookie}
                      title={t('httpClient.settingsGroupSession')}
                      description={t('httpClient.settingsGroupSessionHint')}
                      tone="cyan"
                    >
                      <SettingsToggleRow
                        label={t('httpClient.sendCookies')}
                        hint={t('httpClient.sendCookiesHint')}
                        checked={draft.settings.sendCookies}
                        onCheckedChange={(checked) => setSettings({ sendCookies: checked })}
                      />
                    </SettingsSection>

                    <SettingsSection
                      icon={Timer}
                      title={t('httpClient.settingsGroupTiming')}
                      description={t('httpClient.settingsGroupTimingHint')}
                    >
                      <div className="flex items-center justify-between gap-4 px-3.5 py-3">
                        <div className="min-w-0">
                          <Label htmlFor="http-timeout" className="font-medium text-sm">
                            {t('httpClient.timeout')}
                          </Label>
                          <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                            {t('httpClient.timeoutHint')}
                          </p>
                        </div>
                        <div className="relative shrink-0">
                          <Input
                            id="http-timeout"
                            type="number"
                            min={0}
                            className="h-6 w-30 pr-9 font-mono text-xs tabular-nums"
                            placeholder={t('httpClient.timeoutPlaceholder')}
                            value={draft.settings.timeoutMs ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              setSettings({
                                timeoutMs: raw === '' ? null : Number.parseInt(raw, 10) || null,
                              })
                            }}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] text-muted-foreground uppercase">
                            {t('httpClient.timeoutUnit')}
                          </span>
                        </div>
                      </div>
                    </SettingsSection>

                    <SettingsSection
                      icon={RefreshCw}
                      title={t('httpClient.settingsGroupRedirects')}
                      description={t('httpClient.settingsGroupRedirectsHint')}
                    >
                      <SettingsToggleRow
                        label={t('httpClient.followRedirects')}
                        hint={t('httpClient.followRedirectsHint')}
                        checked={draft.settings.followRedirects}
                        onCheckedChange={(checked) => setSettings({ followRedirects: checked })}
                      />
                      {draft.settings.followRedirects ? (
                        <div className="flex items-center justify-between gap-4 bg-muted/15 px-3.5 py-3">
                          <div className="min-w-0">
                            <Label htmlFor="http-max-redirects" className="font-medium text-sm">
                              {t('httpClient.maxRedirects')}
                            </Label>
                            <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                              {t('httpClient.maxRedirectsHint')}
                            </p>
                          </div>
                          <Input
                            id="http-max-redirects"
                            type="number"
                            min={0}
                            className="h-6 w-30 shrink-0 font-mono text-xs tabular-nums"
                            value={draft.settings.maxRedirects}
                            onChange={(e) =>
                              setSettings({
                                maxRedirects: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </SettingsSection>

                    {isDesktop() ? (
                      <SettingsSection
                        icon={Shield}
                        title={t('httpClient.settingsGroupSecurity')}
                        description={t('httpClient.settingsGroupSecurityHint')}
                        tone="amber"
                      >
                        <SettingsToggleRow
                          label={t('httpClient.skipSsl')}
                          hint={t('httpClient.skipSslHint')}
                          checked={draft.settings.skipSsl}
                          onCheckedChange={(checked) => setSettings({ skipSsl: checked })}
                          danger
                        />
                      </SettingsSection>
                    ) : (
                      <div className="flex gap-3 rounded-md border border-border/70 border-dashed bg-muted/20 px-3.5 py-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {t('httpClient.settingsGroupSecurity')}
                          </p>
                          <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                            {t('httpClient.webLimitation')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        }
        response={
          <>
            <div className="mb-2 shrink-0">
              {mobile ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={t('common.back')}
                    onClick={() => setMobilePane('request')}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-base tracking-tight">
                      {t('httpClient.response')}
                    </h2>
                    {!response ? (
                      <p className="truncate text-muted-foreground text-xs leading-snug">
                        {t('httpClient.responseHint')}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-medium">{t('httpClient.response')}</h2>
                  <p className="text-muted-foreground text-xs">{t('httpClient.responseHint')}</p>
                </>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <HttpResponsePanel response={response} />
            </div>
          </>
        }
      />
      <PostmanExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        items={currentExportItems}
        defaultCollectionName={t('postmanExport.defaultHttpName')}
        signatureLabel={t('favouriteMeta.viewPath')}
        itemsSectionLabel={t('postmanExport.currentRequestSection')}
      />
    </>
  )
}
