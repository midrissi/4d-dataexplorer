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
  /**
   * `sm` — compact toolbar (default).
   * `md` — touch-friendly targets (~32px).
   */
  size?: 'sm' | 'md'
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
  size = 'sm',
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const md = size === 'md'
  return (
    <fieldset
      className={cn(
        'm-0 inline-flex w-fit min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-md border bg-muted/40 p-0.5',
        md ? 'min-h-9' : 'min-h-6 rounded-sm p-px',
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
              'inline-flex touch-manipulation items-center justify-center gap-1 rounded-sm font-medium transition-colors',
              md ? 'h-8 gap-1.5 px-2.5 text-xs' : 'h-5 px-1.5 text-[11px]',
              fullWidth && 'min-w-0 flex-1',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon ? (
              <Icon
                className={cn('shrink-0 opacity-70', md ? 'size-3.5' : 'size-2.5')}
                aria-hidden
              />
            ) : null}
            <span className={cn(fullWidth && 'truncate')}>{option.label}</span>
          </button>
        )
      })}
    </fieldset>
  )
}
