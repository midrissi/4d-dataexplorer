import { Button, cn, ScrollArea } from '@4d/ui'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  RefreshCw,
  SkipForward,
  Sparkles,
  Star,
} from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  type DesktopReleaseRef,
  listDesktopReleases,
  normalizeDesktopVersion,
} from '~/lib/desktop-releases'
import { useDesktopUpdaterStore } from '~/store/desktop-updater'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatPublishedAt(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return null
  }
}

/**
 * Home-screen update surfaces for the connection flow.
 * - `promo`: always-visible version panel with latest CTA + catalog
 * - `inline`: compact strip for the edit/new connection form (only when actionable)
 */
export function ConnectionHomeUpdateCard({ variant = 'promo' }: { variant?: 'promo' | 'inline' }) {
  const { t } = useTranslation()
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [releases, setReleases] = useState<DesktopReleaseRef[] | null>(null)
  const [releasesError, setReleasesError] = useState<string | null>(null)
  const [releasesLoading, setReleasesLoading] = useState(false)

  const phase = useDesktopUpdaterStore((s) => s.phase)
  const currentVersion = useDesktopUpdaterStore((s) => s.currentVersion)
  const latestVersion = useDesktopUpdaterStore((s) => s.latestVersion)
  const channelLatestVersion = useDesktopUpdaterStore((s) => s.channelLatestVersion)
  const releaseNotes = useDesktopUpdaterStore((s) => s.releaseNotes)
  const progress = useDesktopUpdaterStore((s) => s.progress)
  const error = useDesktopUpdaterStore((s) => s.error)
  const skippedVersion = useDesktopUpdaterStore((s) => s.skippedVersion)
  const installingVersion = useDesktopUpdaterStore((s) => s.installingVersion)
  const installUpdate = useDesktopUpdaterStore((s) => s.installUpdate)
  const installVersion = useDesktopUpdaterStore((s) => s.installVersion)
  const relaunch = useDesktopUpdaterStore((s) => s.relaunchApp)
  const skipUpdate = useDesktopUpdaterStore((s) => s.skipUpdate)
  const unskipUpdate = useDesktopUpdaterStore((s) => s.unskipUpdate)
  const checkForUpdates = useDesktopUpdaterStore((s) => s.checkForUpdates)

  const loadReleases = useEffectEvent(async () => {
    setReleasesLoading(true)
    setReleasesError(null)
    try {
      setReleases(await listDesktopReleases())
    } catch (err) {
      setReleasesError(err instanceof Error ? err.message : String(err))
    } finally {
      setReleasesLoading(false)
    }
  })

  useEffect(() => {
    if (!catalogOpen || releases) return
    void loadReleases()
  }, [catalogOpen, releases])

  const actionable =
    phase === 'available' ||
    phase === 'downloading' ||
    phase === 'ready' ||
    phase === 'error' ||
    phase === 'skipped'

  if (variant === 'inline' && !actionable) return null

  const displayCurrent = normalizeDesktopVersion(currentVersion || __APP_VERSION__)
  // Never fall back to the download-stats catalog tip — it can lag behind
  // GitHub `/releases/latest` and wrongly look "newer" than the installed build.
  const channelLatest = channelLatestVersion ?? latestVersion ?? null
  const onLatest =
    phase === 'up-to-date' ||
    (Boolean(channelLatest) &&
      normalizeDesktopVersion(displayCurrent) === normalizeDesktopVersion(channelLatest ?? ''))
  const showInstallLatest =
    phase === 'available' ||
    phase === 'skipped' ||
    (Boolean(channelLatest) && !onLatest && phase !== 'ready' && phase !== 'checking')
  const busy = phase === 'downloading' || phase === 'checking'
  const percent =
    progress?.contentLength != null && progress.contentLength > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.contentLength) * 100))
      : null

  const title =
    phase === 'ready'
      ? t('desktopUpdater.updateReadyTitle')
      : phase === 'downloading'
        ? t('desktopUpdater.downloadingTitle')
        : phase === 'checking'
          ? t('desktopUpdater.checkingTitle')
          : phase === 'error'
            ? t('desktopUpdater.updateFailedTitle')
            : phase === 'skipped'
              ? t('desktopUpdater.skippedTitle', {
                  version: skippedVersion ?? latestVersion ?? '',
                })
              : phase === 'available'
                ? t('desktopUpdater.versionAvailableTitle', {
                    version: latestVersion ?? '',
                  })
                : onLatest
                  ? t('connectionScreen.updateUpToDateTitle')
                  : t('connectionScreen.updateIdleTitle')

  const description =
    phase === 'ready'
      ? t('desktopUpdater.updateReadyDescription')
      : phase === 'downloading'
        ? installingVersion
          ? t('desktopUpdater.downloadingVersionDescription', { version: installingVersion })
          : t('desktopUpdater.downloadingDescription')
        : phase === 'checking'
          ? t('desktopUpdater.checkingDescription')
          : phase === 'error'
            ? t('desktopUpdater.updateFailedDescription')
            : phase === 'skipped'
              ? t('desktopUpdater.skippedDescription')
              : phase === 'available'
                ? t('desktopUpdater.versionAvailableDescription', {
                    currentVersion: displayCurrent,
                  })
                : phase === 'up-to-date' || onLatest
                  ? t('desktopUpdater.upToDatePickDescription')
                  : t('connectionScreen.updatePickDescription')

  const Icon =
    phase === 'ready'
      ? RefreshCw
      : phase === 'downloading' || phase === 'checking'
        ? Loader2
        : phase === 'skipped'
          ? SkipForward
          : phase === 'up-to-date' || (phase === 'idle' && onLatest)
            ? CheckCircle2
            : phase === 'available'
              ? Download
              : Sparkles

  if (variant === 'inline') {
    const inlineLabel =
      phase === 'available' && latestVersion
        ? t('connectionScreen.updateInlineAvailable', { version: latestVersion })
        : phase === 'ready' && latestVersion
          ? t('connectionScreen.updateInlineReady', { version: latestVersion })
          : phase === 'downloading'
            ? percent != null
              ? t('desktopUpdater.downloadingPercent', { percent })
              : t('desktopUpdater.toolbarDownloading')
            : phase === 'skipped' && (skippedVersion || latestVersion)
              ? t('desktopUpdater.skippedTitle', {
                  version: skippedVersion ?? latestVersion ?? '',
                })
              : title

    return (
      <div
        aria-live="polite"
        className={cn(
          'flex items-center gap-2.5 rounded-md border px-3 py-2',
          phase === 'error' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border bg-muted',
            phase === 'error' ? 'border-destructive/25 text-destructive' : 'text-muted-foreground'
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-snug">
            <span className="font-medium">{inlineLabel}</span>
            {phase === 'available' ? (
              <span className="ml-1.5 text-muted-foreground">
                {t('connectionScreen.updateInlineHint', { currentVersion: displayCurrent })}
              </span>
            ) : null}
          </p>
          {phase === 'downloading' ? (
            <div className="relative mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              {percent != null ? (
                <div
                  className="updater-progress-determinate h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="updater-progress-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-primary" />
              )}
            </div>
          ) : null}
        </div>
        {phase === 'available' ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 shrink-0 gap-1 px-2 text-[11px]"
            onClick={() => installUpdate()}
            disabled={busy}
          >
            <Download className="h-3 w-3" />
            {t('desktopUpdater.updateNow')}
          </Button>
        ) : null}
        {phase === 'ready' ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 shrink-0 gap-1 px-2 text-[11px]"
            onClick={() => relaunch()}
          >
            <RefreshCw className="h-3 w-3" />
            {t('desktopUpdater.toolbarRestart')}
          </Button>
        ) : null}
        {phase === 'skipped' ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-[11px] text-muted-foreground"
            onClick={() => installUpdate()}
            disabled={busy}
          >
            {t('desktopUpdater.installAnyway')}
          </Button>
        ) : null}
        {phase === 'error' ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-[11px]"
            onClick={() => checkForUpdates()}
          >
            {t('desktopUpdater.retry')}
          </Button>
        ) : null}
      </div>
    )
  }

  const catalogReleases = (releases ?? []).slice(0, 12)

  return (
    <section
      aria-live="polite"
      className={cn(
        'relative overflow-hidden rounded-md border bg-card shadow-xs',
        phase === 'error'
          ? 'border-destructive/40'
          : phase === 'ready' || onLatest
            ? 'border-border'
            : phase === 'available'
              ? 'border-border'
              : 'border-border'
      )}
    >
      <div className="relative p-4">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted',
              phase === 'error'
                ? 'border-destructive/30 text-destructive'
                : phase === 'ready' || onLatest
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground'
            )}
          >
            <Icon className={cn('h-5 w-5', busy && 'animate-spin')} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm tracking-tight">{title}</p>
              {phase === 'available' ? (
                <span className="inline-flex items-center gap-1 rounded-sm border bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" />
                  {t('connectionScreen.updateNewBadge')}
                </span>
              ) : null}
              {onLatest && phase !== 'available' && phase !== 'downloading' ? (
                <span className="inline-flex items-center gap-1 rounded-sm border bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t('desktopUpdater.badgeLatest')}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-sm border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {t('desktopUpdater.currentLabel')}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs tabular-nums">{displayCurrent}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
          <div
            className={cn(
              'rounded-sm border px-3 py-2.5',
              phase === 'skipped' ? 'border-border bg-muted/40' : 'border-border bg-muted/30'
            )}
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {t('desktopUpdater.latestLabel')}
            </p>
            <p
              className={cn(
                'mt-0.5 truncate font-mono text-xs tabular-nums',
                phase === 'skipped' && 'line-through opacity-70'
              )}
            >
              {channelLatest ?? '—'}
            </p>
          </div>
        </div>

        {phase === 'available' && releaseNotes ? (
          <div className="mt-3 space-y-1">
            <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
              {t('desktopUpdater.releaseNotes')}
            </p>
            <div className="max-h-20 overflow-y-auto whitespace-pre-wrap rounded-sm border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
              {releaseNotes}
            </div>
          </div>
        ) : null}

        {phase === 'downloading' || phase === 'checking' ? (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-muted-foreground">
                {phase === 'checking'
                  ? t('desktopUpdater.checkingStatus')
                  : percent != null
                    ? t('desktopUpdater.downloadingPercent', { percent })
                    : progress
                      ? t('desktopUpdater.downloadingBytes', {
                          downloaded: formatBytes(progress.downloaded),
                        })
                      : t('desktopUpdater.startingDownload')}
              </span>
              {phase === 'downloading' && percent != null ? (
                <span className="font-mono tabular-nums">{percent}%</span>
              ) : null}
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              {phase === 'downloading' && percent != null ? (
                <div
                  className="updater-progress-determinate h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="updater-progress-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-primary" />
              )}
            </div>
          </div>
        ) : null}

        {phase === 'error' && error ? (
          <p className="mt-3 rounded-sm border border-destructive/35 bg-destructive/10 px-3 py-2 text-[11px] text-destructive leading-relaxed">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {showInstallLatest ? (
            <Button
              size="sm"
              className="h-6 gap-1 px-2"
              onClick={() => {
                if (
                  latestVersion === channelLatest ||
                  phase === 'available' ||
                  phase === 'skipped'
                ) {
                  installUpdate()
                } else if (channelLatest) {
                  installVersion(channelLatest)
                }
              }}
              disabled={busy}
            >
              <Star className="h-3.5 w-3.5 fill-current" />
              {t('desktopUpdater.installLatest')}
            </Button>
          ) : null}
          {phase === 'ready' ? (
            <Button size="sm" className="h-6 gap-1 px-2" onClick={() => relaunch()}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('desktopUpdater.restartNow')}
            </Button>
          ) : null}
          {phase === 'available' ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-muted-foreground"
              onClick={() => skipUpdate()}
              disabled={busy}
            >
              {t('desktopUpdater.skipVersion')}
            </Button>
          ) : null}
          {phase === 'skipped' ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-muted-foreground"
              onClick={() => unskipUpdate()}
            >
              {t('desktopUpdater.unskip')}
            </Button>
          ) : null}
          {phase === 'error' ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 gap-1 px-2"
              onClick={() => checkForUpdates()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('desktopUpdater.retry')}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-6 gap-1 px-2 text-[11px]"
            onClick={() => setCatalogOpen((o) => !o)}
            disabled={busy && phase === 'downloading'}
            aria-expanded={catalogOpen}
          >
            {catalogOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {t('connectionScreen.browseVersions')}
          </Button>
        </div>

        {catalogOpen ? (
          <div className="mt-3 overflow-hidden rounded-md border border-border/70 bg-background/50">
            <div className="flex items-center justify-between gap-2 border-border/60 border-b px-3 py-2">
              <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                {t('desktopUpdater.versionCatalog')}
              </p>
              <button
                type="button"
                className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => void loadReleases()}
                disabled={releasesLoading || busy}
              >
                {t('desktopUpdater.refreshCatalog')}
              </button>
            </div>
            {releasesLoading && !releases ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                {t('desktopUpdater.loadingCatalog')}
              </div>
            ) : releasesError ? (
              <p className="px-3 py-2.5 text-[11px] text-destructive">{releasesError}</p>
            ) : catalogReleases.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                {t('desktopUpdater.noVersions')}
              </p>
            ) : (
              <ScrollArea className="h-36">
                <ul className="divide-y divide-border/60">
                  {catalogReleases.map((release) => {
                    const isCurrent =
                      normalizeDesktopVersion(release.version) ===
                      normalizeDesktopVersion(displayCurrent)
                    const isChannelLatest =
                      channelLatest != null &&
                      normalizeDesktopVersion(release.version) ===
                        normalizeDesktopVersion(channelLatest)
                    const published = formatPublishedAt(release.publishedAt)
                    return (
                      <li key={release.tag}>
                        <div
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5',
                            isChannelLatest && 'bg-primary/5'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[11px] tabular-nums">
                                {release.version}
                              </span>
                              {isChannelLatest ? (
                                <span className="rounded bg-primary/15 px-1 py-px font-medium text-[9px] text-primary uppercase">
                                  {t('desktopUpdater.badgeLatest')}
                                </span>
                              ) : null}
                              {isCurrent ? (
                                <span className="rounded bg-muted px-1 py-px font-medium text-[9px] text-muted-foreground uppercase">
                                  {t('desktopUpdater.badgeCurrent')}
                                </span>
                              ) : null}
                            </div>
                            {published ? (
                              <p className="text-[10px] text-muted-foreground">{published}</p>
                            ) : null}
                          </div>
                          <Button
                            size="sm"
                            variant={isChannelLatest && !isCurrent ? 'default' : 'outline'}
                            className="h-6 shrink-0 px-2 text-[10px]"
                            disabled={busy}
                            onClick={() => {
                              if (isChannelLatest && latestVersion === release.version) {
                                installUpdate()
                              } else {
                                installVersion(release.version)
                              }
                            }}
                          >
                            <Download className="size-3" />
                            {isCurrent
                              ? t('desktopUpdater.reinstall')
                              : t('desktopUpdater.install')}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
