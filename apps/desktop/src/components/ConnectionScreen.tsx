import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PasswordInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '@4d/ui'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Brain,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  Dices,
  Filter,
  Globe,
  Key,
  Loader2,
  Plus,
  Save,
  Search,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AppearanceControls } from '~/components/AppearanceControls'
import { DesktopUpdateFooterControl } from '~/components/DesktopUpdateFooterControl'
import { VirtualIconGrid } from '~/components/VirtualIconGrid'
import { useTranslation } from '~/i18n'
import { formatThrownError } from '~/lib/api'
import { normalizeDesktopVersion } from '~/lib/desktop-releases'
import { resolveLucideIcon } from '~/lib/lucide-icon'
import { setSkipSSL as setPlatformSkipSSL } from '~/lib/platform'
import { COLOR_PRESETS, type ColorPreset, ICON_PRESETS } from '~/store/settings'
import {
  type ConnectionConfig,
  getConnections,
  removeConnection,
  saveConnection,
  setActiveConnection,
} from '~desktop/lib/connection-store'
import { desktopFetch } from '~desktop/lib/http'
import { ConnectionCard } from './ConnectionCard'
import { ConnectionHomeUpdateCard } from './ConnectionHomeUpdateCard'

type ConnectionScreenProps = {
  onConnect: (connection: ConnectionConfig) => void
  /** When set, the form opens prefilled with this connection's details for editing */
  initialEdit?: ConnectionConfig | null
}

type HeaderEntry = { id: string; key: string; value: string }

/** Quick-select server URLs offered on the connection form */
const PREDEFINED_URLS = ['http://localhost:7080', 'https://localhost:7443']

/** Recent-connections sidebar resize bounds (px) */
const SIDEBAR_MIN_WIDTH = 240
const SIDEBAR_MAX_WIDTH = 520

