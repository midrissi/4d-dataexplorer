import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: ReactNode
  icon?: LucideIcon
  ariaLabel?: string
}

export type SegmentedControlProps<T extends string> = {
  value: T
  options: SegmentedControlOption<T>[]
  onValueChange: (value: T) => void
  className?: string
  /** Stretch segments evenly across the available width. */
  fullWidth?: boolean
  /** Accessible name for the group. */
  'aria-label'?: string
}

/**
 * Compact segmented control (Binary/EntityList style):
 * bordered muted track; active segment uses elevated background (not primary fill).
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  className,
  fullWidth = false,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <fieldset
      className={cn(
        'm-0 inline-flex min-h-6 w-fit min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-sm border bg-muted/40 p-px',
        fullWidth && 'flex w-full flex-nowrap',
        className
      )}
    >
      {ariaLabel ? <legend className="sr-only">{ariaLabel}</legend> : null}
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex h-5 items-center justify-center gap-1 rounded-sm px-1.5 font-medium text-[11px] transition-colors',
              fullWidth && 'min-w-0 flex-1',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon ? <Icon className="size-2.5 shrink-0 opacity-70" aria-hidden /> : null}
            <span className={cn(fullWidth && 'truncate')}>{option.label}</span>
          </button>
        )
      })}
    </fieldset>
  )
}
