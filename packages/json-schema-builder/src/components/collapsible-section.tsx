import { ChevronDown, ChevronRight } from 'lucide-react'
import * as React from 'react'

export interface CollapsibleSectionProps {
  label: string
  /** Optional count badge (e.g. number of items) shown next to label when collapsed */
  count?: number
  /** Action(s) shown in the header (e.g. Add button, expand/collapse all). Always visible; clicking when collapsed opens the section. */
  headerAction?: React.ReactNode
  /** Whether the section is expanded by default. Default: false (collapsed). */
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  label,
  count,
  headerAction,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-1 py-0.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-6 min-w-0 shrink items-center gap-1 rounded-sm font-semibold text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground focus:outline-none"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{label}</span>
          {count !== undefined && count > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
              {count}
            </span>
          )}
        </button>
        {headerAction != null ? (
          <div
            className="shrink-0"
            onClickCapture={() => {
              if (!open) setOpen(true)
            }}
          >
            {headerAction}
          </div>
        ) : null}
      </div>
      {open ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}
