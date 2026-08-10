import {
  Button,
  Checkbox,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import type { TriState } from '~/lib/rest-export/tri-state'

type TriStateIconButtonProps = {
  state: TriState
  labels: { false: string; indeterminate: string; true: string }
  disabled?: boolean
  /**
   * When true, the control cannot move toward the expanded / select-all state.
   * Collapse (state === true → false) stays available.
   */
  blockExpand?: boolean
  /** Tooltip when expand is blocked and the control is not in the expanded state. */
  expandBlockedLabel?: string
  onToggle: (selectAll: boolean) => void
  className?: string
} & (
  | { appearance?: 'checkbox'; icons?: undefined }
  | {
      appearance: 'icon'
      icons: { false: LucideIcon; indeterminate: LucideIcon; true: LucideIcon }
    }
  | {
      /** Icon + text label for the next action (expand ↔ collapse). */
      appearance: 'labeled'
      icons: { false: LucideIcon; indeterminate: LucideIcon; true: LucideIcon }
    }
)

/**
 * Single control for all / some / none selection or expand / collapse.
 * Click: when fully on → turn off; otherwise → turn on (unless `blockExpand`).
 */
export function TriStateIconButton({
  state,
  labels,
  disabled,
  blockExpand = false,
  expandBlockedLabel,
  onToggle,
  appearance = 'checkbox',
  icons,
  className,
}: TriStateIconButtonProps) {
  const expandBlocked = blockExpand && state !== true
  const effectivelyDisabled = Boolean(disabled || expandBlocked)
  const label =
    state === true ? labels.true : state === 'indeterminate' ? labels.indeterminate : labels.false
  const tooltipLabel = expandBlocked && expandBlockedLabel ? expandBlockedLabel : label

  const handleActivate = () => {
    if (state === true) {
      onToggle(false)
      return
    }
    if (blockExpand || disabled) return
    onToggle(true)
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          {appearance === 'icon' && icons ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-6 w-6', className)}
              aria-label={tooltipLabel}
              disabled={effectivelyDisabled}
              onClick={handleActivate}
            >
              <TriStateIcon state={state} icons={icons} />
            </Button>
          ) : appearance === 'labeled' && icons ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-5 gap-1 px-1.5 text-[10px] text-muted-foreground', className)}
              aria-label={tooltipLabel}
              disabled={effectivelyDisabled}
              onClick={handleActivate}
            >
              <TriStateIcon state={state} icons={icons} />
              {expandBlocked && expandBlockedLabel ? expandBlockedLabel : label}
            </Button>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center">
              <Checkbox
                checked={state === 'indeterminate' ? 'indeterminate' : state}
                disabled={effectivelyDisabled}
                aria-label={tooltipLabel}
                onCheckedChange={(value) => {
                  if (value === true && blockExpand) return
                  onToggle(value === true)
                }}
              />
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TriStateIcon({
  state,
  icons,
}: {
  state: TriState
  icons: { false: LucideIcon; indeterminate: LucideIcon; true: LucideIcon }
}) {
  const Icon =
    state === true ? icons.true : state === 'indeterminate' ? icons.indeterminate : icons.false
  return <Icon className="h-3.5 w-3.5" />
}
