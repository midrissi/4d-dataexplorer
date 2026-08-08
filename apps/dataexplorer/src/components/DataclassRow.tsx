import { Button, cn } from '@4d/ui'
import { formatCount } from '~/lib/utils'
import type { Dataclass } from '~/store'
import type { DataclassCustomization } from '~/store/settings'
import { DataclassIcon, getDataclassColorClasses } from './DataclassCustomizeModal'

export type DataclassRowProps = {
  dataclass: Dataclass
  rank: number
  maxCount: number
  customization?: DataclassCustomization
  onClick: () => void
}

export function DataclassRow({
  dataclass,
  rank,
  maxCount,
  customization,
  onClick,
}: DataclassRowProps) {
  const percentage = maxCount > 0 ? (dataclass.count / maxCount) * 100 : 0
  const colorClasses = getDataclassColorClasses(customization)

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      style={colorClasses.style}
      className="group relative h-auto w-full overflow-hidden rounded-md border bg-background/50 px-2 py-1.5 text-left transition-colors"
    >
      {/* Progress bar background */}
      <div
        className={cn('absolute inset-y-0 left-0 transition-all', colorClasses.bgTint)}
        style={{ width: `${percentage}%` }}
      />

      <div className="relative flex w-full items-center gap-1.5">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded',
            colorClasses.bgTint
          )}
        >
          <DataclassIcon
            customization={customization}
            className={cn('h-3 w-3', colorClasses.text)}
          />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">#{rank}</span>
          <span className="truncate font-medium text-foreground text-xs">{dataclass.name}</span>
        </div>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
            colorClasses.bgTint,
            colorClasses.text
          )}
        >
          {formatCount(dataclass.count)}
        </span>
      </div>
    </Button>
  )
}
