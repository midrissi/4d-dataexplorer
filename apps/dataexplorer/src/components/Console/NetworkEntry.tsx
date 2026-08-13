import { Button, cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Loader2, Minus, Send, Square } from 'lucide-react'
import {
  type MouseEvent as ReactMouseEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { TriStateIconButton } from '~/components/TriStateIconButton'
import { useTranslation } from '~/i18n'
import {
  formatByteSize,
  formatConsoleTimestamp,
  formatDecodedPathWithQuery,
  isCancelledNetwork,
  isFailedNetwork,
  isPendingNetwork,
  networkMethodToneClass,
  pathNeedsUrlDecode,
  splitNetworkUrl,
} from '~/lib/console-format'
import { abortNetworkRequest } from '~/lib/network-abort'
import { mapNetworkDetailsToSeed } from '~/lib/network-to-http-seed'
import { isObjectTreeTooLarge } from '~/lib/object-tree-size'
import { parseDecodedQueryParams } from '~/lib/parse-decoded-query-params'
import { isMobileShell } from '~/lib/platform'
import type { NetworkDetails } from '~/store/console'
import { useConsoleStore } from '~/store/console'
import { useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { ConsoleNetworkImageBody } from './ConsoleNetworkImageBody'
import { ObjectTree } from './ObjectTree'

function isNetworkExpandAllBlocked(
  details: NetworkDetails,
  queryParams: Record<string, string | number | boolean | null | unknown> | null
): boolean {
  const values: unknown[] = [details.requestHeaders]
  if (queryParams) values.push(queryParams)
  if (details.requestBody !== undefined) values.push(details.requestBody)
  if (details.responseHeaders !== undefined) values.push(details.responseHeaders)
  if (details.responseBody !== undefined) values.push(details.responseBody)
  if (details.error !== undefined) values.push(details.error)
  return values.some((value) => isObjectTreeTooLarge(value))
}

export function NetworkEntry({
  entryId,
  details,
  open,
  timestamp,
}: {
  entryId: string
  details: NetworkDetails
  open: boolean
  timestamp?: number
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const openHttpClientTab = useTabsStore((state) => state.openHttpClientTab)
  const setConsoleOpen = useSettingsStore((state) => state.setConsoleOpen)
  const showDecodedUrls = useConsoleStore((state) => state.showDecodedUrls)
  const [sectionsEpoch, setSectionsEpoch] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const pending = isPendingNetwork(details)
  const cancelled = isCancelledNetwork(details)
  const failed = isFailedNetwork(details)
  const queryParams = open ? parseDecodedQueryParams(details.url) : null
  const expandAllBlocked = useMemo(
    () => isNetworkExpandAllBlocked(details, queryParams),
    [details, queryParams]
  )
  const [sectionsExpanded, setSectionsExpanded] = useState(
    () => open && !isNetworkExpandAllBlocked(details, parseDecodedQueryParams(details.url))
  )
  const { origin, pathWithQuery } = splitNetworkUrl(details.url)
  const hostLabel = origin ? origin.replace(/^https?:\/\//, '') : ''
  const canDecodePath = pathNeedsUrlDecode(pathWithQuery)
  const decodedPathWithQuery = useMemo(
    () => (canDecodePath ? formatDecodedPathWithQuery(details.url) : pathWithQuery),
    [canDecodePath, details.url, pathWithQuery]
  )
  const displayPath = showDecodedUrls && canDecodePath ? decodedPathWithQuery : pathWithQuery
  const pathTitle =
    showDecodedUrls && canDecodePath
      ? pathWithQuery
      : canDecodePath
        ? decodedPathWithQuery
        : details.url

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

  const toggleAllSections = (expandAll: boolean) => {
    if (expandAll) expandAllSections()
    else collapseAllSections()
  }

  const openInHttpClient = (event: ReactMouseEvent) => {
    event.stopPropagation()
    openHttpClientTab(mapNetworkDetailsToSeed(details))
    if (mobile) setConsoleOpen(false)
  }

  const cancelRequest = (event: ReactMouseEvent) => {
    event.stopPropagation()
    abortNetworkRequest(entryId)
  }

  const statusBadge = pending ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-sky-500/15 px-1.5 py-px font-semibold text-[10px] text-sky-700 dark:text-sky-300">
      <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
      {t('console.pending')}
    </span>
  ) : cancelled ? (
    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-px font-semibold text-[10px] text-amber-800 dark:text-amber-300">
      {t('console.cancelled')}
    </span>
  ) : details.status !== undefined ? (
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

  const accentClass = pending
    ? 'bg-sky-500/60'
    : cancelled
      ? 'bg-amber-500/60'
      : failed
        ? 'bg-destructive'
        : 'bg-emerald-500/60'

  const cancelButton = pending ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-network-cancel
            className={cn(
              'shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive',
              mobile ? 'h-8 w-8' : 'h-4 w-4'
            )}
            onClick={cancelRequest}
            aria-label={t('console.cancelRequest')}
          >
            <Square className={mobile ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{t('console.cancelRequest')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null

  const sendButton = !pending ? (
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
  ) : null

  return (
    <div ref={rootRef} className="group/network min-w-0 flex-1">
      {mobile ? (
        <div className="flex w-full min-w-0 gap-2">
          <div aria-hidden="true" className={cn('mt-1 h-8 w-0.5 shrink-0 rounded-full', accentClass)} />
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
                title={pathTitle}
              >
                {displayPath}
              </span>
              {cancelButton}
              {sendButton}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-5 text-[10px] text-muted-foreground tabular-nums">
              {!pending ? <span>{details.durationMs.toFixed(0)} ms</span> : null}
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
                  {formatConsoleTimestamp(timestamp)}
                </time>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-1.5">
          <div aria-hidden="true" className={cn('h-3.5 w-0.5 shrink-0 rounded-full', accentClass)} />

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
              title={pathTitle}
            >
              {displayPath}
            </span>

            <div className="flex shrink-0 items-center gap-0.5">
              {!pending ? (
                <span className="rounded bg-muted/80 px-1.5 py-px text-[10px] text-muted-foreground tabular-nums">
                  {details.durationMs.toFixed(0)} ms
                </span>
              ) : null}
              {details.responseSizeBytes !== undefined ? (
                <span className="rounded bg-muted/80 px-1.5 py-px text-[10px] text-muted-foreground tabular-nums">
                  {formatByteSize(details.responseSizeBytes)}
                </span>
              ) : null}
              {cancelButton}
              {sendButton}
            </div>

            <div aria-hidden="true" />

            {hostLabel ? (
              <span
                className="max-w-40 justify-self-end truncate font-mono text-[10px] text-muted-foreground"
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
            <TriStateIconButton
              appearance="labeled"
              state={sectionsExpanded}
              blockExpand={expandAllBlocked}
              expandBlockedLabel={t('console.expandAllTooLarge')}
              icons={{
                false: ChevronsUpDown,
                indeterminate: Minus,
                true: ChevronsDownUp,
              }}
              labels={{
                false: t('console.expandAll'),
                indeterminate: t('console.expandSome'),
                true: t('console.collapseAll'),
              }}
              className={mobile ? 'h-8 px-2' : undefined}
              onToggle={toggleAllSections}
            />
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
          <ConsoleNetworkImageBody details={details} />
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
