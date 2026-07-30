import { cn, Skeleton } from '@4d/ui'
import { Loader2 } from 'lucide-react'

/** Soft placeholder for the entity detail pane while the next record loads. */
export function EntityDetailSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-background', className)}
      role="status"
      aria-busy="true"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="flex shrink-0 gap-2 border-b px-3 py-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
        {['a', 'b', 'c', 'd', 'e', 'f'].map((id) => (
          <div key={id} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}

/** Card-list placeholder while a page of entities is fetched. */
export function EntityListSkeleton({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-stretch gap-3 overflow-hidden bg-background p-4',
        className
      )}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-2 py-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        {label ? <p className="text-muted-foreground text-sm">{label}</p> : null}
      </div>
      {['card-a', 'card-b', 'card-c', 'card-d'].map((id) => (
        <div key={id} className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[80%]" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
