import { Button, Checkbox, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import type { LucideIcon } from 'lucide-react'
import type { TriState } from '~/lib/rest-export/tri-state'

type RestExportTriStateIconButtonProps = {
  state: TriState
  labels: { false: string; indeterminate: string; true: string }
  disabled?: boolean
  onToggle: (selectAll: boolean) => void
} & (
  | { appearance?: 'checkbox'; icons?: undefined }
  | {
      appearance: 'icon'
      icons: { false: LucideIcon; indeterminate: LucideIcon; true: LucideIcon }
    }
)

export function RestExportTriStateIconButton({
  state,
  labels,
  disabled,
  onToggle,
  appearance = 'checkbox',
  icons,
}: RestExportTriStateIconButtonProps) {
  const label =
    state === true ? labels.true : state === 'indeterminate' ? labels.indeterminate : labels.false

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          {appearance === 'icon' && icons ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={label}
              disabled={disabled}
              onClick={() => onToggle(state !== true)}
            >
              <TriStateIcon state={state} icons={icons} />
            </Button>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center">
              <Checkbox
                checked={state === 'indeterminate' ? 'indeterminate' : state}
                disabled={disabled}
                aria-label={label}
                onCheckedChange={(value) => onToggle(value === true)}
              />
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
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
