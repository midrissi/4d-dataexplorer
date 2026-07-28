import { useCallback, useEffect, useState } from 'react'
import DataExplorerApp from '~/App'
import { useTranslation } from '~/i18n'
import { reconfigureClient } from '~/lib/api'
import {
  importHttpJarCookiesIfNeeded,
  registerConnectionStoreAPI,
  registerPlatformFetch,
  resetConnectionConfig,
  setConnectionConfig,
} from '~/lib/platform'
import { ThemeProvider } from '~/providers/ThemeProvider'
import { useSettingsStore } from '~/store/settings'
import {
  type ConnectionConfig,
  clearActiveConnection,
  clearConnectionCookies,
  getActiveConnection,
  saveConnection,
} from '~desktop/lib/connection-store'
import { desktopFetch } from '~desktop/lib/http'
import { MobileConnectionScreen } from '~mobile/components/MobileConnectionScreen'
import { syncWebviewSafeAreaMode } from '~mobile/lib/webview-safe-area'

// Route REST through Tauri HTTP plugin (CORS-free), same as desktop
registerPlatformFetch(desktopFetch)

registerConnectionStoreAPI({
  getActiveConnection,
  saveConnection: (config) =>
    saveConnection(config as Omit<ConnectionConfig, 'id' | 'lastUsed'> & { id?: string }),
  clearActiveConnection,
  clearConnectionCookies,
})

type AppState = 'loading' | 'connection-screen' | 'connected'

export function MobileApp() {
  const { t } = useTranslation()
  const [state, setState] = useState<AppState>('loading')
  const [lastConnection, setLastConnection] = useState<ConnectionConfig | null>(null)
  const [initialEditConnection, setInitialEditConnection] = useState<ConnectionConfig | null>(null)

  useEffect(() => {
    const apply = () => {
      syncWebviewSafeAreaMode()
    }
    apply()
    window.visualViewport?.addEventListener('resize', apply)
    return () => {
      window.visualViewport?.removeEventListener('resize', apply)
    }
  }, [])

  const connectToServer = useCallback((connection: ConnectionConfig) => {
    setLastConnection(connection)

    setConnectionConfig({
      baseUrl: connection.baseUrl,
      headers: connection.headers,
      cookies: connection.cookies,
      timeout: connection.timeout,
      skipSSL: connection.skipSSL,
    })

    void importHttpJarCookiesIfNeeded(connection.baseUrl)

    const headers: Record<string, string> = { ...connection.headers }
    if (connection.username && connection.password) {
      headers.Authorization = `Basic ${btoa(`${connection.username}:${connection.password}`)}`
    }
    reconfigureClient({
      baseUrl: connection.baseUrl,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      timeout: connection.timeout,
    })

    useSettingsStore.getState().setReadonlyMode(connection.readonly ?? false)

    setState('connected')
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount only
  useEffect(() => {
    getActiveConnection().then((connection) => {
      if (connection) {
        connectToServer(connection)
      } else {
        setState('connection-screen')
      }
    })
  }, [])

  const leaveToConnectionScreen = useCallback(() => {
    resetConnectionConfig()
    setInitialEditConnection(null)
    setState('connection-screen')
  }, [])

  const handleSwitchConnection = useCallback(async () => {
    await clearActiveConnection()
    leaveToConnectionScreen()
  }, [leaveToConnectionScreen])

  const handleDisconnect = useCallback(async () => {
    if (lastConnection?.id) {
      await clearConnectionCookies(lastConnection.id)
      setLastConnection({ ...lastConnection, cookies: undefined })
    }
    await clearActiveConnection()
    leaveToConnectionScreen()
  }, [lastConnection, leaveToConnectionScreen])

  const handleEditConnection = useCallback(() => {
    if (lastConnection) {
      setInitialEditConnection(lastConnection)
    }
    setState('connection-screen')
  }, [lastConnection])

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {state === 'loading' ? (
        <ThemeProvider>
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-xs">{t('mobile.loading')}</p>
          </div>
        </ThemeProvider>
      ) : state === 'connection-screen' ? (
        <ThemeProvider>
          <div className="flex h-full min-h-0 w-full flex-col">
            <MobileConnectionScreen
              onConnect={connectToServer}
              initialEdit={initialEditConnection}
            />
          </div>
        </ThemeProvider>
      ) : (
        <DataExplorerApp
          onDisconnect={handleDisconnect}
          onSwitchConnection={handleSwitchConnection}
          onEditConnection={handleEditConnection}
        />
      )}
    </div>
  )
}
