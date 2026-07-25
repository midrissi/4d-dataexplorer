import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@4d/ui'
import { CheckSquare, Square } from 'lucide-react'

export interface CheckboxButtonProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Accessible label (required). */
  ariaLabel: string
  /** Optional tooltip text (wraps button in Tooltip when provided). */
  tooltip?: string
  className?: string
}

/**
 * Button-style checkbox used in the schema builder (e.g. Required, Include $schema).
 * Renders as a ghost icon button (h-6 w-6) with CheckSquare when checked, Square when unchecked.
 */
export function CheckboxButton({
  checked,
  onCheckedChange,
  ariaLabel,
  tooltip,
  className,
}: CheckboxButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="iconXs"
      className={className ?? 'h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground'}
      onClick={() => onCheckedChange(!checked)}
      aria-label={ariaLabel}
      aria-pressed={checked}
    >
      {checked ? (
        <CheckSquare className="size-3.5 shrink-0" />
      ) : (
        <Square className="size-3.5 shrink-0" />
      )}
    </Button>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return button
}
