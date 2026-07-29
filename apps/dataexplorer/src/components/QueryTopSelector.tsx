import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Info } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

export const QUERY_TOP_PRESETS = [10, 20, 50, 100, 200, 500, 1000] as const

type QueryTopSelectorProps = {
  value: number
  onChange: (top: number) => void
  disabled?: boolean
  className?: string
}

export function QueryTopSelector({ value, onChange, disabled, className }: QueryTopSelectorProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const options: number[] = QUERY_TOP_PRESETS.includes(value as (typeof QUERY_TOP_PRESETS)[number])
    ? [...QUERY_TOP_PRESETS]
    : [...QUERY_TOP_PRESETS, value].sort((a, b) => a - b)

  return (
    <div
      className={cn(
        'flex items-center',
        mobile ? 'gap-1' : 'gap-1.5',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {!mobile ? (
        <span className="@[28rem]/entity-list:inline hidden text-muted-foreground text-xs">
          {t('entity.perPage')}
        </span>
      ) : null}
      {!mobile ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground"
                aria-label={t('entity.perPageHelp')}
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('entity.perPageHelp')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      <Select
        value={value.toString()}
        onValueChange={(next) => onChange(Number.parseInt(next, 10))}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn('shrink-0 text-xs', mobile ? 'h-9 w-16' : 'h-6 w-18')}
          aria-label={t('entity.perPage')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent collisionPadding={mobile ? 16 : 8}>
          {options.map((option) => (
            <SelectItem
              key={option}
              value={option.toString()}
              className={mobile ? 'min-h-11 py-3 text-sm' : undefined}
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
