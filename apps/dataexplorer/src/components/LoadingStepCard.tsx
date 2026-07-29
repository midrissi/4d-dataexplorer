import { cn } from '@4d/ui'
import { AlertCircle, Check, Loader2, Table2 } from 'lucide-react'
import type { LoadingStep } from '~/components/loading-step'

type LoadingStepCardProps = {
  step: LoadingStep
  mobile: boolean
  /** Render as a row inside a shared bordered stack (no own border). */
  stacked?: boolean
}

export function LoadingStepCard({ step, mobile, stacked = false }: LoadingStepCardProps) {
  const isLoading = step.status === 'loading'
  const isDone = step.status === 'done'
  const isError = step.status === 'error'
  const isPending = step.status === 'pending'

  return (
    <div
      className={cn(
        'relative flex items-center transition-colors duration-200',
        stacked
          ? cn(mobile ? 'gap-3 px-3.5 py-3.5' : 'gap-2.5 px-3 py-2.5', isLoading && 'bg-primary/8')
          : cn(
              'gap-2 rounded-lg border px-2.5 py-1.5',
              isLoading && 'border-primary/30 bg-primary/8',
              isDone && 'border-success/30 bg-success/8',
              isError && 'border-destructive/35 bg-destructive/8',
              isPending && 'border-border/70 bg-muted/30'
            ),
        // Left accent — avoids WebKit double-hairline from colored full borders
        stacked &&
          isLoading &&
          'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-[""]',
        stacked &&
          isDone &&
          'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-success/70 before:content-[""]',
        stacked &&
          isError &&
          'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-destructive before:content-[""]'
      )}
      aria-current={isLoading ? 'step' : undefined}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          mobile ? 'h-9 w-9' : 'h-7 w-7',
          isLoading && 'bg-primary/15 text-primary',
          isDone && 'bg-success/15 text-success',
          isError && 'bg-destructive/15 text-destructive',
          isPending && 'bg-muted text-muted-foreground'
        )}
        aria-hidden
      >
        {isLoading ? (
          <Loader2 className={cn('animate-spin', mobile ? 'h-5 w-5' : 'h-3.5 w-3.5')} />
        ) : null}
        {isDone ? (
          <Check className={cn(mobile ? 'h-5 w-5' : 'h-3.5 w-3.5')} strokeWidth={2.5} />
        ) : null}
        {isError ? <AlertCircle className={cn(mobile ? 'h-5 w-5' : 'h-3.5 w-3.5')} /> : null}
        {isPending ? <Table2 className={cn(mobile ? 'h-4 w-4' : 'h-3.5 w-3.5')} /> : null}
      </div>

      <div className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            'font-medium leading-snug',
            mobile ? 'text-sm' : 'text-xs',
            isPending ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {step.label}
        </p>
        {step.detail ? (
          <p
            className={cn(
              'truncate text-muted-foreground',
              mobile ? 'mt-0.5 text-xs' : 'text-[11px] leading-tight'
            )}
          >
            {step.detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}
