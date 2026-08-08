import type { InfoResponse } from '@4d/rest'
import { Button, cn } from '@4d/ui'
import {
  AlertCircle,
  Database,
  FileText,
  HardDrive,
  Layers,
  Lightbulb,
  Loader2,
  MousePointerClick,
  Network,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { PullToRefresh } from '~/components/PullToRefresh'
import { getIntlLocale, useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import { formatBytes, formatCount } from '~/lib/utils'
import { useDataExplorerStore } from '~/store'
import { formatShortcut, useDataclassCustomizations, useShortcuts } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { AppBrandIcon } from './AppBrandIcon'
import { DatabaseIdentityPanel } from './DatabaseIdentityPanel'
import { DataclassRow } from './DataclassRow'
import { WelcomeBarTooltip } from './WelcomeBarTooltip'
import { WelcomePieTooltip } from './WelcomePieTooltip'
import { WelcomeStatCard } from './WelcomeStatCard'

// Color palette for charts — driven by theme chart tokens
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
]

export function WelcomeScreen() {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  const dataclasses = useDataExplorerStore((s) => s.dataclasses)
  const dataclassesLoading = useDataExplorerStore((s) => s.dataclassesLoading)
  const dataclassesError = useDataExplorerStore((s) => s.dataclassesError)
  const refreshApp = useDataExplorerStore((s) => s.refreshApp)
  const openTab = useTabsStore((s) => s.openTab)
  const openEntitySetTab = useTabsStore((s) => s.openEntitySetTab)
  const openGraphTab = useTabsStore((s) => s.openGraphTab)
  const dataclassCustomizations = useDataclassCustomizations()
  const shortcuts = useShortcuts()
  const commandPaletteShortcut = shortcuts.find((s) => s.id === 'command-palette')
  const openStructureShortcut = shortcuts.find((s) => s.id === 'open-structure')
  const goToEntityShortcut = shortcuts.find((s) => s.id === 'go-to-entity')
  const openDataclassDataShortcut = shortcuts.find((s) => s.id === 'open-dataclass-data')

  // Delay chart rendering until after mount to ensure container has dimensions
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => {
    // Small delay to ensure layout is complete
    const timer = setTimeout(() => setChartsReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Server info from /rest/$info
  const [serverInfo, setServerInfo] = useState<InfoResponse | null>(null)
  const [serverInfoLoading, setServerInfoLoading] = useState(true)
  const [serverInfoError, setServerInfoError] = useState<string | null>(null)
  const [refreshingFromRetry, setRefreshingFromRetry] = useState(false)
  const fetchServerInfo = useCallback(() => {
    setServerInfoLoading(true)
    setServerInfoError(null)
    api
      .getServerInfo()
      .then(setServerInfo)
      .catch((err) =>
        setServerInfoError(err instanceof Error ? err.message : t('welcome.failedToLoadServerInfo'))
      )
      .finally(() => setServerInfoLoading(false))
  }, [t])
  useEffect(() => {
    fetchServerInfo()
  }, [fetchServerInfo])
  const handleRetryServerInfo = useCallback(() => {
    setRefreshingFromRetry(true)
    setServerInfoLoading(true)
    setServerInfoError(null)
    api
      .getServerInfo()
      .then(setServerInfo)
      .catch((err) =>
        setServerInfoError(err instanceof Error ? err.message : t('welcome.failedToLoadServerInfo'))
      )
      .finally(() => {
        setServerInfoLoading(false)
        setRefreshingFromRetry(false)
      })
  }, [t])

  const handleDataclassClick = (dataclassName: string) => {
    // Activating the tab triggers syncActiveTab (App.tsx), which restores any
    // cached slice or fetches on first activation. Avoid selectDataclass here so
    // reopening an already-open tab keeps its page/selection/relations.
    openTab(dataclassName)
  }

  const handleEntitySetClick = (dataClass: string, entitySetId: string) => {
    openEntitySetTab({
      dataclassName: dataClass,
      entitySetId,
      viewMode: 'table',
      forceNew: false,
    })
  }

  const stats = useMemo(() => {
    const totalEntities = dataclasses.reduce((sum, c) => sum + c.count, 0)
    const sortedByCount = [...dataclasses].sort((a, b) => b.count - a.count)
    const largest = sortedByCount[0]
    const avgPerDataclass =
      dataclasses.length > 0 ? Math.round(totalEntities / dataclasses.length) : 0

    return {
      totalEntities,
      totalDataclasses: dataclasses.length,
      largest,
      avgPerDataclass,
      sortedByCount,
    }
  }, [dataclasses])

  // Prepare chart data with colors included
  const barChartData = useMemo(() => {
    return [...dataclasses]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((c, index) => ({
        name: c.name,
        count: c.count,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }))
  }, [dataclasses])

  const pieChartData = useMemo(() => {
    const sorted = [...dataclasses].sort((a, b) => b.count - a.count)
    const top5 = sorted.slice(0, 5)
    const othersCount = sorted.slice(5).reduce((sum, c) => sum + c.count, 0)

    const data = top5.map((c, index) => ({
      name: c.name,
      count: c.count,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))

    if (othersCount > 0) {
      data.push({
        name: t('welcome.others'),
        count: othersCount,
        fill: CHART_COLORS[5 % CHART_COLORS.length],
      })
    }

    return data
  }, [dataclasses, t])

  const isRefreshingDataclasses = dataclassesLoading && dataclasses.length > 0
  const mobile = isMobileShell()

  const handlePullRefresh = useCallback(async () => {
    await refreshApp()
    fetchServerInfo()
  }, [refreshApp, fetchServerInfo])

  // Initial load only — keep existing stats visible while a refresh is in flight.
  if (dataclassesLoading && dataclasses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="animate-pulse">{t('loading.loadingStats')}</span>
        </div>
      </div>
    )
  }

  const welcomeBody = (
    <>
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] left-[10%] h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-[15%] bottom-[20%] h-96 w-96 rounded-full bg-violet-500/5 blur-3xl" />
        <div className="absolute top-[40%] left-[60%] h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Header */}
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-20 w-20">
            <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/20" />
            <div className="absolute inset-2 flex items-center justify-center">
              {isRefreshingDataclasses ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              ) : (
                <div className="relative h-full w-full">
                  <AppBrandIcon className="h-full w-full drop-shadow-xl" />
                  <div className="absolute -right-1 -bottom-1 rounded-full bg-background p-1 shadow">
                    <Layers className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <h1
            className={cn(
              'font-semibold text-foreground',
              isMobileShell() ? 'text-xl' : 'text-2xl'
            )}
          >
            {t('welcome.title')}
          </h1>
          <p className="mt-1 text-muted-foreground text-sm sm:text-base">{t('welcome.subtitle')}</p>
          {isRefreshingDataclasses && (
            <span className="sr-only" role="status" aria-live="polite">
              {t('loading.loadingStats')}
            </span>
          )}
        </div>

        {/* Connection & Quick actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => eventBus.emit('open-command-palette')}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              {t('welcome.commandPalette')}
              {commandPaletteShortcut?.enabled && (
                <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                  {formatShortcut(commandPaletteShortcut)}
                </kbd>
              )}
            </Button>
            {!isMobileShell() ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openGraphTab()}
                className="gap-2"
              >
                <Network className="h-4 w-4" />
                {t('welcome.structure')}
                {openStructureShortcut?.enabled && (
                  <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                    {formatShortcut(openStructureShortcut)}
                  </kbd>
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Tips */}
        <div className="rounded-md border bg-card p-3">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-foreground">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            {isMobileShell() ? t('mobile.welcomeTipsTitle') : t('welcome.tipsShortcuts')}
          </h3>
          {isMobileShell() ? (
            <ul className="grid gap-2 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4 shrink-0 text-primary" />
                <span>{t('mobile.welcomeTipCatalog')}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <MousePointerClick className="h-4 w-4 shrink-0" />
                <span>{t('mobile.welcomeTipOpen')}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4 shrink-0" />
                <span>{t('mobile.welcomeTipSearch')}</span>
              </li>
            </ul>
          ) : (
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {commandPaletteShortcut?.enabled && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {t('welcome.commandPaletteShortcut')}{' '}
                    <kbd className="rounded border bg-muted px-1 font-mono text-xs">
                      {formatShortcut(commandPaletteShortcut)}
                    </kbd>
                  </span>
                </li>
              )}
              {openDataclassDataShortcut?.enabled && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Search className="h-4 w-4 shrink-0" />
                  <span>
                    {t('welcome.openDataclassShortcut')}{' '}
                    <kbd className="rounded border bg-muted px-1 font-mono text-xs">
                      {formatShortcut(openDataclassDataShortcut)}
                    </kbd>
                  </span>
                </li>
              )}
              {goToEntityShortcut?.enabled && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>
                    {t('welcome.goToEntityShortcut')}{' '}
                    <kbd className="rounded border bg-muted px-1 font-mono text-xs">
                      {formatShortcut(goToEntityShortcut)}
                    </kbd>
                  </span>
                </li>
              )}
              {openStructureShortcut?.enabled && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Network className="h-4 w-4 shrink-0" />
                  <span>
                    {t('welcome.structureViewShortcut')}{' '}
                    <kbd className="rounded border bg-muted px-1 font-mono text-xs">
                      {formatShortcut(openStructureShortcut)}
                    </kbd>
                  </span>
                </li>
              )}
              <li className="flex items-center gap-2 text-muted-foreground">
                <MousePointerClick className="h-4 w-4 shrink-0" />
                <span>{t('welcome.clickDataclassTip')}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4 shrink-0" />
                <span>{t('welcome.sidebarTip')}</span>
              </li>
            </ul>
          )}
        </div>

        {/* Stats Cards */}
        <div
          className={cn(
            'grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-4',
            isRefreshingDataclasses && 'opacity-70'
          )}
        >
          <WelcomeStatCard
            icon={Layers}
            label={t('welcome.dataclasses')}
            value={stats.totalDataclasses}
            subtext={t('welcome.totalTables')}
          />
          <WelcomeStatCard
            icon={FileText}
            label={t('welcome.totalEntities')}
            value={formatCount(stats.totalEntities)}
            subtext={t('welcome.acrossAllDataclasses')}
          />
          <WelcomeStatCard
            icon={HardDrive}
            label={t('welcome.largestDataclass')}
            value={stats.largest ? formatCount(stats.largest.count) : t('welcome.na')}
            subtext={stats.largest?.name}
          />
          <WelcomeStatCard
            icon={TrendingUp}
            label={t('welcome.averageSize')}
            value={formatCount(stats.avgPerDataclass)}
            subtext={t('welcome.entitiesPerDataclass')}
          />
        </div>

        <DatabaseIdentityPanel />

        {/* Server Info (from /rest/$info) */}
        <div className="rounded-md border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-medium text-foreground">
              <Server className="h-4 w-4 text-primary" />
              {t('welcome.serverInfo')}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={fetchServerInfo}
              disabled={serverInfoLoading}
              aria-label={t('welcome.refreshServerInfo')}
              className="h-8 w-8"
            >
              <RefreshCw className={cn('h-4 w-4', serverInfoLoading && 'animate-spin')} />
            </Button>
          </div>
          {serverInfoLoading && !serverInfo && (
            <p className="text-muted-foreground text-sm">{t('welcome.loadingServerInfo')}</p>
          )}
          {serverInfoError && (
            <div
              className="mb-4 flex flex-col gap-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <div className="flex min-w-0 gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-destructive text-sm">
                    {serverInfo
                      ? t('welcome.couldNotRefreshServerInfo')
                      : t('welcome.couldNotLoadServerInfo')}
                  </p>
                  <p className="text-muted-foreground text-xs">{serverInfoError}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetryServerInfo}
                disabled={refreshingFromRetry}
                className="shrink-0 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshingFromRetry && 'animate-spin')} />
                {t('welcome.retry')}
              </Button>
            </div>
          )}
          {serverInfo && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-xs">{t('welcome.cacheSize')}</p>
                  <p className="font-medium text-foreground text-sm">
                    {formatBytes(serverInfo.usedCache)} / {formatBytes(serverInfo.cacheSize)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('welcome.entitySets')}</p>
                  <p className="font-medium text-foreground text-sm">{serverInfo.entitySetCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('welcome.sessions')}</p>
                  <p className="font-medium text-foreground text-sm">
                    {serverInfo.sessionInfo?.length ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('welcome.privileges')}</p>
                  <p className="font-medium text-foreground text-sm">
                    {serverInfo.privileges?.length
                      ? serverInfo.privileges.map((p) => p.privilege).join(', ')
                      : '—'}
                  </p>
                </div>
              </div>
              {serverInfo.entitySet && serverInfo.entitySet.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="sticky top-0 z-10 bg-muted px-3 py-2 font-medium text-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                          {t('welcome.dataClass')}
                        </th>
                        <th className="sticky top-0 z-10 bg-muted px-3 py-2 font-medium text-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                          {t('welcome.entitySetId')}
                        </th>
                        <th className="sticky top-0 z-10 bg-muted px-3 py-2 font-medium text-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                          {t('welcome.selection')}
                        </th>
                        <th className="sticky top-0 z-10 bg-muted px-3 py-2 font-medium text-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                          {t('welcome.refreshed')}
                        </th>
                        <th className="sticky top-0 z-10 bg-muted px-3 py-2 font-medium text-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                          {t('welcome.expires')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serverInfo.entitySet.map((es) => (
                        <tr key={es.id} className="border-border border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-foreground">{es.dataClass}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="font-mono text-primary text-xs underline-offset-2 hover:underline"
                              title={t('welcome.openEntitySet')}
                              onClick={() => handleEntitySetClick(es.dataClass, es.id)}
                            >
                              {es.id}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatCount(es.selectionSize)}
                            {es.sorted ? ` ${t('welcome.sorted')}` : ''}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(es.refreshed).toLocaleString(locale)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {es.expires === 'never'
                              ? t('welcome.noExpiry')
                              : new Date(es.expires).toLocaleString(locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Empty state when no dataclasses */}
        {!dataclassesLoading && dataclasses.length === 0 && (
          <EmptyPanel
            icon={Database}
            badgeIcon={Layers}
            badgeTone="primary"
            title={t('welcome.noDataclassesInDb')}
            description={dataclassesError ? dataclassesError : t('welcome.ensureRestRunning')}
            ghost="cards"
            bordered
            size="md"
            action={
              <>
                <EmptyPanelAction
                  icon={Search}
                  onClick={() => eventBus.emit('open-command-palette')}
                >
                  {t('welcome.openCommandPalette')}
                </EmptyPanelAction>
                {!isMobileShell() ? (
                  <EmptyPanelAction icon={Network} onClick={() => openGraphTab()}>
                    {t('welcome.viewStructure')}
                  </EmptyPanelAction>
                ) : null}
              </>
            }
          />
        )}

        {/* Charts Section */}
        {dataclasses.length > 0 && (
          <div
            className={cn(
              'grid gap-4 transition-opacity lg:grid-cols-2',
              isRefreshingDataclasses && 'opacity-70'
            )}
          >
            {/* Bar Chart */}
            <div className="rounded-md border bg-card p-3">
              <h3 className="mb-4 font-medium text-foreground">
                {t('welcome.entitiesByDataclass')}
              </h3>
              <div className="h-75 min-h-75">
                {chartsReady && barChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={barChartData}
                      layout="vertical"
                      margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatCount(value)}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        width={140}
                      />
                      <Tooltip
                        content={<WelcomeBarTooltip entitiesLabel={t('welcome.entities')} />}
                        cursor={{ fill: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="rounded-md border bg-card p-3">
              <h3 className="mb-3 font-medium text-foreground text-sm">
                {t('welcome.distribution')}
              </h3>
              <div className="h-75 min-h-75">
                {chartsReady && pieChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="count"
                        stroke="none"
                        isAnimationActive={false}
                      />
                      <Tooltip
                        content={<WelcomePieTooltip entitiesLabel={t('welcome.entities')} />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {pieChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground text-xs">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dataclasses List */}
        {dataclasses.length > 0 && (
          <div
            className={cn(
              'rounded-md border bg-card p-3 transition-opacity',
              isRefreshingDataclasses && 'opacity-70'
            )}
          >
            <h3 className="mb-3 font-medium text-foreground text-sm">
              {t('welcome.allDataclasses')}
            </h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {stats.sortedByCount.map((dataclass, index) => (
                <DataclassRow
                  key={dataclass.name}
                  dataclass={dataclass}
                  rank={index + 1}
                  maxCount={stats.largest?.count ?? 1}
                  customization={dataclassCustomizations[dataclass.name]}
                  onClick={() => handleDataclassClick(dataclass.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Call to action */}
        <div className="flex items-center justify-center gap-2 pb-4 text-muted-foreground text-sm">
          <MousePointerClick className="h-4 w-4" />
          <span>
            {dataclasses.length > 0 ? t('welcome.clickToExplore') : t('welcome.getStartedTip')}
          </span>
        </div>
      </div>
    </>
  )

  if (mobile) {
    return (
      <PullToRefresh
        className="relative h-full min-h-0 bg-background"
        disabled={dataclassesLoading}
        label={t('layout.pullToRefreshApp')}
        onRefresh={handlePullRefresh}
      >
        <div className="relative">{welcomeBody}</div>
      </PullToRefresh>
    )
  }

  return <div className="relative h-full overflow-auto bg-background">{welcomeBody}</div>
}
