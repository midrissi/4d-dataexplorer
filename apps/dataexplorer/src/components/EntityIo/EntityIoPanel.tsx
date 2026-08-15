import { cn } from '@4d/ui'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

export function EntityIoPanel({
  icon: Icon,
  title,
  count,
  action,
  children,
  className,
  contentClassName,
  collapsible = false,
  defaultCollapsed = false,
  expandLabel = 'Expand',
  collapseLabel = 'Collapse',
}: {
  icon?: LucideIcon
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  /** When true, header toggles content visibility. */
  collapsible?: boolean
  /** Initial collapsed state when `collapsible` (default: false). */
  defaultCollapsed?: boolean
  expandLabel?: string
  collapseLabel?: string
}) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  const open = !collapsible || !collapsed

  const toggle = () => setCollapsed((prev) => !prev)

  return (
    <section
      className={cn('overflow-hidden rounded-md border border-border/70 bg-muted/10', className)}
    >
      <div
        className={cn(
          'flex min-h-8 items-center gap-1.5 bg-muted/25 px-2 py-1',
          open && 'border-border/60 border-b'
        )}
      >
        {collapsible ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-expanded={open}
            aria-label={open ? collapseLabel : expandLabel}
            onClick={toggle}
          >
            {open ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            )}
            {Icon ? <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /> : null}
            <h3 className="min-w-0 flex-1 font-medium text-xs">{title}</h3>
            {count != null ? (
              <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </button>
        ) : (
          <>
            {Icon ? <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /> : null}
            <h3 className="min-w-0 flex-1 font-medium text-xs">{title}</h3>
            {count != null ? (
              <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </>
        )}
        {action != null ? (
          <div
            className="shrink-0"
            onClickCapture={() => {
              if (collapsible && collapsed) setCollapsed(false)
            }}
          >
            {action}
          </div>
        ) : null}
      </div>
      {open ? <div className={cn('bg-background/40 p-2', contentClassName)}>{children}</div> : null}
    </section>
  )
}
