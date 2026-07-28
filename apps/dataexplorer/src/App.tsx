import { AuthenticationError, type RESTClientError } from '@4d/rest'
import { Button } from '@4d/ui'
import { Database } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AccessKeyScreen } from './components/AccessKeyScreen'
import { DataclassView } from './components/DataclassView'
import { EmptyState } from './components/EmptyState'
import { Layout } from './components/Layout'
import { LoadingScreen, type LoadingStep } from './components/LoadingScreen'
import { ResizablePanel } from './components/ResizablePanel'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { useTranslation } from './i18n'
import { api, clearCatalogCacheAndStorage, formatThrownError, isTransportError } from './lib/api'
import '~/lib/assistant-llm-configured'
import { getConnectionStoreAPI, isDesktop, isMobileShell } from './lib/platform'
import { KeyboardShortcutsProvider } from './providers/KeyboardShortcutsProvider'
import { ShortcutController } from './providers/ShortcutController'
import { ThemeProvider } from './providers/ThemeProvider'
import { useDataExplorerStore } from './store'
import { useSettingsStore } from './store/settings'
import { useActiveTabId } from './store/tabs'

type AppState = 'loading' | 'ready' | 'empty' | 'error' | 'needsAccessKey'

type AppContentProps = {
  onDisconnect?: () => void
  onSwitchConnection?: () => void
  onEditConnection?: () => void
}

function AppContent({ onDisconnect, onSwitchConnection, onEditConnection }: AppContentProps) {
  const { t } = useTranslation()
  const [appState, setAppState] = useState<AppState>('loading')
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: 'catalog', label: t('loading.connecting'), status: 'pending' },
    { id: 'dataclasses', label: t('loading.loadingDataclasses'), status: 'pending' },
  ])
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [savedAccessKey, setSavedAccessKey] = useState('')
  const [accessKeyReason, setAccessKeyReason] = useState<string | null>(null)

  const syncActiveTab = useDataExplorerStore((state) => state.syncActiveTab)
  const activeTabId = useActiveTabId()

  // Sidebar collapse state
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed)

  // Update a loading step
  const updateStep = useCallback((id: string, updates: Partial<LoadingStep>) => {
    setLoadingSteps((steps) =>
      steps.map((step) => (step.id === id ? { ...step, ...updates } : step))
    )
  }, [])

  const persistAccessKey = useCallback(async (accessKey: string) => {
    const storeApi = getConnectionStoreAPI()
    if (!storeApi) return
    const connection = await storeApi.getActiveConnection()
    if (!connection) return
    await storeApi.saveConnection({
      ...connection,
      accessKey,
    })
  }, [])

  /**
   * Desktop: create a session with the connection's access key before catalog
   * calls. Returns false when login reports isLogged: false (or other failure)
   * so the access-key screen can be shown. Returns true when there is no key
   * (web / no key configured) or login succeeded.
   */
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (!isDesktop()) return true
    const storeApi = getConnectionStoreAPI()
    const connection = await storeApi?.getActiveConnection()
    const key = connection?.accessKey?.trim()
    if (!key) return true
    setSavedAccessKey(key)
    updateStep('catalog', { status: 'loading', detail: t('loading.authenticating') })
    try {
      await api.loginWithAccessKey(key)
      return true
    } catch (error) {
      // Server unreachable / network failures belong on the loading error screen.
      if (isTransportError(error)) {
        throw error
      }
      setAccessKeyReason(formatThrownError(error, t('loading.accessKeySessionFailed')))
      return false
    }
  }, [t, updateStep])

  // Initialize the app
  const initializeApp = useCallback(async () => {
    setAppState('loading')
    setLoadingError(null)
    setAccessKeyReason(null)
    setLoadingSteps([
      { id: 'catalog', label: t('loading.connecting'), status: 'pending' },
      { id: 'dataclasses', label: t('loading.loadingDataclasses'), status: 'pending' },
    ])

    try {
      const sessionOk = await ensureSession()
      if (!sessionOk) {
        setAppState('needsAccessKey')
        return
      }

      // Step 1: Initialize storage (fetches catalog BASEID)
      updateStep('catalog', { status: 'loading', detail: t('loading.fetchingCatalog') })
      await api.initializeStorage()
      updateStep('catalog', { status: 'done', detail: t('loading.connected') })

      // Step 2: Fetch dataclasses
      updateStep('dataclasses', { status: 'loading', detail: t('loading.fetchingMetadata') })
      const fetchedDataclasses = await api.getDataclasses()

      // Update store directly
      useDataExplorerStore.setState({
        dataclasses: fetchedDataclasses,
        dataclassesLoading: false,
        dataclassesError: null,
      })

      if (fetchedDataclasses.length === 0) {
        updateStep('dataclasses', { status: 'done', detail: t('loading.noDataclassesFound') })
        setAppState('empty')
      } else {
        const totalEntities = fetchedDataclasses.reduce((sum, dc) => sum + dc.count, 0)
        updateStep('dataclasses', {
          status: 'done',
          detail: `${fetchedDataclasses.length} dataclasses, ${totalEntities.toLocaleString()} entities`,
        })
        setAppState('ready')
      }
    } catch (error) {
      const is401 =
        error instanceof AuthenticationError ||
        (error && typeof error === 'object' && (error as RESTClientError).statusCode === 401)
      if (is401) {
        const storeApi = getConnectionStoreAPI()
        const connection = await storeApi?.getActiveConnection()
        const key = connection?.accessKey?.trim()
        if (key) setSavedAccessKey(key)
        setAccessKeyReason(formatThrownError(error, t('loading.accessKeyAuthRequired')))
        setAppState('needsAccessKey')
        return
      }
      const errorMessage = formatThrownError(error, t('loading.failedToConnect'))
      setLoadingError(errorMessage)

      // Mark current loading step as error
      setLoadingSteps((steps) =>
        steps.map((step) =>
          step.status === 'loading' ? { ...step, status: 'error', detail: errorMessage } : step
        )
      )
      setAppState('error')
    }
  }, [t, updateStep, ensureSession])

  const handleAccessKeySubmit = useCallback(
    async (accessKey: string) => {
      await api.loginWithAccessKey(accessKey)
      setSavedAccessKey(accessKey)
      setAccessKeyReason(null)
      await persistAccessKey(accessKey)
      clearCatalogCacheAndStorage()
      await initializeApp()
    },
    [initializeApp, persistAccessKey]
  )

  // Initialize on mount
  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  // Sync the active-tab mirror whenever the active tab changes. Restores the
  // tab's cached entity slice instantly, or triggers an initial fetch for a
  // freshly opened tab (without wiping other tabs' cached state).
  useEffect(() => {
    if (appState === 'ready') {
      syncActiveTab(activeTabId)
    }
  }, [appState, activeTabId, syncActiveTab])

  // Show access key form when catalog returns 401
  if (appState === 'needsAccessKey') {
    return (
      <AccessKeyScreen
        initialAccessKey={savedAccessKey}
        reason={accessKeyReason}
        onSubmit={handleAccessKeySubmit}
        onBack={onEditConnection ?? onSwitchConnection ?? onDisconnect}
      />
    )
  }

  // Show loading screen
  if (appState === 'loading' || appState === 'error') {
    return (
      <LoadingScreen
        steps={loadingSteps}
        error={loadingError}
        onRetry={appState === 'error' ? initializeApp : undefined}
        onDisconnect={appState === 'error' ? onDisconnect : undefined}
      />
    )
  }

  // Show empty state
  if (appState === 'empty') {
    return <EmptyState onRetry={initializeApp} />
  }

  return (
    <Layout
      onDisconnect={onDisconnect}
      onSwitchConnection={onSwitchConnection}
      onEditConnection={onEditConnection}
    >
      {isMobileShell() ? (
        <MobileExplorerShell />
      ) : (
        <div className="flex h-full">
          <ResizablePanel
            defaultSize={325}
            minSize={325}
            maxSize={450}
            direction="left"
            storageKey="sidebar"
            className="border-r"
            collapsible
            collapsedSize={52}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          >
            <Sidebar collapsed={sidebarCollapsed} />
          </ResizablePanel>
          <main
            className="flex min-w-0 flex-1 flex-col overflow-hidden"
            aria-label={t('app.entityExplorerAria')}
          >
            <TabBar />
            <div className="flex-1 overflow-hidden">
              <DataclassView />
            </div>
          </main>
        </div>
      )}
    </Layout>
  )
}

