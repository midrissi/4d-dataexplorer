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
import { Binary, Braces, ChevronsDownUp, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import type { ConsoleFilter } from '~/store/console'
import { useConsoleStore } from '~/store/console'
import { useSettingsStore } from '~/store/settings'
import { ConsoleEmptyState } from './ConsoleEmptyState'
import { LogEntry } from './LogEntry'

const FILTERS: ConsoleFilter[] = ['all', 'log', 'info', 'warn', 'error', 'network']

export function ConsolePanel({
  /** When true, omit title/close chrome (used inside the bottom dock tab strip). */
  hideChrome = false,
}: {
  hideChrome?: boolean
} = {}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const entries = useConsoleStore((state) => state.entries)
  const filter = useConsoleStore((state) => state.filter)
  const setFilter = useConsoleStore((state) => state.setFilter)
  const showDecodedUrls = useConsoleStore((state) => state.showDecodedUrls)
  const setShowDecodedUrls = useConsoleStore((state) => state.setShowDecodedUrls)
  const clear = useConsoleStore((state) => state.clear)
  const setConsoleOpen = useSettingsStore((state) => state.setConsoleOpen)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const [viewEpoch, setViewEpoch] = useState(0)

  const filteredEntries =
    filter === 'all' ? entries : entries.filter((entry) => entry.level === filter)
  const lastEntryId = filteredEntries[filteredEntries.length - 1]?.id
  const hasEntries = filteredEntries.length > 0

  const decodeToggleLabel = showDecodedUrls
    ? t('console.showEncodedUrl')
    : t('console.showDecodedUrl')

  const collapseAll = () => {
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
          {mobile && !hideChrome ? (
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
          ) : null}
          {!hideChrome && !mobile ? (
            <span className="font-medium text-xs">{t('console.title')}</span>
          ) : null}
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
                  className={cn(
                    mobile ? 'h-9 w-9' : 'h-6 w-6',
                    showDecodedUrls && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => setShowDecodedUrls(!showDecodedUrls)}
                  aria-label={decodeToggleLabel}
                  aria-pressed={showDecodedUrls}
                >
                  {showDecodedUrls ? (
                    <Braces className="h-3.5 w-3.5" />
                  ) : (
                    <Binary className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{decodeToggleLabel}</TooltipContent>
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
                  disabled={!hasEntries}
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

          {!mobile && !hideChrome ? (
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
            <LogEntry key={`${entry.id}:${viewEpoch}`} entry={entry} />
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
