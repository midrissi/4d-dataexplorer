import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { formatThrownError } from '~/lib/api'
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
import { MobileConnectionForm } from './MobileConnectionForm'
import { MobileConnectionHome } from './MobileConnectionHome'
import type { KeyValueEntry } from './MobileKeyValueEntries'

type MobileConnectionScreenProps = {
  onConnect: (connection: ConnectionConfig) => void
  initialEdit?: ConnectionConfig | null
}

function newHeaderEntry(key = '', value = ''): KeyValueEntry {
  return { id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, key, value }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function isColorPreset(value: string | undefined): value is ColorPreset {
  return Boolean(value && value in COLOR_PRESETS)
}

export function MobileConnectionScreen({ onConnect, initialEdit }: MobileConnectionScreenProps) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const testAbortRef = useRef<AbortController | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [headers, setHeaders] = useState<KeyValueEntry[]>([])
  const [cookies, setCookies] = useState<KeyValueEntry[]>([])
  const [icon, setIcon] = useState('Database')
  const [color, setColor] = useState<ColorPreset>('default')
  const [iconScrollNonce, setIconScrollNonce] = useState(0)
  const [skipSSL, setSkipSSL] = useState(false)
  const [timeout, setTimeoutMs] = useState('')
  const [readonly, setReadonly] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const abortActiveTest = useCallback(() => {
    testAbortRef.current?.abort()
    testAbortRef.current = null
  }, [])

  const randomizeAppearance = useCallback(() => {
    const colorPool = (Object.keys(COLOR_PRESETS) as ColorPreset[]).filter((c) => c !== 'default')
    setIcon(ICON_PRESETS[Math.floor(Math.random() * ICON_PRESETS.length)])
    setColor(colorPool[Math.floor(Math.random() * colorPool.length)])
    setIconScrollNonce((n) => n + 1)
  }, [])

  const refresh = useCallback(async () => {
    const list = await getConnections()
    setConnections(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => () => abortActiveTest(), [abortActiveTest])

  const fillForm = useCallback(
    (connection: ConnectionConfig) => {
      abortActiveTest()
      setEditingId(connection.id)
      setName(connection.name)
      setBaseUrl(connection.baseUrl)
      setAccessKey(connection.accessKey ?? '')
      setUsername(connection.username ?? '')
      setPassword(connection.password ?? '')
      const nextHeaders = connection.headers
        ? Object.entries(connection.headers).map(([key, value]) => newHeaderEntry(key, value))
        : []
      const nextCookies = connection.cookies
        ? Object.entries(connection.cookies).map(([key, value]) => newHeaderEntry(key, value))
        : []
      setHeaders(nextHeaders)
      setCookies(nextCookies)
      setIcon(connection.icon ?? 'Database')
      setColor(isColorPreset(connection.color) ? connection.color : 'default')
      setIconScrollNonce((n) => n + 1)
      setSkipSSL(Boolean(connection.skipSSL))
      setTimeoutMs(connection.timeout ? String(connection.timeout) : '')
      setReadonly(Boolean(connection.readonly))
      setShowAdvanced(nextHeaders.length > 0 || nextCookies.length > 0)
      setTestResult(null)
      setError(null)
      setSubmitting(false)
      setTesting(false)
      setShowForm(true)
    },
    [abortActiveTest]
  )

  useEffect(() => {
    if (initialEdit) fillForm(initialEdit)
  }, [initialEdit, fillForm])

  const resetForm = useCallback(() => {
    setEditingId(null)
    setName('')
    setBaseUrl('')
    setAccessKey('')
    setUsername('')
    setPassword('')
    setHeaders([])
    setCookies([])
    setIcon('Database')
    setColor('default')
    setIconScrollNonce(0)
    setSkipSSL(false)
    setTimeoutMs('')
    setReadonly(false)
    setShowAdvanced(false)
    setTestResult(null)
    setError(null)
  }, [])

  const openNewForm = useCallback(() => {
    abortActiveTest()
    resetForm()
    randomizeAppearance()
    setSubmitting(false)
    setTesting(false)
    setShowForm(true)
  }, [abortActiveTest, randomizeAppearance, resetForm])

  const updateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setHeaders((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    )
  }, [])

  const updateCookie = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setCookies((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    )
  }, [])

  const handleCancelTest = useCallback(() => {
    abortActiveTest()
    setTesting(false)
  }, [abortActiveTest])

  const handleTestConnection = useCallback(async () => {
    const url = baseUrl.trim()
    if (!url) return

    abortActiveTest()
    const controller = new AbortController()
    testAbortRef.current = controller

    setTesting(true)
    setTestResult(null)
    setPlatformSkipSSL(skipSSL)
    const timeoutMs = timeout ? Number.parseInt(timeout, 10) : undefined
    const fetchInit = {
      skipSsl: skipSSL,
      signal: controller.signal,
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
        if (controller.signal.aborted) return
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
      if (controller.signal.aborted) return
      if (response.ok) {
        setTestResult({ ok: true, message: t('mobile.testSuccess') })
      } else if (response.status === 401) {
        setTestResult({
          ok: false,
          message: key ? t('mobile.testAuthCatalog401') : t('mobile.testAuthRequired'),
        })
      } else {
        setTestResult({
          ok: false,
          message: t('mobile.testServerStatus', { status: response.status }),
        })
      }
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) return
      setTestResult({
        ok: false,
        message: formatThrownError(err, t('mobile.testFailed')),
      })
    } finally {
      if (testAbortRef.current === controller) {
        testAbortRef.current = null
      }
      if (!controller.signal.aborted) {
        setTesting(false)
      }
    }
  }, [
    abortActiveTest,
    baseUrl,
    accessKey,
    headers,
    cookies,
    username,
    password,
    skipSSL,
    timeout,
    t,
  ])

  const buildConnectionInput = useCallback((): Omit<ConnectionConfig, 'id' | 'lastUsed'> & {
    id?: string
  } => {
    const url = baseUrl.trim()
    const filteredHeaders = headers.filter((h) => h.key && h.value)
    const filteredCookies = cookies.filter((c) => c.key && c.value)
    let host = url
    try {
      host = new URL(url).host
    } catch {
      // keep raw
    }
    return {
      id: editingId ?? undefined,
      name: name.trim() || host,
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
      readonly: readonly || undefined,
      color: color !== 'default' ? color : undefined,
      icon: icon !== 'Database' ? icon : undefined,
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
    readonly,
    editingId,
    color,
    icon,
  ])

  const handleConnectSaved = useCallback(
    async (connection: ConnectionConfig) => {
      setSubmitting(true)
      setError(null)
      try {
        await setActiveConnection(connection.id)
        onConnect(connection)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('mobile.connectFailed'))
      } finally {
        setSubmitting(false)
      }
    },
    [onConnect, t]
  )

  const handleSaveAndConnect = useCallback(async () => {
    if (!baseUrl.trim()) return
    abortActiveTest()
    setTesting(false)
    setSubmitting(true)
    setError(null)
    try {
      const saved = await saveConnection(buildConnectionInput())
      await setActiveConnection(saved.id)
      onConnect(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mobile.connectFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [abortActiveTest, baseUrl, buildConnectionInput, onConnect, t])

  const handleSaveOnly = useCallback(async () => {
    if (!baseUrl.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await saveConnection(buildConnectionInput())
      await refresh()
      resetForm()
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mobile.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [baseUrl, buildConnectionInput, refresh, resetForm, t])

  const handleDelete = useCallback(
    async (id: string) => {
      await removeConnection(id)
      await refresh()
    },
    [refresh]
  )

  const recentUrls = useMemo(() => {
    const seen = new Set<string>()
    const urls: string[] = []
    for (const connection of connections) {
      const url = connection.baseUrl.trim().replace(/\/$/, '')
      if (!url) continue
      const key = url.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      urls.push(url)
    }
    return urls
  }, [connections])

  if (showForm) {
    return (
      <MobileConnectionForm
        editing={Boolean(editingId)}
        baseUrl={baseUrl}
        recentUrls={recentUrls}
        name={name}
        accessKey={accessKey}
        username={username}
        password={password}
        headers={headers}
        cookies={cookies}
        icon={icon}
        color={color}
        iconScrollNonce={iconScrollNonce}
        skipSSL={skipSSL}
        readonly={readonly}
        timeout={timeout}
        showAdvanced={showAdvanced}
        testing={testing}
        submitting={submitting}
        testResult={testResult}
        error={error}
        onBaseUrlChange={setBaseUrl}
        onNameChange={setName}
        onAccessKeyChange={setAccessKey}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSkipSSLChange={setSkipSSL}
        onReadonlyChange={setReadonly}
        onTimeoutChange={setTimeoutMs}
        onIconChange={setIcon}
        onColorChange={setColor}
        onRandomizeAppearance={randomizeAppearance}
        onAddHeader={() => setHeaders((prev) => [...prev, newHeaderEntry()])}
        onRemoveHeader={(index) => setHeaders((prev) => prev.filter((_, i) => i !== index))}
        onChangeHeader={updateHeader}
        onAddCookie={() => setCookies((prev) => [...prev, newHeaderEntry()])}
        onRemoveCookie={(index) => setCookies((prev) => prev.filter((_, i) => i !== index))}
        onChangeCookie={updateCookie}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onCancel={() => {
          abortActiveTest()
          setTesting(false)
          resetForm()
          setShowForm(false)
        }}
        onTest={() => void handleTestConnection()}
        onCancelTest={handleCancelTest}
        onSave={() => void handleSaveOnly()}
        onConnect={() => void handleSaveAndConnect()}
      />
    )
  }

  return (
    <MobileConnectionHome
      connections={connections}
      loading={loading}
      submitting={submitting}
      onNew={openNewForm}
      onConnect={(connection) => void handleConnectSaved(connection)}
      onEdit={fillForm}
      onDelete={(id) => void handleDelete(id)}
      onRefresh={refresh}
    />
  )
}
