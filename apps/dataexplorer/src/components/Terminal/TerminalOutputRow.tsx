import { cn } from '@4d/ui'
import type { TerminalOutputCell } from '~/store/terminal'
import { TerminalMarkdownCell } from './TerminalMarkdownCell'
import { TerminalResultCell } from './TerminalResultCell'

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23)
}

const MARKER_BASE =
  'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm font-semibold text-[10px] leading-none'

function Marker({ kind, logLevel }: { kind: TerminalOutputCell['kind']; logLevel?: string }) {
  if (kind === 'input') {
    return (
      <span
        className={cn(MARKER_BASE, 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400')}
        aria-hidden
      >
        ›
      </span>
    )
  }
  if (kind === 'error') {
    return (
      <span className={cn(MARKER_BASE, 'bg-destructive/15 text-destructive')} aria-hidden>
        ✕
      </span>
    )
  }
  if (kind === 'system') {
    return (
      <span
        className={cn(MARKER_BASE, 'bg-violet-500/15 text-violet-700 dark:text-violet-300')}
        aria-hidden
      >
        ·
      </span>
    )
  }
  if (kind === 'log') {
    const tone =
      logLevel === 'error'
        ? 'bg-destructive/15 text-destructive'
        : logLevel === 'warn'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    return (
      <span className={cn(MARKER_BASE, tone)} aria-hidden>
        ◦
      </span>
    )
  }
  return (
    <span className={cn(MARKER_BASE, 'bg-muted text-muted-foreground')} aria-hidden>
      ←
    </span>
  )
}

type TerminalOutputRowProps = {
  cell: TerminalOutputCell
  isFirstOfRun?: boolean
}

/**
 * One scrollback line: timestamp gutter, kind marker, and body / smart result cell.
 * Gutter stays top-aligned so multi-line bodies don’t vertically center the time/marker.
 */
export function TerminalOutputRow({ cell, isFirstOfRun = false }: TerminalOutputRowProps) {
  return (
    <li
      className={cn(
        'group flex min-h-6 items-start gap-1.5 px-1.5 py-0.5',
        isFirstOfRun &&
          'mt-1.5 border-border/40 border-t border-dashed first:mt-0 first:border-t-0',
        cell.kind === 'error' && 'bg-destructive/5',
        cell.kind === 'result' && 'hover:bg-muted/25',
        cell.kind === 'input' && 'bg-muted/15',
        cell.kind === 'system' && 'bg-violet-500/5'
      )}
    >
      <time
        dateTime={new Date(cell.timestamp).toISOString()}
        className="shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground/55 tabular-nums leading-4 transition-colors group-hover:text-muted-foreground"
      >
        {formatTimestamp(cell.timestamp)}
      </time>
      <span className="shrink-0 pt-0.5">
        <Marker kind={cell.kind} logLevel={cell.logLevel} />
      </span>
      {cell.kind === 'input' ? (
        <div className="min-w-0 flex-1">
          <pre className="wrap-break-word whitespace-pre-wrap font-mono text-[11px] text-foreground/90 leading-4">
            {cell.source}
          </pre>
        </div>
      ) : cell.kind === 'error' ? (
        <div
          className="min-w-0 flex-1 font-mono text-[11px] text-destructive leading-4"
          role="alert"
        >
          {cell.errorMessage}
        </div>
      ) : cell.kind === 'system' && cell.markdown ? (
        <TerminalMarkdownCell markdown={cell.markdown} />
      ) : cell.kind === 'system' && cell.systemMessage != null ? (
        <pre className="wrap-break-word min-w-0 flex-1 whitespace-pre-wrap font-mono text-[11px] text-foreground/85 leading-4">
          {cell.systemMessage}
        </pre>
      ) : cell.formatted ? (
        <div className="flex min-h-4 min-w-0 flex-1 items-start">
          <TerminalResultCell formatted={cell.formatted} />
        </div>
      ) : null}
    </li>
  )
}