/** Mobile: full-width content with a slide-over dataclass drawer. */
function MobileExplorerShell() {
  const { t } = useTranslation()
  const [catalogOpen, setCatalogOpen] = useState(false)
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed)

  // Keep settings store in sync so shortcuts / assistant tools still work.
  useEffect(() => {
    if (!sidebarCollapsed) setSidebarCollapsed(true)
  }, [sidebarCollapsed, setSidebarCollapsed])

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-border border-b bg-background px-2 py-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => setCatalogOpen(true)}
        >
          <Database className="h-3.5 w-3.5" />
          {t('mobile.openCatalog')}
        </Button>
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {t('mobile.betaDisclaimer')}
        </p>
      </div>
      <main
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        aria-label={t('app.entityExplorerAria')}
      >
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <DataclassView />
        </div>
      </main>

      {catalogOpen ? (
        <div className="absolute inset-0 z-40 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t('mobile.closeCatalog')}
            onClick={() => setCatalogOpen(false)}
          />
          <div className="relative z-10 flex h-full w-[min(100%,20rem)] flex-col bg-background shadow-lg">
            <div className="flex items-center justify-between border-border border-b px-3 py-2">
              <p className="font-medium text-sm">{t('sidebar.dataclasses')}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setCatalogOpen(false)}
              >
                {t('mobile.closeCatalog')}
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <Sidebar collapsed={false} onDataclassOpened={() => setCatalogOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function App({
  onDisconnect,
  onSwitchConnection,
  onEditConnection,
}: {
  onDisconnect?: () => void
  onSwitchConnection?: () => void
  onEditConnection?: () => void
} = {}) {
  return (
    <ThemeProvider>
      <ShortcutController>
        <KeyboardShortcutsProvider>
          <AppContent
            onDisconnect={onDisconnect}
            onSwitchConnection={onSwitchConnection}
            onEditConnection={onEditConnection}
          />
        </KeyboardShortcutsProvider>
      </ShortcutController>
    </ThemeProvider>
  )
}

export default App
