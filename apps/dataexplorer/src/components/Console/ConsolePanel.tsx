import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import {
  AlertCircle,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleAlert,
  Filter,
  Globe2,
  Info,
  ListTree,
  Radio,
  Send,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '~/i18n'
import { mapNetworkDetailsToSeed } from '~/lib/network-to-http-seed'
import { parseDecodedQueryParams } from '~/lib/parse-decoded-query-params'
import { isMobileShell } from '~/lib/platform'
import type { ConsoleEntry, ConsoleFilter, NetworkDetails } from '~/store/console'
import { useConsoleStore } from '~/store/console'
import { useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { ConsoleValue, ObjectTree } from './ObjectTree'

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23)
}

function LevelIcon({ entry }: { entry: ConsoleEntry }) {
  if (entry.level === 'error') return <CircleAlert className="h-3.5 w-3.5 text-destructive" />
  if (entry.level === 'warn') return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
  if (entry.level === 'info') return <Info className="h-3.5 w-3.5 text-blue-500" />
  if (entry.level === 'network') return <Globe2 className="h-3.5 w-3.5 text-cyan-600" />
  return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
}

function InlineValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? <span>{value}</span> : <ConsoleValue value={value} />
}

function ArgumentValues({ values }: { values: unknown[] }) {
  const [items] = useState(() =>
    values.map((value) => ({
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      value,
    }))
  )
  return items.map((item) => <InlineValue key={item.id} value={item.value} />)
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb < 10 ? kb.toFixed(1) : kb.toFixed(0)} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`
}

function splitNetworkUrl(url: string): { origin: string; pathWithQuery: string } {
  try {
    const parsed = new URL(url)
    return {
      origin: parsed.origin,
      pathWithQuery: `${parsed.pathname}${parsed.search}${parsed.hash}` || '/',
    }
  } catch {
    return { origin: '', pathWithQuery: url }
  }
}

function networkMethodToneClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
    case 'POST':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'PUT':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
    case 'PATCH':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    case 'HEAD':
    case 'OPTIONS':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-foreground'
  }
}

function NetworkEntry({
  details,
  open,
  timestamp,
}: {
  details: NetworkDetails
  open: boolean
  timestamp?: number
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const openHttpClientTab = useTabsStore((state) => state.openHttpClientTab)
  const setConsoleOpen = useSettingsStore((state) => state.setConsoleOpen)
  const [sectionsEpoch, setSectionsEpoch] = useState(0)
  const [sectionsExpanded, setSectionsExpanded] = useState(open)
  const rootRef = useRef<HTMLDivElement>(null)
  const failed =
    details.error !== undefined || (details.status !== undefined && details.status >= 400)
  const queryParams = open ? parseDecodedQueryParams(details.url) : null
  const { origin, pathWithQuery } = splitNetworkUrl(details.url)
  const hostLabel = origin ? origin.replace(/^https?:\/\//, '') : ''

  useLayoutEffect(() => {
    if (!open) return
    const el = rootRef.current
    if (!el) return

    const container = el.closest<HTMLElement>('[data-console-scroll]')
    if (!container) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }

    const elRect = el.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const overflowsBottom = elRect.bottom > containerRect.bottom - 4
    const overflowsTop = elRect.top < containerRect.top + 4
    if (!overflowsBottom && !overflowsTop) return

    // Pin the entry header near the top so as much detail as possible is visible.
    const nextTop = container.scrollTop + (elRect.top - containerRect.top) - 4
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [open])

  const expandAllSections = () => {
    setSectionsExpanded(true)
    setSectionsEpoch((epoch) => epoch + 1)
  }

  const collapseAllSections = () => {
    setSectionsExpanded(false)
    setSectionsEpoch((epoch) => epoch + 1)
  }

  const openInHttpClient = (event: ReactMouseEvent) => {
    event.stopPropagation()
    openHttpClientTab(mapNetworkDetailsToSeed(details))
    if (mobile) setConsoleOpen(false)
  }

  const statusBadge =
    details.status !== undefined ? (
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-px font-semibold text-[10px] tabular-nums',
          failed
            ? 'bg-destructive/15 text-destructive'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        )}
      >
        {details.status}
      </span>
    ) : details.error !== undefined ? (
      <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-px font-semibold text-[10px] text-destructive">
        ERR
      </span>
    ) : null

  const sendButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-network-send
            className={cn(
              'shrink-0 text-muted-foreground hover:text-foreground',
              mobile
                ? 'h-8 w-8 opacity-100'
                : 'h-4 w-4 opacity-100 sm:opacity-0 sm:group-hover/network:opacity-100 sm:group-focus-within/network:opacity-100'
            )}
            onClick={openInHttpClient}
            aria-label={t('console.openInHttpClient')}
          >
            <Send className={mobile ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('console.openInHttpClient')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div ref={rootRef} className="group/network min-w-0 flex-1">
      {mobile ? (
        <div className="flex w-full min-w-0 gap-2">
          <div
            aria-hidden="true"
            className={cn(
              'mt-1 h-8 w-0.5 shrink-0 rounded-full',
              failed ? 'bg-destructive' : 'bg-emerald-500/60'
            )}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
                  open && 'rotate-90'
                )}
              />
              <span
                className={cn(
                  'rounded px-1.5 py-px font-semibold text-[10px] uppercase tracking-wide',
                  networkMethodToneClass(details.method)
                )}
              >
                {details.method}
              </span>
              {statusBadge}
              <span
                className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
                title={details.url}
              >
                {pathWithQuery}
              </span>
              {sendButton}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 text-[10px] text-muted-foreground tabular-nums">
              <span>{details.durationMs.toFixed(0)} ms</span>
              {details.responseSizeBytes !== undefined ? (
                <span>{formatByteSize(details.responseSizeBytes)}</span>
              ) : null}
              {hostLabel ? (
                <span className="min-w-0 truncate font-mono" title={origin}>
                  {hostLabel}
                </span>
              ) : null}
              {timestamp !== undefined ? (
                <time dateTime={new Date(timestamp).toISOString()} className="ml-auto shrink-0">
                  {formatTimestamp(timestamp)}
                </time>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-1.5">
          <div
            aria-hidden="true"
            className={cn(
              'h-3.5 w-0.5 shrink-0 rounded-full',
              failed ? 'bg-destructive' : 'bg-emerald-500/60'
            )}
          />

          <span className="flex shrink-0 items-center gap-1">
            <ChevronRight
              className={cn(
                'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
                open && 'rotate-90'
              )}
            />
            <span
              className={cn(
                'rounded px-1.5 py-px font-semibold text-[10px] uppercase tracking-wide',
                networkMethodToneClass(details.method)
              )}
            >
              {details.method}
            </span>
          </span>

          {statusBadge}

          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,max-content)_auto_minmax(0.5rem,1fr)_auto] items-center gap-x-1">
            <span
              className="min-w-0 truncate px-0.5 font-mono text-[11px] text-foreground"
              title={details.url}
            >
              {pathWithQuery}
            </span>

            <div className="flex shrink-0 items-center gap-0.5">
              <span className="rounded bg-muted/80 px-1.5 py-px text-[10px] text-muted-foreground tabular-nums">
                {details.durationMs.toFixed(0)} ms
              </span>
              {details.responseSizeBytes !== undefined ? (
                <span className="rounded bg-muted/80 px-1.5 py-px text-[10px] text-muted-foreground tabular-nums">
                  {formatByteSize(details.responseSizeBytes)}
                </span>
              ) : null}
              {sendButton}
            </div>

            <div aria-hidden="true" />

            {hostLabel ? (
              <span
                className="max-w-[10rem] justify-self-end truncate font-mono text-[10px] text-muted-foreground"
                title={origin}
              >
                {hostLabel}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}

      {open ? (
        <div
          data-network-details
          className={cn(
            'fade-in-0 slide-in-from-top-1 mt-0.5 animate-in space-y-0 border-border/40 border-l pb-0.5 pl-2 duration-150',
            mobile ? 'ml-3' : 'ml-2'
          )}
        >
          <div className="mb-0.5 flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'gap-1 text-[10px] text-muted-foreground',
                mobile ? 'h-8 px-2' : 'h-5 px-1.5'
              )}
              onClick={expandAllSections}
            >
              <ChevronsUpDown className="h-3 w-3" />
              {t('console.expandAll')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'gap-1 text-[10px] text-muted-foreground',
                mobile ? 'h-8 px-2' : 'h-5 px-1.5'
              )}
              onClick={collapseAllSections}
            >
              <ChevronsDownUp className="h-3 w-3" />
              {t('console.collapseAll')}
            </Button>
          </div>
          {queryParams ? (
            <ObjectTree
              key={`${sectionsEpoch}-query`}
              label={t('console.queryParams')}
              value={queryParams}
              defaultOpen={sectionsExpanded}
            />
          ) : null}
          <ObjectTree
            key={`${sectionsEpoch}-req-headers`}
            label={t('console.requestHeaders')}
            value={details.requestHeaders}
            defaultOpen={sectionsExpanded}
          />
          {details.requestBody !== undefined ? (
            <ObjectTree
              key={`${sectionsEpoch}-req-body`}
              label={t('console.requestBody')}
              value={details.requestBody}
              defaultOpen={sectionsExpanded}
            />
          ) : null}
          {details.responseHeaders !== undefined ? (
            <ObjectTree
              key={`${sectionsEpoch}-res-headers`}
              label={t('console.responseHeaders')}
              value={details.responseHeaders}
              defaultOpen={sectionsExpanded}
            />
          ) : null}
          {details.responseBody !== undefined ? (
            <ObjectTree
              key={`${sectionsEpoch}-res-body`}
              label={t('console.responseBody')}
              value={details.responseBody}
              defaultOpen={sectionsExpanded}
            />
          ) : null}
          {details.error !== undefined ? (
            <ObjectTree
              key={`${sectionsEpoch}-error`}
              label={t('console.errorDetails')}
              value={details.error}
              defaultOpen={sectionsExpanded}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function LogEntry({
  entry,
  defaultExpanded = false,
}: {
  entry: ConsoleEntry
  defaultExpanded?: boolean
}) {
  const mobile = isMobileShell()
  const [networkOpen, setNetworkOpen] = useState(defaultExpanded)
  const toggleNetwork = (event: ReactMouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-network-details]')) return
    if (target.closest('[data-network-send]')) return
    setNetworkOpen((current) => !current)
  }

  if (entry.network) {
    return (
      // Nested Send control prevents a real <button> wrapper (invalid HTML).
      // biome-ignore lint/a11y/useSemanticElements: row toggles expand; Send is a nested control
      <div
        role="button"
        tabIndex={0}
        aria-expanded={networkOpen}
        className={cn(
          'flex min-w-0 cursor-pointer items-start gap-1.5 border-b font-mono text-xs [content-visibility:auto]',
          mobile
            ? 'px-3 py-2.5 [contain-intrinsic-size:auto_52px]'
            : 'px-2 py-0.5 [contain-intrinsic-size:auto_22px]',
          'transition-colors hover:bg-muted/50',
          failedNetworkBackground(entry)
        )}
        onClick={toggleNetwork}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setNetworkOpen((current) => !current)
          }
        }}
      >
        <NetworkEntry
          details={entry.network}
          open={networkOpen}
          timestamp={mobile ? entry.timestamp : undefined}
        />
        {!mobile ? (
          <time
            dateTime={new Date(entry.timestamp).toISOString()}
            className="mt-0.5 shrink-0 text-[10px] text-muted-foreground"
          >
            {formatTimestamp(entry.timestamp)}
          </time>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-1.5 border-b font-mono text-xs [content-visibility:auto]',
        mobile
          ? 'flex-col px-3 py-2.5 [contain-intrinsic-size:auto_44px]'
          : 'items-center px-2 py-0.5 [contain-intrinsic-size:auto_22px]',
        'transition-colors hover:bg-muted/50',
        entry.level === 'error' && 'bg-destructive/5 hover:bg-destructive/10',
        entry.level === 'warn' && 'bg-amber-500/5 hover:bg-amber-500/10'
      )}
    >
      <div className={cn('flex w-full min-w-0 gap-1.5', mobile ? 'items-start' : 'items-center')}>
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          <LevelIcon entry={entry} />
        </span>
        <div className="wrap-break-word min-w-0 flex-1 space-x-2">
          <InlineValue value={entry.message} />
          {entry.args ? <ArgumentValues values={entry.args} /> : null}
        </div>
        {!mobile ? (
          <time
            dateTime={new Date(entry.timestamp).toISOString()}
            className="shrink-0 text-[10px] text-muted-foreground"
          >
            {formatTimestamp(entry.timestamp)}
          </time>
        ) : null}
      </div>
      {mobile ? (
        <time
          dateTime={new Date(entry.timestamp).toISOString()}
          className="pl-5 text-[10px] text-muted-foreground"
        >
          {formatTimestamp(entry.timestamp)}
        </time>
      ) : null}
    </div>
  )
}

function failedNetworkBackground(entry: ConsoleEntry): string | false {
  const details = entry.network
  if (!details) return false
  const failed =
    details.error !== undefined || (details.status !== undefined && details.status >= 400)
  return failed && 'bg-destructive/[0.03] hover:bg-destructive/10'
}

const FILTERS: ConsoleFilter[] = ['all', 'log', 'info', 'warn', 'error', 'network']

function ConsoleEmptyState({
  hasEntries,
  filter,
  onClearFilter,
}: {
  hasEntries: boolean
  filter: ConsoleFilter
  onClearFilter: () => void
}) {
  const { t } = useTranslation()
  const filtered = hasEntries && filter !== 'all'

  return (
    <div className="relative flex h-full min-h-[8rem] items-center justify-center overflow-hidden px-4">
      <div className="relative flex max-w-sm flex-col items-center text-center">
        <div className="relative mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 shadow-sm">
            {filtered ? (
              <Filter className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Terminal className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-background shadow-sm">
            {filtered ? (
              <ListTree className="h-3 w-3 text-amber-500" />
            ) : (
              <Radio className="h-3 w-3 text-cyan-500" />
            )}
          </span>
        </div>

        <p className="font-medium text-sm">
          {filtered ? t('console.noMatchesTitle') : t('console.emptyTitle')}
        </p>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          {filtered
            ? t('console.noMatches', {
                filter: t(`console.filter${filter[0].toUpperCase()}${filter.slice(1)}`),
              })
            : t('console.empty')}
        </p>

        {filtered ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 h-7 gap-1.5 text-xs"
            onClick={onClearFilter}
          >
            <Filter className="h-3 w-3" />
            {t('console.clearFilter')}
          </Button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              <Globe2 className="h-3 w-3 text-cyan-600" />
              {t('console.hintNetwork')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              <ListTree className="h-3 w-3 text-sky-500" />
              {t('console.hintObjects')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ConsolePanel() {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const entries = useConsoleStore((state) => state.entries)
  const filter = useConsoleStore((state) => state.filter)
  const setFilter = useConsoleStore((state) => state.setFilter)
  const clear = useConsoleStore((state) => state.clear)
  const setConsoleOpen = useSettingsStore((state) => state.setConsoleOpen)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const [viewEpoch, setViewEpoch] = useState(0)
  const [entriesExpanded, setEntriesExpanded] = useState(false)

  const filteredEntries =
    filter === 'all' ? entries : entries.filter((entry) => entry.level === filter)
  const lastEntryId = filteredEntries[filteredEntries.length - 1]?.id

  const collapseAll = () => {
    setEntriesExpanded(false)
    setViewEpoch((epoch) => epoch + 1)
  }

  const expandAll = () => {
    setEntriesExpanded(true)
    setViewEpoch((epoch) => epoch + 1)
  }

  useEffect(() => {
    if (lastEntryId && stickToBottomRef.current) {
      const scrollElement = scrollRef.current
      if (scrollElement) scrollElement.scrollTop = scrollElement.scrollHeight
    }
  }, [lastEntryId])

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col bg-background"
      aria-label={t('console.title')}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b bg-muted/20 px-2',
          mobile ? 'h-11 px-3' : 'h-8'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {mobile ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 shrink-0 gap-1.5 px-2.5 text-sm"
              onClick={() => setConsoleOpen(false)}
              aria-label={t('console.close')}
            >
              <X className="h-4 w-4" aria-hidden />
              {t('console.done')}
            </Button>
          ) : (
            <span className="font-medium text-xs">{t('console.title')}</span>
          )}
          <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground tabular-nums">
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Select value={filter} onValueChange={(value) => setFilter(value as ConsoleFilter)}>
            <SelectTrigger
              className={cn(
                'min-w-28 border-none bg-transparent px-2 shadow-none',
                mobile ? 'h-9 text-xs' : 'h-6 text-[11px]'
              )}
              aria-label={t('console.filter')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {FILTERS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`console.filter${item[0].toUpperCase()}${item.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={mobile ? 'h-9 w-9' : 'h-6 w-6'}
                  onClick={expandAll}
                  disabled={filteredEntries.length === 0}
                  aria-label={t('console.expandAll')}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('console.expandAll')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={mobile ? 'h-9 w-9' : 'h-6 w-6'}
                  onClick={collapseAll}
                  disabled={filteredEntries.length === 0}
                  aria-label={t('console.collapseAll')}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('console.collapseAll')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={mobile ? 'h-9 w-9' : 'h-6 w-6'}
                  onClick={clear}
                  disabled={entries.length === 0}
                  aria-label={t('console.clear')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('console.clear')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {!mobile ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setConsoleOpen(false)}
                    aria-label={t('console.close')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{t('console.close')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        data-console-scroll=""
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(event) => {
          const element = event.currentTarget
          stickToBottomRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 24
        }}
        aria-live="polite"
      >
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <LogEntry
              key={`${entry.id}:${viewEpoch}`}
              entry={entry}
              defaultExpanded={entriesExpanded}
            />
          ))
        ) : (
          <ConsoleEmptyState
            hasEntries={entries.length > 0}
            filter={filter}
            onClearFilter={() => setFilter('all')}
          />
        )}
      </div>
    </section>
  )
}
