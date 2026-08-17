import { Database, UserRound } from 'lucide-react'
import type { ListsSwitcherEntry, ListsSwitcherScopeId } from './lists-switcher-entries'

function ScopeIcon({ scope }: { scope: ListsSwitcherScopeId }) {
  if (scope === 'profile')
    return <UserRound className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
  if (scope === 'base')
    return <Database className="size-2.5 shrink-0 text-muted-foreground" aria-hidden />
  return (
    <span
      className="size-2.5 shrink-0 rounded-full border border-muted-foreground/50 border-dashed"
      aria-hidden
    />
  )
}

function ScopeBadge({ scope, label }: { scope: ListsSwitcherScopeId; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border/70 bg-muted/60 px-1 py-px font-sans text-[9px] text-muted-foreground leading-none">
      <ScopeIcon scope={scope} />
      {label}
    </span>
  )
}

export function ListsSwitcherEntryList({
  entries,
  scopeLabel,
  typeDataclassLabel,
  typeHardcodedLabel,
  compact = false,
}: {
  entries: ListsSwitcherEntry[]
  scopeLabel: Record<ListsSwitcherScopeId, string>
  typeDataclassLabel: string
  typeHardcodedLabel: string
  compact?: boolean
}) {
  return (
    <ul
      className={
        compact
          ? 'max-h-52 overflow-y-auto overscroll-contain py-1'
          : 'max-h-64 overflow-y-auto overscroll-contain py-1'
      }
    >
      {entries.map((entry) => (
        <li
          key={entry.name}
          className={
            compact
              ? 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2.5 py-1 transition-colors duration-150 hover:bg-muted/40'
              : 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2.5 py-1.5 transition-colors duration-150 hover:bg-muted/40'
          }
        >
          <span className="min-w-0">
            <span className="block truncate font-mono text-[11px] text-foreground">
              {entry.name}
            </span>
            {entry.valueHint ? (
              <span className="block truncate font-mono text-[9px] text-muted-foreground">
                {entry.valueHint}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1 py-px font-mono text-[9px] text-muted-foreground">
            {entry.type === 'dataclass' ? typeDataclassLabel : typeHardcodedLabel}
          </span>
          <ScopeBadge scope={entry.scope} label={scopeLabel[entry.scope]} />
        </li>
      ))}
    </ul>
  )
}
