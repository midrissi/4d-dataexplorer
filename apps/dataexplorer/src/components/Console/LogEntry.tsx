import { cn } from '@4d/ui'
import { type MouseEvent as ReactMouseEvent, useState } from 'react'
import { failedNetworkBackground, formatConsoleTimestamp } from '~/lib/console-format'
import { isMobileShell } from '~/lib/platform'
import type { ConsoleEntry } from '~/store/console'
import { ArgumentValues } from './ArgumentValues'
import { ConsoleEntryRemoveButton } from './ConsoleEntryRemoveButton'
import { InlineValue } from './InlineValue'
import { LevelIcon } from './LevelIcon'
import { NetworkEntry } from './NetworkEntry'

export function LogEntry({
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
    if (target.closest('[data-network-cancel]')) return
    if (target.closest('[data-console-remove]')) return
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
          'group/entry flex min-w-0 cursor-pointer items-start gap-1.5 border-b font-mono text-xs [content-visibility:auto]',
          mobile
            ? 'px-3 py-2.5 [contain-intrinsic-size:auto_52px]'
            : 'px-2 py-0.5 [contain-intrinsic-size:auto_22px]',
          'transition-colors hover:bg-muted/50',
          failedNetworkBackground(entry)
        )}
        onClick={toggleNetwork}
        onKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest('[data-console-remove]')) {
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setNetworkOpen((current) => !current)
          }
        }}
      >
        <NetworkEntry
          entryId={entry.id}
          details={entry.network}
          open={networkOpen}
          timestamp={mobile ? entry.timestamp : undefined}
        />
        {!mobile ? (
          <time
            dateTime={new Date(entry.timestamp).toISOString()}
            className="mt-0.5 shrink-0 text-[10px] text-muted-foreground"
          >
            {formatConsoleTimestamp(entry.timestamp)}
          </time>
        ) : null}
        <ConsoleEntryRemoveButton entryId={entry.id} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group/entry flex min-w-0 items-start gap-1.5 border-b font-mono text-xs [content-visibility:auto]',
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
            {formatConsoleTimestamp(entry.timestamp)}
          </time>
        ) : null}
        <ConsoleEntryRemoveButton entryId={entry.id} />
      </div>
      {mobile ? (
        <time
          dateTime={new Date(entry.timestamp).toISOString()}
          className="pl-5 text-[10px] text-muted-foreground"
        >
          {formatConsoleTimestamp(entry.timestamp)}
        </time>
      ) : null}
    </div>
  )
}
