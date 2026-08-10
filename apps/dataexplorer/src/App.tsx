import { AuthenticationError, type RESTClientError } from '@4d/rest'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessKeyScreen } from './components/AccessKeyScreen'
import { DataclassView } from './components/DataclassView'
import { EmptyState } from './components/EmptyState'
import { Layout } from './components/Layout'
import { LoadingScreen, type LoadingStep } from './components/LoadingScreen'
import { MobileCatalogProvider, useMobileCatalog } from './components/MobileCatalogContext'
import { ResizablePanel } from './components/ResizablePanel'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { useTranslation } from './i18n'
import { api, clearCatalogCacheAndStorage, formatThrownError, isTransportError } from './lib/api'
import '~/lib/assistant-llm-configured'
import { AUTO_COUNT_THRESHOLD } from './lib/dataclass-counts'
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
  const loadGenerationRef = useRef(0)

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
    const generation = ++loadGenerationRef.current
    setAppState('loading')
    setLoadingError(null)
    setAccessKeyReason(null)
    setLoadingSteps([
      { id: 'catalog', label: t('loading.connecting'), status: 'pending' },
      { id: 'dataclasses', label: t('loading.loadingDataclasses'), status: 'pending' },
    ])

    try {
      const sessionOk = await ensureSession()
      if (generation !== loadGenerationRef.current) return
      if (!sessionOk) {
        setAppState('needsAccessKey')
        return
      }

      // Step 1: Initialize storage (fetches catalog BASEID)
      updateStep('catalog', { status: 'loading', detail: t('loading.fetchingCatalog') })
      await api.initializeStorage()
      if (generation !== loadGenerationRef.current) return
      updateStep('catalog', { status: 'done', detail: t('loading.connected') })

      // Step 2: Fetch dataclass names (counts load lazily / auto when < threshold)
      updateStep('dataclasses', { status: 'loading', detail: t('loading.fetchingMetadata') })
      const fetchedDataclasses = await api.getDataclassList()
      if (generation !== loadGenerationRef.current) return

      // Update store directly
      useDataExplorerStore.setState({
        dataclasses: fetchedDataclasses,
        dataclassesLoading: false,
        dataclassesError: null,
        countLoadingNames: {},
        countsLoadingAll: false,
      })

      if (fetchedDataclasses.length === 0) {
        updateStep('dataclasses', { status: 'done', detail: t('loading.noDataclassesFound') })
        setAppState('empty')
      } else {
        updateStep('dataclasses', {
          status: 'done',
          detail: t('loading.dataclassesReady', { count: fetchedDataclasses.length }),
        })
        setAppState('ready')
        if (fetchedDataclasses.length < AUTO_COUNT_THRESHOLD) {
          void useDataExplorerStore.getState().fetchAllDataclassCounts()
        }
      }
    } catch (error) {
      if (generation !== loadGenerationRef.current) return
      const is401 =
        error instanceof AuthenticationError ||
        (error && typeof error === 'object' && (error as RESTClientError).statusCode === 401)
      if (is401) {
        const storeApi = getConnectionStoreAPI()
        const connection = await storeApi?.getActiveConnection()
        if (generation !== loadGenerationRef.current) return
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

  const leaveToConnections = onDisconnect ?? onSwitchConnection ?? onEditConnection

  const handleReloadCatalog = useCallback(() => {
    clearCatalogCacheAndStorage()
    void initializeApp()
  }, [initializeApp])

  const handleCancelLoading = useCallback(() => {
    loadGenerationRef.current += 1
    leaveToConnections?.()
  }, [leaveToConnections])
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
        onCancel={appState === 'loading' && leaveToConnections ? handleCancelLoading : undefined}
        onDisconnect={appState === 'error' ? leaveToConnections : undefined}
      />
    )
  }

  // Show empty state
  if (appState === 'empty') {
    return <EmptyState onRetry={handleReloadCatalog} onBack={leaveToConnections} />
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
  const { catalogOpen, closeCatalog } = useMobileCatalog()
  const activeTabId = useActiveTabId()
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed)

  // Keep settings store in sync so shortcuts / assistant tools still work.
  useEffect(() => {
    if (!sidebarCollapsed) setSidebarCollapsed(true)
  }, [sidebarCollapsed, setSidebarCollapsed])

  // Settings / tools / other pages open as tabs under the catalog overlay.
  // Close the drawer whenever navigation changes so it doesn't stay on top.
  useEffect(() => {
    if (activeTabId == null) return
    closeCatalog()
  }, [activeTabId, closeCatalog])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <main
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        aria-label={t('app.entityExplorerAria')}
      >
        <TabBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <DataclassView />
        </div>
      </main>

      {catalogOpen ? (
        <div className="absolute inset-0 z-40 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t('mobile.closeCatalog')}
            onClick={closeCatalog}
          />
          <div className="relative z-10 flex h-full w-full max-w-full flex-col bg-background shadow-lg">
            <div className="min-h-0 flex-1">
              <Sidebar collapsed={false} onDataclassOpened={closeCatalog} onClose={closeCatalog} />
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
          <MobileCatalogProvider>
            <AppContent
              onDisconnect={onDisconnect}
              onSwitchConnection={onSwitchConnection}
              onEditConnection={onEditConnection}
            />
          </MobileCatalogProvider>
        </KeyboardShortcutsProvider>
      </ShortcutController>
    </ThemeProvider>
  )
}

export default App
