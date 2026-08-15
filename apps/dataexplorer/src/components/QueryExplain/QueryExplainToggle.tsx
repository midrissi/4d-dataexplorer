import { cn, Label, Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { useTranslation } from '~/i18n'

export function QueryExplainToggle({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const labelId = 'query-explain-toggle-label'

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Label
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 text-xs',
              disabled && 'cursor-not-allowed opacity-60',
              className
            )}
          >
            <Switch
              checked={checked}
              disabled={disabled}
              onCheckedChange={onCheckedChange}
              aria-labelledby={labelId}
            />
            <span id={labelId}>{t('queryExplain.toggle')}</span>
          </Label>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs">{t('queryExplain.toggleHint')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
