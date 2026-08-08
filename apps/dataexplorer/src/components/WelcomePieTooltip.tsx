import { formatCount } from '~/lib/utils'

export type WelcomePieTooltipProps = {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; count: number } }>
  label?: string
  entitiesLabel: string
}

export function WelcomePieTooltip({ active, payload, entitiesLabel }: WelcomePieTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2">
      <p className="font-medium text-popover-foreground text-sm">{data.payload.name}</p>
      <p className="text-muted-foreground text-xs">
        {formatCount(data.payload.count)} {entitiesLabel}
      </p>
    </div>
  )
}
