import { Button, cn, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@4d/ui'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  SkipForward,
  Sparkles,
  Star,
} from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from '~/i18n'
import {
  DESKTOP_RELEASES_INDEX_URL,
  type DesktopReleaseRef,
  listDesktopReleases,
  normalizeDesktopVersion,
} from '~/lib/desktop-releases'
import { isDesktopShell } from '~/lib/platform'
import { type DesktopUpdaterPhase, useDesktopUpdaterStore } from '~/store/desktop-updater'

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

function formatCheckedAt(timestamp: number | null, fallback: string): string {
  if (!timestamp) return fallback
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return fallback
  }
}

function formatPublishedAt(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return null
  }
}

function TriggerIcon({ phase }: { phase: DesktopUpdaterPhase }) {
  const className = 'h-3 w-3'
  if (phase === 'checking' || phase === 'downloading') {
    return <Loader2 className={cn(className, 'animate-spin')} />
  }
  if (phase === 'ready') return <RefreshCw className={className} />
  if (phase === 'available') return <Download className={className} />
  if (phase === 'up-to-date') return <CheckCircle2 className={className} />
  if (phase === 'skipped') return <SkipForward className={className} />
  if (phase === 'error') return <AlertTriangle className={className} />
  return <Sparkles className={className} />
}

function triggerChrome(phase: DesktopUpdaterPhase): {
  variant: 'default' | 'ghost' | 'secondary'
  className: string
} {
  switch (phase) {
    case 'ready':
      return {
        variant: 'default',
        className: 'font-medium shadow-sm',
      }
    case 'available':
      return {
        variant: 'secondary',
        className: 'text-foreground',
      }
    case 'downloading':
    case 'checking':
      return {
        variant: 'secondary',
        className: 'text-foreground',
      }
    case 'error':
      return {
        variant: 'secondary',
        className: 'text-destructive',
      }
    case 'skipped':
      return {
        variant: 'ghost',
        className: 'text-muted-foreground',
      }
    case 'up-to-date':
      return {
        variant: 'ghost',
        className: 'text-muted-foreground',
      }
    default:
      return {
        variant: 'ghost',
        className: 'text-muted-foreground',
      }
  }
}

