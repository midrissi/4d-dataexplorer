import { cn } from '@4d/ui'
import type { ElementType } from 'react'

export type WelcomeStatCardProps = {
  icon: ElementType
  label: string
  value: string | number
  subtext?: string
  className?: string
}

export function WelcomeStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  className,
}: WelcomeStatCardProps) {
  return (
    <div
      className={cn('rounded-md border bg-card p-3 transition-colors hover:bg-card/90', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-1 truncate font-semibold text-2xl text-foreground">{value}</p>
          {subtext && (
            <p className="mt-0.5 truncate text-muted-foreground text-xs" title={subtext}>
              {subtext}
            </p>
          )}
        </div>
        <div className="shrink-0 rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}
