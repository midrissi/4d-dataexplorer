import { cn } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EntityIoPanel({
  icon: Icon,
  title,
  count,
  action,
  children,
  className,
  contentClassName,
}: {
  icon?: LucideIcon
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section
      className={cn('overflow-hidden rounded-md border border-border/70 bg-muted/10', className)}
    >
      <div className="flex min-h-8 items-center gap-1.5 border-border/60 border-b bg-muted/25 px-2 py-1">
        {Icon ? <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /> : null}
        <h3 className="min-w-0 flex-1 font-medium text-xs">{title}</h3>
        {count != null ? (
          <span className="rounded-full border bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
        {action}
      </div>
      <div className={cn('bg-background/40 p-2', contentClassName)}>{children}</div>
    </section>
  )
}
