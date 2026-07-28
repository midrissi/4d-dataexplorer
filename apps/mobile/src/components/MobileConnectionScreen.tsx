import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '~/i18n'
import { formatThrownError } from '~/lib/api'
import { setSkipSSL as setPlatformSkipSSL } from '~/lib/platform'
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

type MobileConnectionScreenProps = {
  onConnect: (connection: ConnectionConfig) => void
  initialEdit?: ConnectionConfig | null
}

type HeaderEntry = { id: string; key: string; value: string }

function newHeaderEntry(key = '', value = ''): HeaderEntry {
  return { id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, key, value }
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [headers, setHeaders] = useState<HeaderEntry[]>([])
  const [cookies, setCookies] = useState<HeaderEntry[]>([])
  const [skipSSL, setSkipSSL] = useState(false)
  const [timeout, setTimeoutMs] = useState('')
  const [readonly, setReadonly] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const refresh = useCallback(async () => {
    const list = await getConnections()
    setConnections(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fillForm = useCallback((connection: ConnectionConfig) => {
    setEditingId(connection.id)
    setName(connection.name)
    setBaseUrl(connection.baseUrl)
    setAccessKey(connection.accessKey ?? '')
    setUsername(connection.username ?? '')
    setPassword(connection.password ?? '')
    setHeaders(
      connection.headers
        ? Object.entries(connection.headers).map(([key, value]) => newHeaderEntry(key, value))
        : []
    )
    setCookies(
      connection.cookies
        ? Object.entries(connection.cookies).map(([key, value]) => newHeaderEntry(key, value))
        : []
    )
    setSkipSSL(Boolean(connection.skipSSL))
    setTimeoutMs(connection.timeout ? String(connection.timeout) : '')
    setReadonly(Boolean(connection.readonly))
    setShowAdvanced(false)
    setTestResult(null)
    setError(null)
    setShowForm(true)
  }, [])

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
    setSkipSSL(false)
    setTimeoutMs('')
    setReadonly(false)
    setShowAdvanced(false)
    setTestResult(null)
    setError(null)
  }, [])

  const openNewForm = useCallback(() => {
    resetForm()
    setShowForm(true)
  }, [resetForm])

  const handleTestConnection = useCallback(async () => {
    const url = baseUrl.trim()
    if (!url) return
    setTesting(true)
    setTestResult(null)
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
      setTestResult({
        ok: false,
        message: formatThrownError(err, t('mobile.testFailed')),
      })
    } finally {
      setTesting(false)
    }
  }, [baseUrl, accessKey, headers, cookies, username, password, skipSSL, timeout, t])

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
    setSubmitting(true)
    setError(null)
    try {
      const saved = await saveConnection(buildConnectionInput())
      await setActiveConnection(saved.id)
      onConnect(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mobile.connectFailed'))
      setSubmitting(false)
    }
  }, [baseUrl, buildConnectionInput, onConnect, t])

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

  if (showForm) {
    return (
      <MobileConnectionForm
        editing={Boolean(editingId)}
        baseUrl={baseUrl}
        name={name}
        accessKey={accessKey}
        username={username}
        password={password}
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
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        onCancel={() => {
          resetForm()
          setShowForm(false)
        }}
        onTest={() => void handleTestConnection()}
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
    />
  )
}