export function ConnectionScreen({ onConnect, initialEdit }: ConnectionScreenProps) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [headers, setHeaders] = useState<HeaderEntry[]>([])
  const [cookies, setCookies] = useState<HeaderEntry[]>([])
  const [skipSSL, setSkipSSL] = useState(false)
  const [timeout, setTimeout] = useState('')
  const [color, setColor] = useState<ColorPreset>('default')
  const [icon, setIcon] = useState<string>('Database')
  const [iconSearch, setIconSearch] = useState('')
  const [iconScrollNonce, setIconScrollNonce] = useState(0)
  const deferredIconSearch = useDeferredValue(iconSearch)
  const [readonly, setReadonly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Resizable recent-connections sidebar
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [connectionQuery, setConnectionQuery] = useState('')
  const deferredConnectionQuery = useDeferredValue(connectionQuery)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ConnectionConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load saved connections
  useEffect(() => {
    getConnections()
      .then((conns) => {
        setConnections(conns)
        // Show form if no connections exist
        if (conns.length === 0) setShowForm(true)
      })
      .finally(() => setLoading(false))
  }, [])

  // Sidebar resize: the panel starts at x=0, so clientX is the target width
  useEffect(() => {
    if (!isResizingSidebar) return
    const onMove = (e: MouseEvent) => {
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX)))
    }
    const onUp = () => setIsResizingSidebar(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingSidebar])

  const resetForm = useCallback(() => {
    setName('')
    setBaseUrl('')
    setAccessKey('')
    setUsername('')
    setPassword('')
    setHeaders([])
    setCookies([])
    setSkipSSL(false)
    setTimeout('')
    setColor('default')
    setIcon('Database')
    setReadonly(false)
    setEditingId(null)
    setTestResult(null)
    setError(null)
    setShowAdvanced(false)
  }, [])

  const handleTestConnection = useCallback(async () => {
    const url = baseUrl.trim()
    if (!url) return
    setTesting(true)
    setTestResult(null)
    // Honor the form's skip-SSL toggle for this test request
    setPlatformSkipSSL(skipSSL)
    const timeoutMs = timeout ? Number.parseInt(timeout, 10) : undefined
    const fetchInit = {
      skipSsl: skipSSL,
      connectTimeout:
        typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
          ? timeoutMs
          : undefined,
    }
    try {
      const origin = url.replace(/\/$/, '')
      const requestHeaders: Record<string, string> = {
        ...Object.fromEntries(headers.filter((h) => h.key && h.value).map((h) => [h.key, h.value])),
      }
      const activeCookies = cookies.filter((c) => c.key && c.value)
      if (activeCookies.length > 0) {
        requestHeaders.Cookie = activeCookies.map((c) => `${c.key}=${c.value}`).join('; ')
      }
      if (username && password) {
        requestHeaders.Authorization = `Basic ${btoa(`${username}:${password}`)}`
      }

      // Mirror Connect: access-key auth goes through /api/login first so the
      // session cookie is available for the catalog check (Tauri cookie jar).
      const key = accessKey.trim()
      if (key) {
        const formData = new FormData()
        formData.append('accessKey', key)
        const loginResponse = await desktopFetch(`${origin}/api/login`, {
          method: 'POST',
          body: formData,
          headers: requestHeaders,
          credentials: 'include',
          ...fetchInit,
        })
        const loginData = (await loginResponse.json().catch(() => ({}))) as {
          isLogged?: boolean
          errors?: string[]
          message?: string
        }
        if (!loginResponse.ok) {
          setTestResult({
            ok: false,
            message:
              loginData.errors?.[0] ?? loginData.message ?? `Login failed: ${loginResponse.status}`,
          })
          return
        }
        if (
          loginData.isLogged === false ||
          (Array.isArray(loginData.errors) && loginData.errors.length > 0)
        ) {
          setTestResult({
            ok: false,
            message: loginData.errors?.[0] ?? 'Invalid access key',
          })
          return
        }
      }

      const response = await desktopFetch(`${origin}/rest/$catalog`, {
        method: 'GET',
        headers: requestHeaders,
        credentials: 'include',
        ...fetchInit,
      })
      if (response.ok) {
        setTestResult({ ok: true, message: 'Connection successful' })
      } else if (response.status === 401) {
        setTestResult({
          ok: false,
          message: key ? 'Authenticated but catalog returned 401' : 'Authentication required (401)',
        })
      } else {
        setTestResult({ ok: false, message: `Server returned ${response.status}` })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: formatThrownError(err, 'Connection failed'),
      })
    } finally {
      setTesting(false)
    }
  }, [baseUrl, accessKey, headers, cookies, username, password, skipSSL, timeout])

  const handleConnect = useCallback(
    async (connection: ConnectionConfig) => {
      setSubmitting(true)
      setError(null)
      try {
        await setActiveConnection(connection.id)
        onConnect(connection)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect')
      } finally {
        setSubmitting(false)
      }
    },
    [onConnect]
  )

  const buildConnectionInput = useCallback((): Omit<ConnectionConfig, 'id' | 'lastUsed'> & {
    id?: string
  } => {
    const url = baseUrl.trim()
    const filteredHeaders = headers.filter((h) => h.key && h.value)
    const filteredCookies = cookies.filter((c) => c.key && c.value)
    return {
      id: editingId ?? undefined,
      name: name.trim() || new URL(url).host,
      baseUrl: url.replace(/\/$/, ''),
      accessKey: accessKey.trim() || undefined,
      username: username.trim() || undefined,
      password: password || undefined,
      headers:
        filteredHeaders.length > 0
          ? Object.fromEntries(filteredHeaders.map((h) => [h.key, h.value]))
          : undefined,
      cookies:
        filteredCookies.length > 0
          ? Object.fromEntries(filteredCookies.map((c) => [c.key, c.value]))
          : undefined,
      skipSSL: skipSSL || undefined,
      timeout: timeout ? Number.parseInt(timeout, 10) : undefined,
      color: color !== 'default' ? color : undefined,
      icon: icon !== 'Database' ? icon : undefined,
      readonly: readonly || undefined,
    }
  }, [
    baseUrl,
    name,
    accessKey,
    username,
    password,
    headers,
    cookies,
    skipSSL,
    timeout,
    color,
    icon,
    readonly,
    editingId,
  ])

  const persistConnection = useCallback(
    (): Promise<ConnectionConfig> => saveConnection(buildConnectionInput()),
    [buildConnectionInput]
  )

  // Cancel the form and return to the home / connections view
  const handleCancel = useCallback(() => {
    resetForm()
    setShowForm(false)
  }, [resetForm])

  // Save only (do not connect)
  const handleSave = useCallback(async () => {
    if (!baseUrl.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await persistConnection()
      const conns = await getConnections()
      setConnections(conns)
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connection')
    } finally {
      setSubmitting(false)
    }
  }, [baseUrl, persistConnection, resetForm])

  // Quick connect: connect without persisting the connection
  const handleQuickConnect = useCallback(() => {
    if (!baseUrl.trim()) return
    setError(null)
    try {
      const input = buildConnectionInput()
      const ephemeral: ConnectionConfig = {
        ...input,
        id: input.id ?? `ephemeral_${Date.now()}`,
        lastUsed: Date.now(),
      }
      onConnect(ephemeral)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }, [baseUrl, buildConnectionInput, onConnect])

  // Save and connect
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!baseUrl.trim()) return
      setSubmitting(true)
      setError(null)
      try {
        const connection = await persistConnection()
        await setActiveConnection(connection.id)
        onConnect(connection)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save connection')
      } finally {
        setSubmitting(false)
      }
    },
    [baseUrl, persistConnection, onConnect]
  )

  const handleRequestDelete = useCallback(
    (id: string) => {
      const target = connections.find((c) => c.id === id)
      if (target) setDeleteTarget(target)
    },
    [connections]
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await removeConnection(deleteTarget.id)
      setConnections((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget])

  const nextDuplicateName = useCallback(
    (source: ConnectionConfig, existing: ConnectionConfig[]) => {
      const base = (source.name || source.baseUrl || 'Connection').trim()
      const names = new Set(existing.map((c) => c.name.trim()).filter(Boolean))
      const first = `${base} (copy)`
      if (!names.has(first)) return first
      let n = 2
      while (names.has(`${base} (copy ${n})`)) n += 1
      return `${base} (copy ${n})`
    },
    []
  )

  const handleEdit = useCallback(
    (connection: ConnectionConfig, options?: { expandAdvanced?: boolean }) => {
      resetForm()
      setEditingId(connection.id)
      setName(connection.name ?? '')
      setBaseUrl(connection.baseUrl ?? '')
      setAccessKey(connection.accessKey ?? '')
      setUsername(connection.username ?? '')
      setPassword(connection.password ?? '')
      setHeaders(
        connection.headers
          ? Object.entries(connection.headers).map(([key, value]) => ({
              id: crypto.randomUUID(),
              key,
              value,
            }))
          : []
      )
      setCookies(
        connection.cookies
          ? Object.entries(connection.cookies).map(([key, value]) => ({
              id: crypto.randomUUID(),
              key,
              value,
            }))
          : []
      )
      setSkipSSL(connection.skipSSL ?? false)
      setTimeout(connection.timeout ? String(connection.timeout) : '')
      setColor((connection.color as ColorPreset) ?? 'default')
      setIcon(connection.icon ?? 'Database')
      setReadonly(connection.readonly ?? false)
      const expandAdvanced = options?.expandAdvanced ?? true
      if (
        expandAdvanced &&
        (connection.headers || connection.cookies || connection.username || connection.skipSSL)
      ) {
        setShowAdvanced(true)
      }
      setShowForm(true)
    },
    [resetForm]
  )

  const handleDuplicate = useCallback(
    async (connection: ConnectionConfig) => {
      setError(null)
      try {
        const { id: _id, lastUsed: _lastUsed, ...rest } = connection
        const duplicate = await saveConnection({
          ...rest,
          name: nextDuplicateName(connection, connections),
          // Fresh session for the copy — don't reuse stored cookies.
          cookies: undefined,
        })
        const conns = await getConnections()
        setConnections(conns)
        handleEdit(duplicate, { expandAdvanced: false })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to duplicate connection')
      }
    },
    [connections, handleEdit, nextDuplicateName]
  )

  // When arriving with a connection to edit (e.g. "Back to connection"),
  // open the form prefilled with its details but keep Advanced collapsed.
  useEffect(() => {
    if (initialEdit) {
      handleEdit(initialEdit, { expandAdvanced: false })
    }
  }, [initialEdit, handleEdit])

  const randomizeAppearance = useCallback(() => {
    const colorPool = (Object.keys(COLOR_PRESETS) as ColorPreset[]).filter((c) => c !== 'default')
    setIcon(ICON_PRESETS[Math.floor(Math.random() * ICON_PRESETS.length)])
    setColor(colorPool[Math.floor(Math.random() * colorPool.length)])
    setIconScrollNonce((n) => n + 1)
  }, [])

  const filteredIcons = useMemo(() => {
    if (!deferredIconSearch.trim()) return ICON_PRESETS
    const query = deferredIconSearch.toLowerCase()
    return ICON_PRESETS.filter((name) => name.toLowerCase().includes(query))
  }, [deferredIconSearch])

  const filteredConnections = useMemo(() => {
    const q = deferredConnectionQuery.trim().toLowerCase()
    if (!q) return connections
    return connections.filter((c) => {
      const hay = `${c.name} ${c.baseUrl}`.toLowerCase()
      return hay.includes(q)
    })
  }, [connections, deferredConnectionQuery])

  const sidebarStats = useMemo(() => {
    let withKey = 0
    let skipSsl = 0
    let readonly = 0
    for (const c of connections) {
      if (c.accessKey) withKey += 1
      if (c.skipSSL) skipSsl += 1
      if (c.readonly) readonly += 1
    }
    return { withKey, skipSsl, readonly }
  }, [connections])

  const startNewConnection = useCallback(() => {
    resetForm()
    randomizeAppearance()
    setShowForm(true)
  }, [resetForm, randomizeAppearance])

  const startNewConnectionWithUrl = useCallback(
    (url: string) => {
      resetForm()
      randomizeAppearance()
      setBaseUrl(url)
      setShowForm(true)
    },
    [resetForm, randomizeAppearance]
  )

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])
  }, [])

  const removeHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateHeader = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: val } : h)))
  }, [])

  const addCookie = useCallback(() => {
    setCookies((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])
  }, [])

  const removeCookie = useCallback((index: number) => {
    setCookies((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateCookie = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setCookies((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: val } : c)))
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center border-t bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col border-t bg-background">
      <div className="flex min-h-0 flex-1">
        {/* Left panel: Recent connections */}
        <div
          className="relative flex shrink-0 flex-col border-r bg-muted/30"
          style={{ width: sidebarWidth }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute -top-16 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.2]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                maskImage: 'linear-gradient(to bottom, black 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between border-border/70 border-b bg-background/50 px-3 py-2 backdrop-blur-sm">
            <div className="min-w-0">
              <h2 className="font-semibold text-xs tracking-tight">
                {t('connectionScreen.sidebarTitle')}
              </h2>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {connections.length === 0
                  ? t('connectionScreen.sidebarEmptySubtitle')
                  : connections.length === 1
                    ? t('connectionScreen.welcomeDescriptionOne')
                    : t('connectionScreen.welcomeDescription', { count: connections.length })}
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="h-6 w-6 shrink-0 p-0 shadow-xs"
              onClick={startNewConnection}
              title={t('connectionScreen.newConnection')}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {connections.length > 0 ? (
            <div className="relative z-10 border-border/60 border-b px-3 py-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={connectionQuery}
                  onChange={(e) => setConnectionQuery(e.target.value)}
                  placeholder={t('connectionScreen.sidebarSearch')}
                  className="h-6 bg-background/70 pl-8 text-xs"
                  aria-label={t('connectionScreen.sidebarSearch')}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-1 rounded-sm border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  <Key className="size-2.5" />
                  {t('connectionScreen.sidebarStatKeys', { count: sidebarStats.withKey })}
                </span>
                {sidebarStats.skipSsl > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="size-2.5" />
                    {t('connectionScreen.sidebarStatSkipSsl', { count: sidebarStats.skipSsl })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-success/25 bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                    <ShieldCheck className="size-2.5" />
                    {t('connectionScreen.sidebarStatTrusted')}
                  </span>
                )}
                {sidebarStats.readonly > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t('connectionScreen.sidebarStatReadonly', { count: sidebarStats.readonly })}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <div className="space-y-1.5">
                {connections.length === 0 && (
                  <div className="flex flex-col items-center px-2 py-4 text-center">
                    <div className="relative mb-3 h-12 w-12">
                      <div className="absolute inset-0 rounded-md border border-dashed" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ServerCog className="h-6 w-6 text-muted-foreground/70" />
                      </div>
                      <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                        <Plus className="h-3 w-3" />
                      </span>
                    </div>
                    <p className="font-medium text-sm">{t('connectionScreen.sidebarEmptyTitle')}</p>
                    <p className="mt-1 text-balance text-muted-foreground text-xs">
                      {t('connectionScreen.sidebarEmptyBody')}
                    </p>
                    <button
                      type="button"
                      onClick={startNewConnection}
                      className="mt-3 flex h-6 w-full items-center justify-center gap-2 rounded-sm border border-dashed px-3 text-muted-foreground text-xs transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('connectionScreen.newConnection')}
                    </button>
                  </div>
                )}

                {connections.length > 0 && filteredConnections.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-4 text-center">
                    <p className="font-medium text-xs">{t('connectionScreen.sidebarNoMatch')}</p>
                    <button
                      type="button"
                      className="mt-2 text-[11px] text-primary underline-offset-2 hover:underline"
                      onClick={() => setConnectionQuery('')}
                    >
                      {t('connectionScreen.sidebarClearSearch')}
                    </button>
                  </div>
                ) : null}

                {filteredConnections.map((conn, index) => (
                  <ConnectionCard
                    key={conn.id}
                    connection={conn}
                    featured={index === 0 && !deferredConnectionQuery.trim()}
                    onConnect={handleConnect}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleRequestDelete}
                  />
                ))}
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-border/70 border-t bg-background/40 p-2.5 backdrop-blur-sm">
              <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                {t('connectionScreen.sidebarQuickHeading')}
              </p>
              <div className="space-y-1">
                {PREDEFINED_URLS.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => startNewConnectionWithUrl(url)}
                    className="group flex h-6 w-full items-center gap-2 rounded-sm border border-border/70 bg-card/60 px-2 text-left transition-colors hover:border-primary/45 hover:bg-accent"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Globe className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground group-hover:text-foreground">
                      {url}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-2 rounded-sm border border-border/60 bg-muted/30 px-2 py-1.5">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {t('connectionScreen.sidebarTip')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <button
          type="button"
          aria-label="Resize connections panel"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizingSidebar(true)
          }}
          className={cn(
            'group relative w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40',
            isResizingSidebar && 'bg-primary/60'
          )}
        >
          <span className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2" />
        </button>

        {/* Right panel: Connection form / home */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* Atmospheric background — grid + brand glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0 bg-muted/15" />
            <div
              className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                maskImage:
                  'radial-gradient(ellipse 75% 65% at 50% 40%, black 20%, transparent 75%)',
              }}
            />
            <div
              className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
              style={{ animation: 'connection-home-glow 8s ease-in-out infinite alternate' }}
            />
            <div className="absolute right-[12%] bottom-[18%] h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex min-h-0 w-full justify-center overflow-y-auto p-3 sm:px-4">
            <div className="my-auto flex w-full max-w-4xl flex-col gap-3">
              <header
                className={cn(
                  'flex flex-col gap-2',
                  showForm
                    ? 'items-start sm:flex-row sm:items-center sm:justify-between'
                    : 'items-start sm:flex-row sm:items-end sm:justify-between'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary shadow-primary/25 shadow-sm sm:h-11 sm:w-11">
                      <Database className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </span>
                  </div>
                  <div>
                    <h1 className="font-bold text-lg tracking-tight sm:text-xl">Data Explorer</h1>
                    <p className="text-muted-foreground text-xs">
                      {showForm
                        ? editingId
                          ? t('connectionScreen.formEditSubtitle')
                          : t('connectionScreen.formNewSubtitle')
                        : t('connectionScreen.tagline')}
                    </p>
                  </div>
                </div>
                {!showForm ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-sm border border-border/70 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums backdrop-blur-sm">
                      v{normalizeDesktopVersion(__APP_VERSION__)}
                    </span>
                    <span className="rounded-sm border border-primary/25 bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
                      {t('connectionScreen.desktopBadge')}
                    </span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 text-xs"
                    onClick={handleCancel}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('connectionScreen.formCancel')}
                  </Button>
                )}
              </header>

              {!showForm ? (
                <ConnectionHomeUpdateCard variant="promo" />
              ) : (
                <ConnectionHomeUpdateCard variant="inline" />
              )}

              {showForm ? (
                <form
                  onSubmit={handleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      handleCancel()
                    }
                  }}
                  className="overflow-hidden rounded-md border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-border/60 border-b bg-primary/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-xs tracking-tight">
                        {editingId
                          ? t('connectionScreen.formEditTitle')
                          : t('connectionScreen.formNewTitle')}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {t('connectionScreen.formLead')}
                      </p>
                    </div>
                    <span className="hidden rounded-sm border border-border/70 bg-background/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                      {baseUrl.trim() || t('connectionScreen.formUrlPending')}
                    </span>
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.9fr)]">
                    {/* Primary column */}
                    <div className="space-y-2.5 border-border/60 p-3 lg:border-r">
                      <div className="space-y-1.5">
                        <Label htmlFor="baseUrl">{t('connectionScreen.formUrlLabel')}</Label>
                        <div className="relative">
                          <Globe className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="baseUrl"
                            type="url"
                            placeholder="http://localhost:8044"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className="h-6 pl-8 text-xs"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {PREDEFINED_URLS.map((url) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => setBaseUrl(url)}
                              className={cn(
                                'rounded-sm border px-2 py-0.5 font-mono text-[11px] transition-colors hover:bg-accent',
                                baseUrl === url
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground'
                              )}
                            >
                              {url}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="connName">{t('connectionScreen.formNameLabel')}</Label>
                          <Input
                            id="connName"
                            type="text"
                            placeholder="My Server"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-6 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="accessKey">
                            {t('connectionScreen.formAccessKeyLabel')}
                          </Label>
                          <div className="relative">
                            <Key className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <PasswordInput
                              id="accessKey"
                              autoComplete="off"
                              placeholder={t('connectionScreen.formAccessKeyPlaceholder')}
                              value={accessKey}
                              onChange={(e) => setAccessKey(e.target.value)}
                              className="h-6 pl-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/40 px-2.5 py-2">
                        <div className="min-w-0 space-y-0.5">
                          <Label htmlFor="readonly" className="cursor-pointer">
                            {t('connectionScreen.formReadonlyLabel')}
                          </Label>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {t('connectionScreen.formReadonlyHint')}
                          </p>
                        </div>
                        <Switch
                          id="readonly"
                          checked={readonly}
                          onCheckedChange={setReadonly}
                          className="shrink-0"
                        />
                      </div>
                    </div>

                    {/* Identity / appearance column */}
                    <div className="space-y-2.5 bg-muted/15 p-3">
                      <div className="overflow-hidden rounded-md border border-border/70 bg-background/60">
                        <div className="border-border/60 border-b px-2.5 py-1.5">
                          <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                            {t('connectionScreen.formIdentityPreview')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 px-2.5 py-2">
                          <span
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md shadow-xs',
                              COLOR_PRESETS[color].bg
                            )}
                          >
                            {(() => {
                              const SelectedIcon = resolveLucideIcon(icon) ?? Database
                              return <SelectedIcon className="h-5 w-5 text-white" />
                            })()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-sm">
                              {name.trim() ||
                                (baseUrl.trim()
                                  ? (() => {
                                      try {
                                        return new URL(baseUrl).host
                                      } catch {
                                        return baseUrl
                                      }
                                    })()
                                  : t('connectionScreen.formPreviewUntitled'))}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {baseUrl.trim() || t('connectionScreen.formUrlPending')}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {accessKey ? (
                                <span className="rounded bg-muted px-1.5 py-px text-[9px] text-muted-foreground uppercase">
                                  {t('connectionScreen.formBadgeKey')}
                                </span>
                              ) : null}
                              {readonly ? (
                                <span className="rounded bg-amber-500/15 px-1.5 py-px text-[9px] text-amber-700 uppercase dark:text-amber-300">
                                  {t('connectionScreen.formBadgeReadonly')}
                                </span>
                              ) : null}
                              {skipSSL ? (
                                <span className="rounded bg-amber-500/15 px-1.5 py-px text-[9px] text-amber-700 uppercase dark:text-amber-300">
                                  {t('connectionScreen.formBadgeSkipSsl')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>{t('connectionScreen.formAppearanceLabel')}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 px-2 text-muted-foreground text-xs hover:text-foreground"
                            onClick={randomizeAppearance}
                          >
                            <Dices className="h-3.5 w-3.5" />
                            {t('connectionScreen.formRandomize')}
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-13.5 w-13.5 shrink-0"
                                aria-label={t('connectionScreen.formChooseIcon')}
                              >
                                <span
                                  className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-sm',
                                    COLOR_PRESETS[color].bg
                                  )}
                                >
                                  {(() => {
                                    const SelectedIcon = resolveLucideIcon(icon) ?? Database
                                    return <SelectedIcon className="h-5 w-5 text-white" />
                                  })()}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-64 p-2"
                              onCloseAutoFocus={() => setIconSearch('')}
                            >
                              <div className="relative mb-2">
                                <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  placeholder={t('connectionScreen.formSearchIcons')}
                                  value={iconSearch}
                                  onChange={(e) => setIconSearch(e.target.value)}
                                  className="h-6 pl-7 text-xs"
                                />
                              </div>
                              <VirtualIconGrid
                                icons={filteredIcons}
                                value={icon}
                                onSelect={setIcon}
                                height={176}
                                scrollNonce={iconScrollNonce}
                              />
                              <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
                                {filteredIcons.length} icons
                              </p>
                            </PopoverContent>
                          </Popover>

                          <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setColor(key)}
                                aria-label={COLOR_PRESETS[key].name}
                                title={COLOR_PRESETS[key].name}
                                className={cn(
                                  'h-6 w-6 rounded-full border transition-transform hover:scale-110',
                                  COLOR_PRESETS[key].bg,
                                  color === key &&
                                    'ring-2 ring-ring ring-offset-2 ring-offset-background'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="flex h-6 w-full items-center gap-2 rounded-sm border border-border/70 bg-background/50 px-2.5 text-left text-xs transition-colors hover:bg-accent"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                      >
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 font-medium">
                          {t('connectionScreen.formAdvanced')}
                        </span>
                        {showAdvanced ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showAdvanced ? (
                    <div className="space-y-2.5 border-border/60 border-t bg-muted/20 p-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>{t('connectionScreen.formBasicAuth')}</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="text"
                              placeholder={t('connectionScreen.formUsername')}
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="h-6 text-xs"
                            />
                            <PasswordInput
                              autoComplete="off"
                              placeholder={t('connectionScreen.formPassword')}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="h-6 text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="timeout">{t('connectionScreen.formTimeout')}</Label>
                          <Input
                            id="timeout"
                            type="number"
                            placeholder="30000"
                            value={timeout}
                            onChange={(e) => setTimeout(e.target.value)}
                            min="1000"
                            step="1000"
                            className="h-6 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>{t('connectionScreen.formHeaders')}</Label>
                              <p className="text-[11px] text-muted-foreground">
                                {t('connectionScreen.formHeadersHint')}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={addHeader}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {t('connectionScreen.formAdd')}
                            </Button>
                          </div>
                          {headers.map((header, index) => (
                            <div key={header.id} className="flex items-center gap-2">
                              <Input
                                type="text"
                                placeholder={t('connectionScreen.formHeaderName')}
                                value={header.key}
                                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                                className="h-6 flex-1 text-xs"
                              />
                              <Input
                                type="text"
                                placeholder={t('connectionScreen.formHeaderValue')}
                                value={header.value}
                                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                                className="h-6 flex-1 text-xs"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 shrink-0 p-0"
                                onClick={() => removeHeader(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>{t('connectionScreen.formCookies')}</Label>
                              <p className="text-[11px] text-muted-foreground">
                                {t('connectionScreen.formCookiesHint')}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={addCookie}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {t('connectionScreen.formAdd')}
                            </Button>
                          </div>
                          {cookies.map((cookie, index) => (
                            <div key={cookie.id} className="flex items-center gap-2">
                              <Input
                                type="text"
                                placeholder={t('connectionScreen.formCookieName')}
                                value={cookie.key}
                                onChange={(e) => updateCookie(index, 'key', e.target.value)}
                                className="h-6 flex-1 text-xs"
                              />
                              <Input
                                type="text"
                                placeholder={t('connectionScreen.formCookieValue')}
                                value={cookie.value}
                                onChange={(e) => updateCookie(index, 'value', e.target.value)}
                                className="h-6 flex-1 text-xs"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 shrink-0 p-0"
                                onClick={() => removeCookie(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div
                        className={cn(
                          'rounded-md border px-2.5 py-2 transition-colors',
                          skipSSL
                            ? 'border-amber-500/35 bg-amber-500/6'
                            : 'border-border/80 bg-background/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <Label htmlFor="skipSSL" className="cursor-pointer">
                              {t('connectionScreen.formSkipSsl')}
                            </Label>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {t('connectionScreen.formSkipSslHint')}
                            </p>
                          </div>
                          <Switch
                            id="skipSSL"
                            checked={skipSSL}
                            onCheckedChange={setSkipSSL}
                            className="shrink-0"
                          />
                        </div>
                        {skipSSL ? (
                          <p className="mt-2 flex items-start gap-2 border-amber-500/20 border-t pt-2 text-amber-800 text-xs leading-relaxed dark:text-amber-200/90">
                            <ShieldAlert
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300"
                              aria-hidden="true"
                            />
                            <span>{t('connectionScreen.formSkipSslWarning')}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {testResult ? (
                    <div
                      className={cn(
                        'border-t px-3 py-2 text-xs',
                        testResult.ok
                          ? 'border-success/25 bg-success/10 text-success'
                          : 'border-destructive/30 bg-destructive/10 text-destructive'
                      )}
                    >
                      {testResult.message}
                    </div>
                  ) : null}

                  {error ? (
                    <p
                      className="border-destructive/30 border-t bg-destructive/10 px-3 py-2 text-destructive text-xs"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-2 border-border/60 border-t bg-background/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleTestConnection}
                        disabled={!baseUrl.trim() || testing}
                      >
                        {testing ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wifi className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {t('connectionScreen.formTest')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleSave}
                        disabled={!baseUrl.trim() || submitting}
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {t('connectionScreen.formSave')}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleQuickConnect}
                        disabled={!baseUrl.trim() || submitting}
                      >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        {t('connectionScreen.formQuickConnect')}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="h-6 min-w-32 text-xs"
                        disabled={!baseUrl.trim() || submitting}
                      >
                        {submitting ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Globe className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {t('connectionScreen.formConnectSave')}
                      </Button>
                    </div>
                  </div>
                </form>
              ) : connections.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const recent = [...connections].sort((a, b) => b.lastUsed - a.lastUsed)
                    const featured = recent[0]
                    const rest = recent.slice(1, 4)
                    const featuredColor =
                      featured.color && featured.color in COLOR_PRESETS
                        ? COLOR_PRESETS[featured.color as ColorPreset]
                        : COLOR_PRESETS.default
                    const FeaturedIcon = resolveLucideIcon(featured.icon ?? 'Database') ?? Database

                    return (
                      <>
                        <section className="overflow-hidden rounded-md border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
                          <div className="border-border/60 border-b bg-primary/5 px-3 py-2">
                            <p className="font-semibold text-base tracking-tight">
                              {t('connectionScreen.welcomeTitle')}
                            </p>
                            <p className="mt-0.5 text-muted-foreground text-xs">
                              {connections.length === 1
                                ? t('connectionScreen.welcomeDescriptionOne')
                                : t('connectionScreen.welcomeDescription', {
                                    count: connections.length,
                                  })}
                            </p>
                          </div>

                          <div className="space-y-2.5 p-3">
                            <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                              {t('connectionScreen.continueHeading')}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleConnect(featured)}
                              disabled={submitting}
                              className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
                            >
                              <span
                                className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-xs',
                                  featuredColor.bg
                                )}
                              >
                                <FeaturedIcon className="h-5 w-5 text-white" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-xs">
                                  {featured.name || featured.baseUrl}
                                </span>
                                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                                  {featured.baseUrl}
                                </span>
                                <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary">
                                  {t('connectionScreen.openFeatured')}
                                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                </span>
                              </span>
                            </button>

                            {rest.length > 0 ? (
                              <div className="space-y-1.5">
                                <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                                  {t('connectionScreen.recentHeading')}
                                </p>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {rest.map((conn) => {
                                    const colorPreset =
                                      conn.color && conn.color in COLOR_PRESETS
                                        ? COLOR_PRESETS[conn.color as ColorPreset]
                                        : COLOR_PRESETS.default
                                    const Icon =
                                      resolveLucideIcon(conn.icon ?? 'Database') ?? Database
                                    return (
                                      <button
                                        key={conn.id}
                                        type="button"
                                        onClick={() => handleConnect(conn)}
                                        disabled={submitting}
                                        className="group flex items-center gap-2 rounded-md border border-border bg-background/50 px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                                      >
                                        <span
                                          className={cn(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm',
                                            colorPreset.bg
                                          )}
                                        >
                                          <Icon className="h-3.5 w-3.5 text-white" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate font-medium text-xs">
                                            {conn.name || conn.baseUrl}
                                          </span>
                                          <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                            {conn.baseUrl}
                                          </span>
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}

                            <Button
                              size="sm"
                              className="h-6 w-full text-xs"
                              onClick={startNewConnection}
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              {t('connectionScreen.newConnection')}
                            </Button>
                          </div>
                        </section>

                        <section className="grid gap-2 sm:grid-cols-3">
                          {(
                            [
                              {
                                icon: Boxes,
                                title: t('connectionScreen.capabilityBrowseTitle'),
                                body: t('connectionScreen.capabilityBrowseBody'),
                              },
                              {
                                icon: Filter,
                                title: t('connectionScreen.capabilityQueryTitle'),
                                body: t('connectionScreen.capabilityQueryBody'),
                              },
                              {
                                icon: Brain,
                                title: t('connectionScreen.capabilityAiTitle'),
                                body: t('connectionScreen.capabilityAiBody'),
                              },
                            ] as const
                          ).map((item) => (
                            <div
                              key={item.title}
                              className="rounded-md border border-border/70 bg-card/60 px-3 py-2.5 backdrop-blur-sm"
                            >
                              <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary">
                                <item.icon className="h-3.5 w-3.5" />
                              </span>
                              <p className="font-medium text-xs tracking-tight">{item.title}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                                {item.body}
                              </p>
                            </div>
                          ))}
                        </section>
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
                        <Database className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="flex items-center gap-1" aria-hidden>
                        <span className="h-1.5 w-1.5 rounded-full bg-border" />
                        <span className="h-1.5 w-1.5 rounded-full bg-border" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
                        <ServerCog className="h-4 w-4 text-primary" />
                      </div>
                    </div>

                    <p className="text-center font-semibold text-sm">
                      {t('connectionScreen.emptyTitle')}
                    </p>
                    <p className="mx-auto mt-1 mb-3 max-w-sm text-center text-muted-foreground text-xs">
                      {t('connectionScreen.emptyDescription')}
                    </p>

                    <Button size="sm" className="h-6 w-full text-xs" onClick={startNewConnection}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {t('connectionScreen.newConnection')}
                    </Button>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-muted-foreground text-xs">
                          {t('connectionScreen.orQuickConnect')}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <div className="space-y-1">
                        {PREDEFINED_URLS.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => startNewConnectionWithUrl(url)}
                            className="group flex h-6 w-full items-center gap-2 rounded-sm border border-border bg-background/50 px-2.5 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                              <Globe className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <section className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          icon: Boxes,
                          title: t('connectionScreen.capabilityBrowseTitle'),
                          body: t('connectionScreen.capabilityBrowseBody'),
                        },
                        {
                          icon: Filter,
                          title: t('connectionScreen.capabilityQueryTitle'),
                          body: t('connectionScreen.capabilityQueryBody'),
                        },
                        {
                          icon: Brain,
                          title: t('connectionScreen.capabilityAiTitle'),
                          body: t('connectionScreen.capabilityAiBody'),
                        },
                      ] as const
                    ).map((item) => (
                      <div
                        key={item.title}
                        className="rounded-md border border-border/70 bg-card/60 px-3 py-2.5 backdrop-blur-sm"
                      >
                        <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary">
                          <item.icon className="h-3.5 w-3.5" />
                        </span>
                        <p className="font-medium text-xs tracking-tight">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </section>
                </div>
              )}

              {/* Resource links */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-muted-foreground text-xs">
                <a
                  href="https://midrissi.github.io/4d-dataexplorer/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  {t('connectionScreen.linkDocs')}
                </a>
                <span className="h-3 w-px bg-border" />
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {t('connectionScreen.featureSecure')}
                </span>
                <span className="h-3 w-px bg-border" />
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  {t('connectionScreen.featureFast')}
                </span>
                <span className="h-3 w-px bg-border" />
                <a
                  href="https://developer.4d.com/docs/REST/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <ServerCog className="h-3.5 w-3.5 text-primary" />
                  {t('connectionScreen.featureRest')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: app updates + appearance controls */}
      <footer className="flex h-8 w-full shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-2">
        <DesktopUpdateFooterControl />
        <AppearanceControls side="top" align="end" />
      </footer>

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove connection?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name || deleteTarget.baseUrl}” will be removed from your saved connections. This can’t be undone.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
