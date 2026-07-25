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

export const QUERY_TOP_PRESETS = [10, 20, 50, 100, 200, 500, 1000] as const

type QueryTopSelectorProps = {
  value: number
  onChange: (top: number) => void
  disabled?: boolean
  className?: string
}

export function QueryTopSelector({ value, onChange, disabled, className }: QueryTopSelectorProps) {
  const { t } = useTranslation()
  const options: number[] = QUERY_TOP_PRESETS.includes(value as (typeof QUERY_TOP_PRESETS)[number])
    ? [...QUERY_TOP_PRESETS]
    : [...QUERY_TOP_PRESETS, value].sort((a, b) => a - b)

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      <span className="@[28rem]/entity-list:inline hidden text-muted-foreground text-xs">
        {t('entity.perPage')}
      </span>
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
      <Select
        value={value.toString()}
        onValueChange={(next) => onChange(Number.parseInt(next, 10))}
        disabled={disabled}
      >
        <SelectTrigger className="h-6 w-18 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option.toString()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
