import { formatCount } from '~/lib/utils'

export type WelcomeBarTooltipProps = {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; count: number } }>
  label?: string
  entitiesLabel: string
}

export function WelcomeBarTooltip({
  active,
  payload,
  label,
  entitiesLabel,
}: WelcomeBarTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2">
      <p className="font-medium text-popover-foreground text-sm">{label}</p>
      <p className="text-muted-foreground text-xs">
        {formatCount(payload[0].value)} {entitiesLabel}
      </p>
    </div>
  )
}
