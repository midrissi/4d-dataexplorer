import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'
import './job-progress.css'

export type JobProgressProps = {
  label: ReactNode
  icon?: ReactNode
  current?: number
  total?: number
  indeterminate?: boolean
  onCancel?: () => void
  cancelLabel?: string
  className?: string
  labelKey?: string | number
  ariaLabel?: string
}

export function JobProgress({
  label,
  icon,
  current = 0,
  total = 0,
  indeterminate = false,
  onCancel,
  cancelLabel,
  className,
  labelKey,
  ariaLabel,
}: JobProgressProps) {
  const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0
  const sweeping = indeterminate || total <= 0

  return (
    <output
      className={cn('job-progress', className)}
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
    >
      {icon ? (
        <span className="job-progress__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="job-progress__content">
        <span key={labelKey} className="job-progress__label">
          {label}
        </span>
        <span
          className={cn('job-progress__track', sweeping && 'job-progress__track--indeterminate')}
          aria-hidden
        >
          <span
            className="job-progress__fill"
            style={sweeping ? undefined : { width: `${percent}%` }}
          />
        </span>
      </span>
      {onCancel ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onCancel}
          aria-label={cancelLabel}
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </output>
  )
}

export function JobProgressCount({ children }: { children: ReactNode }) {
  return <span className="job-progress__count">{children}</span>
}