/** Always-visible desktop status-bar control for checking and applying updates. */
export function DesktopUpdateFooterControl() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [query, setQuery] = useState('')
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
  const lastCheckedAt = useDesktopUpdaterStore((s) => s.lastCheckedAt)
  const skippedVersion = useDesktopUpdaterStore((s) => s.skippedVersion)
  const installingVersion = useDesktopUpdaterStore((s) => s.installingVersion)
  const checkForUpdates = useDesktopUpdaterStore((s) => s.checkForUpdates)
  const installUpdate = useDesktopUpdaterStore((s) => s.installUpdate)
  const installVersion = useDesktopUpdaterStore((s) => s.installVersion)
  const relaunch = useDesktopUpdaterStore((s) => s.relaunchApp)
  const skipUpdate = useDesktopUpdaterStore((s) => s.skipUpdate)
  const unskipUpdate = useDesktopUpdaterStore((s) => s.unskipUpdate)

  const loadReleases = useEffectEvent(async () => {
    setReleasesLoading(true)
    setReleasesError(null)
    try {
      const list = await listDesktopReleases()
      setReleases(list)
    } catch (err) {
      setReleasesError(err instanceof Error ? err.message : String(err))
    } finally {
      setReleasesLoading(false)
    }
  })

  useEffect(() => {
    if (!catalogOpen) return
    if (releases) return
    void loadReleases()
  }, [catalogOpen, releases])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      checkForUpdates()
    } else {
      setCatalogOpen(false)
      setQuery('')
    }
  }

  if (!isDesktopShell()) return null

  const chrome = triggerChrome(phase)
  const busy = phase === 'checking' || phase === 'downloading'
  const displayCurrent = normalizeDesktopVersion(currentVersion || __APP_VERSION__)
  const channelLatest = channelLatestVersion ?? latestVersion ?? null
  const onLatest =
    phase === 'up-to-date' ||
    (Boolean(channelLatest) &&
      normalizeDesktopVersion(displayCurrent) === normalizeDesktopVersion(channelLatest ?? ''))
  const showInstallLatest =
    Boolean(channelLatest) &&
    !onLatest &&
    phase !== 'ready' &&
    phase !== 'downloading' &&
    phase !== 'checking'
  const percent =
    progress?.contentLength != null && progress.contentLength > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.contentLength) * 100))
      : null

  const triggerLabel =
    phase === 'ready'
      ? t('desktopUpdater.toolbarRestart')
      : phase === 'downloading'
        ? t('desktopUpdater.toolbarDownloading')
        : phase === 'available'
          ? t('desktopUpdater.toolbarUpdate')
          : phase === 'skipped'
            ? t('desktopUpdater.toolbarSkipped')
            : phase === 'up-to-date'
              ? t('desktopUpdater.toolbarUpToDate')
              : phase === 'checking'
                ? t('desktopUpdater.toolbarChecking')
                : phase === 'error'
                  ? t('desktopUpdater.toolbarError')
                  : t('desktopUpdater.toolbarIdle')

  const triggerAria =
    phase === 'available' && latestVersion
      ? t('desktopUpdater.toolbarUpdateAria', { version: latestVersion })
      : phase === 'ready' && latestVersion
        ? t('desktopUpdater.toolbarRestartAria', { version: latestVersion })
        : phase === 'downloading' && (installingVersion || latestVersion)
          ? t('desktopUpdater.toolbarDownloadingAria', {
              version: installingVersion ?? latestVersion ?? '',
            })
          : phase === 'skipped' && (skippedVersion || latestVersion)
            ? t('desktopUpdater.toolbarSkippedAria', {
                version: skippedVersion ?? latestVersion ?? '',
              })
            : t('desktopUpdater.toolbarIdleAria')

  const statusTitle =
    phase === 'ready'
      ? t('desktopUpdater.updateReadyTitle')
      : phase === 'checking'
        ? t('desktopUpdater.checkingTitle')
        : phase === 'downloading'
          ? t('desktopUpdater.downloadingTitle')
          : phase === 'up-to-date'
            ? t('desktopUpdater.upToDateTitle')
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
                  : t('desktopUpdater.idleTitle')

  const statusDescription =
    phase === 'ready'
      ? t('desktopUpdater.updateReadyDescription')
      : phase === 'checking'
        ? t('desktopUpdater.checkingDescription')
        : phase === 'downloading'
          ? installingVersion
            ? t('desktopUpdater.downloadingVersionDescription', {
                version: installingVersion,
              })
            : t('desktopUpdater.downloadingDescription')
          : phase === 'up-to-date'
            ? t('desktopUpdater.upToDatePickDescription')
            : phase === 'error'
              ? t('desktopUpdater.updateFailedDescription')
              : phase === 'skipped'
                ? t('desktopUpdater.skippedDescription')
                : phase === 'available'
                  ? t('desktopUpdater.versionAvailableDescription', {
                      currentVersion: displayCurrent,
                    })
                  : t('desktopUpdater.idlePickDescription')

  const progressLabel =
    phase === 'checking'
      ? t('desktopUpdater.checkingStatus')
      : percent != null
        ? t('desktopUpdater.downloadingPercent', { percent })
        : progress
          ? t('desktopUpdater.downloadingBytes', {
              downloaded: formatBytes(progress.downloaded),
            })
          : t('desktopUpdater.startingDownload')

  const checkedLabel = formatCheckedAt(lastCheckedAt, t('desktopUpdater.neverChecked'))
  const q = query.trim().toLowerCase()
  const filteredReleases =
    releases?.filter((r) => {
      if (!q) return true
      return r.version.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q)
    }) ?? []

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={chrome.variant}
          size="sm"
          className={cn('relative h-6 gap-1.5 px-2 text-[11px]', chrome.className)}
          aria-label={triggerAria}
          aria-expanded={open}
          title={t('desktopUpdater.toolbarTooltip')}
        >
          <TriggerIcon phase={phase} />
          <span>{triggerLabel}</span>
          {phase === 'available' && latestVersion ? (
            <span className="font-mono text-primary tabular-nums">v{latestVersion}</span>
          ) : null}
          {phase === 'skipped' && (skippedVersion || latestVersion) ? (
            <span className="font-mono tabular-nums line-through opacity-70">
              v{skippedVersion ?? latestVersion}
            </span>
          ) : null}
          {phase === 'available' ? (
            <span
              className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-90 overflow-hidden border-border/70 p-0 shadow-lg"
      >
        <div className="relative overflow-hidden bg-primary/10 px-4 pt-4 pb-3">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 12% 0%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 55%)',
            }}
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border shadow-sm',
                phase === 'error'
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : phase === 'up-to-date' || phase === 'ready'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                    : 'border-primary/30 bg-primary/10 text-primary'
              )}
            >
              <TriggerIcon phase={phase} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium text-sm/snug tracking-tight">{statusTitle}</p>
              <p className="text-muted-foreground text-xs/relaxed">{statusDescription}</p>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="rounded-md border border-border/60 bg-background/80 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {t('desktopUpdater.currentLabel')}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums">{displayCurrent}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
            <div
              className={cn(
                'rounded-md border px-2.5 py-2',
                onLatest
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : 'border-primary/25 bg-primary/5'
              )}
            >
              <p
                className={cn(
                  'text-[10px] uppercase tracking-wide',
                  onLatest ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'
                )}
              >
                {t('desktopUpdater.latestLabel')}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums">
                {channelLatest ?? '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          {phase === 'available' && releaseNotes ? (
            <div className="space-y-1">
              <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                {t('desktopUpdater.releaseNotes')}
              </p>
              <div className="max-h-16 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 text-[11px]/relaxed text-muted-foreground">
                {releaseNotes}
              </div>
            </div>
          ) : null}

          {phase === 'downloading' || phase === 'checking' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-muted-foreground">{progressLabel}</span>
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

          {phase === 'ready' ? (
            <p className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 text-[11px]/relaxed text-muted-foreground">
              {t('desktopUpdater.restartHint')}
            </p>
          ) : null}

          {phase === 'error' && error ? (
            <p className="rounded-md border border-destructive/35 bg-destructive/10 px-2.5 py-2 text-[11px]/relaxed text-destructive">
              {error}
            </p>
          ) : null}

          {/* Primary latest CTA — hidden when Tauri reports up-to-date */}
          {showInstallLatest ? (
            <Button
              size="sm"
              className="h-8 w-full justify-between text-[11px]"
              onClick={() => {
                if (phase === 'skipped' && skippedVersion === channelLatest) {
                  installUpdate()
                } else if (latestVersion === channelLatest) {
                  installUpdate()
                } else if (channelLatest) {
                  installVersion(channelLatest)
                }
              }}
              disabled={busy}
            >
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5 fill-current" />
                {t('desktopUpdater.installLatest')}
              </span>
              <span className="font-mono tabular-nums opacity-90">v{channelLatest}</span>
            </Button>
          ) : null}

          {phase === 'ready' ? (
            <Button size="sm" className="h-8 w-full text-[11px]" onClick={relaunch}>
              <RefreshCw className="size-3" />
              {t('desktopUpdater.restartNow')}
            </Button>
          ) : null}

          {/* Version catalog — on demand */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full justify-between text-[11px]"
            onClick={() => setCatalogOpen((v) => !v)}
            disabled={busy && phase === 'downloading'}
            aria-expanded={catalogOpen}
          >
            <span className="inline-flex items-center gap-1.5">
              {catalogOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {t('desktopUpdater.browseVersions')}
            </span>
            {catalogOpen ? (
              <span className="text-muted-foreground">{t('desktopUpdater.hideCatalog')}</span>
            ) : null}
          </Button>

          {catalogOpen ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
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

              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('desktopUpdater.searchVersions')}
                  className="h-7 w-full rounded-md border border-border/70 bg-background pr-2.5 pl-7 text-[11px] outline-none ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={busy}
                />
              </div>

              <div className="overflow-hidden rounded-md border border-border/70">
                {releasesLoading && !releases ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    {t('desktopUpdater.loadingCatalog')}
                  </div>
                ) : releasesError ? (
                  <div className="space-y-2 px-3 py-3">
                    <p className="text-[11px] text-destructive">{releasesError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => void loadReleases()}
                    >
                      <RotateCcw className="size-3" />
                      {t('desktopUpdater.retry')}
                    </Button>
                  </div>
                ) : filteredReleases.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                    {t('desktopUpdater.noVersions')}
                  </p>
                ) : (
                  <ScrollArea className="h-40">
                    <ul className="divide-y divide-border/60">
                      {filteredReleases.map((release) => {
                        const isCurrent =
                          normalizeDesktopVersion(release.version) ===
                          normalizeDesktopVersion(displayCurrent)
                        const isChannelLatest =
                          channelLatest != null &&
                          normalizeDesktopVersion(release.version) ===
                            normalizeDesktopVersion(channelLatest)
                        const published = formatPublishedAt(release.publishedAt)
                        const installingThis =
                          installingVersion != null &&
                          normalizeDesktopVersion(installingVersion) ===
                            normalizeDesktopVersion(release.version) &&
                          (phase === 'downloading' || phase === 'checking')

                        return (
                          <li key={release.tag}>
                            <div
                              className={cn(
                                'flex items-center gap-2 px-2.5 py-1.5 transition-colors',
                                isChannelLatest && 'bg-primary/5',
                                isCurrent && !isChannelLatest && 'bg-muted/30'
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-[11px] tabular-nums">
                                    {release.version}
                                  </span>
                                  {isChannelLatest ? (
                                    <span className="rounded bg-primary/15 px-1 py-px font-medium text-[9px] text-primary uppercase tracking-wide">
                                      {t('desktopUpdater.badgeLatest')}
                                    </span>
                                  ) : null}
                                  {isCurrent ? (
                                    <span className="rounded bg-muted px-1 py-px font-medium text-[9px] text-muted-foreground uppercase tracking-wide">
                                      {t('desktopUpdater.badgeCurrent')}
                                    </span>
                                  ) : null}
                                </div>
                                {published ? (
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    {published}
                                  </p>
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
                                {installingThis ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Download className="size-3" />
                                )}
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
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            {phase === 'available' ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground"
                onClick={() => {
                  skipUpdate()
                }}
                disabled={busy}
              >
                <SkipForward className="size-3" />
                {t('desktopUpdater.skipVersion')}
              </Button>
            ) : null}

            {phase === 'skipped' ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  unskipUpdate()
                }}
                disabled={busy}
              >
                {t('desktopUpdater.unskip')}
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-[11px]"
              onClick={checkForUpdates}
              disabled={busy}
            >
              <RotateCcw className="size-3" />
              {phase === 'error' ? t('desktopUpdater.retry') : t('desktopUpdater.checkAgain')}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground/80">
            <span>{t('desktopUpdater.lastChecked', { time: checkedLabel })}</span>
            <a
              href={DESKTOP_RELEASES_INDEX_URL}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {t('desktopUpdater.viewOnGitHub')}
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
