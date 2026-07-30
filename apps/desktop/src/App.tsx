import { useCallback, useEffect, useState } from 'react'
// Dynamically import the main dataexplorer App
import DataExplorerApp from '~/App'
import { AboutDialog } from '~/components/AboutDialog'
import { useTranslation } from '~/i18n'
import { reconfigureClient } from '~/lib/api'
import { registerDownloadBytes } from '~/lib/download-bytes'
import {
  importHttpJarCookiesIfNeeded,
  registerConnectionStoreAPI,
  registerPlatformFetch,
  resetConnectionConfig,
  setConnectionConfig,
} from '~/lib/platform'
import { ThemeProvider } from '~/providers/ThemeProvider'
import { useSettingsStore } from '~/store/settings'
import { ConnectionScreen } from '~desktop/components/ConnectionScreen'
import { DesktopUpdaterController } from '~desktop/components/DesktopUpdaterController'
import {
  type ConnectionConfig,
  clearActiveConnection,
  clearConnectionCookies,
  getActiveConnection,
  saveConnection,
} from '~desktop/lib/connection-store'
import { tauriDownloadBytes } from '~desktop/lib/download-bytes'
import { desktopFetch } from '~desktop/lib/http'
import { reloadDesktopInterface, setupDesktopMenu } from '~desktop/lib/menu'

// Route REST requests through Tauri's HTTP plugin to bypass browser CORS
registerPlatformFetch(desktopFetch)

// Browser <a download> is ignored in WebView — use a native save dialog instead
registerDownloadBytes(tauriDownloadBytes)

// Register the desktop connection store API so shared components can use it
registerConnectionStoreAPI({
  getActiveConnection,
  saveConnection: (config) =>
    saveConnection(config as Omit<ConnectionConfig, 'id' | 'lastUsed'> & { id?: string }),
  clearActiveConnection,
  clearConnectionCookies,
})

type AppState = 'loading' | 'connection-screen' | 'connected'

export function DesktopApp() {
  const { t } = useTranslation()
  const [state, setState] = useState<AppState>('loading')
  const [lastConnection, setLastConnection] = useState<ConnectionConfig | null>(null)
  const [initialEditConnection, setInitialEditConnection] = useState<ConnectionConfig | null>(null)

  // Reveal the window once the themed UI has painted its first frame. The window
  // is created hidden (tauri.conf.json) so users never see a white/unstyled flash
  // or the pre-restore geometry; the window-state plugin has already restored the
  // saved size/position by this point.
  useEffect(() => {
    let cancelled = false
    const reveal = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const appWindow = getCurrentWindow()
        if (cancelled) return
        await appWindow.show()
        await appWindow.setFocus()
      } catch {
        // Not running under Tauri, or window already shown — ignore.
      }
    }
    // Wait for two animation frames so the first painted frame is the themed UI.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) void reveal()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  // Install desktop-native app menu entries (About under Help, Reload under View).
  useEffect(() => {
    const appName = t('app.title')
    void setupDesktopMenu({
      appName,
      about: t('desktopMenu.about', { appName }),
      help: t('desktopMenu.help'),
      view: t('desktopMenu.view'),
      reload: t('desktopMenu.reload'),
      services: t('desktopMenu.services'),
      hide: t('desktopMenu.hide', { appName }),
      hideOthers: t('desktopMenu.hideOthers'),
      showAll: t('desktopMenu.showAll'),
      quit: t('desktopMenu.quit', { appName }),
    })
  }, [t])

  // Cmd/Ctrl+R — browser-style hard reload (menu accelerator may not reach the webview).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== 'r') return
      e.preventDefault()
      reloadDesktopInterface()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // On mount, check if there's an active connection
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

  const connectToServer = useCallback((connection: ConnectionConfig) => {
    setLastConnection(connection)

    // Configure the platform module. Cookies are passed separately (not as a
    // header) because the browser Request/Headers APIs strip the forbidden
    // `Cookie` header; the desktop fetch injects them at request time.
    setConnectionConfig({
      baseUrl: connection.baseUrl,
      headers: connection.headers,
      cookies: connection.cookies,
      timeout: connection.timeout,
      skipSSL: connection.skipSSL,
    })

    // Import session cookies from the HTTP plugin jar when the connection
    // profile does not yet store any (so the HTTP Client UI can show them).
    void importHttpJarCookiesIfNeeded(connection.baseUrl)

    // Reconfigure the REST client
    const headers: Record<string, string> = { ...connection.headers }
    if (connection.username && connection.password) {
      headers.Authorization = `Basic ${btoa(`${connection.username}:${connection.password}`)}`
    }
    reconfigureClient({
      baseUrl: connection.baseUrl,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      timeout: connection.timeout,
    })

    // Apply the connection's read-only preference to the app settings
    useSettingsStore.getState().setReadonlyMode(connection.readonly ?? false)

    setState('connected')
  }, [])

  const leaveToConnectionScreen = useCallback(() => {
    resetConnectionConfig()
    setInitialEditConnection(null)
    setState('connection-screen')
  }, [])

  /** Switch connection: leave the session but keep saved cookies on the profile. */
  const handleSwitchConnection = useCallback(async () => {
    await clearActiveConnection()
    leaveToConnectionScreen()
  }, [leaveToConnectionScreen])

  /** Disconnect: clear saved cookies for this connection, then leave. */
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
    <>
      <AboutDialog />
      <DesktopUpdaterController />
      {state === 'loading' ? (
        <ThemeProvider>
          <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </ThemeProvider>
      ) : state === 'connection-screen' ? (
        <ThemeProvider>
          <ConnectionScreen onConnect={connectToServer} initialEdit={initialEditConnection} />
        </ThemeProvider>
      ) : (
        <DataExplorerApp
          onDisconnect={handleDisconnect}
          onSwitchConnection={handleSwitchConnection}
          onEditConnection={handleEditConnection}
        />
      )}
    </>
  )
}
