import { cn } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function ClassShell({
  icon: Icon,
  iconClassName,
  title,
  badges,
  actions,
  children,
  className,
}: {
  icon: LucideIcon
  iconClassName: string
  title: string
  badges?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-md border bg-muted/20 text-xs', className)}>
      <div className="flex items-start gap-2 border-b bg-muted/30 p-2">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background',
            iconClassName
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-xs">{title}</span>
            {badges}
          </div>
        </div>
        {actions}
      </div>
      <div className="space-y-2 p-2">{children}</div>
    </div>
  )
}

export function Field({
  label,
  value,
  mono = true,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="space-y-0.5 rounded-md border bg-background/60 px-2 py-1.5">
      <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</dt>
      <dd
        className={cn('truncate text-[11px]', mono && 'font-mono')}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </dd>
    </div>
  )
}
