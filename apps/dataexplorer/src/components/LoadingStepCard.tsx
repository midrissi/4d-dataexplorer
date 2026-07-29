import { cn } from '@4d/ui'
import { AlertCircle, Check, Loader2, Table2 } from 'lucide-react'
import type { LoadingStep } from '~/components/loading-step'

type LoadingStepCardProps = {
  step: LoadingStep
  mobile: boolean
}

export function LoadingStepCard({ step, mobile }: LoadingStepCardProps) {
  return (
    <div
      className={cn(
        'flex items-center transition-colors duration-200',
        mobile ? 'gap-3 rounded-xl border px-3.5 py-3' : 'gap-2 rounded-md border px-2.5 py-1.5',
        step.status === 'loading' && 'border-primary/40 bg-primary/10',
        step.status === 'done' && 'border-success/35 bg-success/10',
        step.status === 'error' && 'border-destructive/40 bg-destructive/10',
        step.status === 'pending' && 'border-border/80 bg-muted/40 opacity-60'
      )}
      aria-current={step.status === 'loading' ? 'step' : undefined}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          mobile ? 'h-10 w-10' : 'h-7 w-7',
          step.status === 'loading' && 'bg-primary/15',
          step.status === 'done' && 'bg-success/15',
          step.status === 'error' && 'bg-destructive/15',
          step.status === 'pending' && 'bg-muted'
        )}
        aria-hidden
      >
        {step.status === 'loading' ? (
          <Loader2 className={cn('animate-spin text-primary', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : null}
        {step.status === 'done' ? (
          <Check className={cn('text-success', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : null}
        {step.status === 'error' ? (
          <AlertCircle className={cn('text-destructive', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : null}
        {step.status === 'pending' ? (
          <Table2 className={cn('text-muted-foreground/60', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-medium leading-snug',
            mobile ? 'text-sm' : 'text-xs',
            step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {step.label}
        </p>
        {step.detail ? (
          <p
            className={cn(
              'truncate text-muted-foreground',
              mobile ? 'mt-0.5 text-xs' : 'text-[11px]'
            )}
          >
            {step.detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}
