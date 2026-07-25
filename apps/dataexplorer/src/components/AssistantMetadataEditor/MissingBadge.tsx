import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { useTranslation } from '~/i18n'

type MissingBadgeProps = {
  className?: string
}

export function MissingBadge({ className }: MissingBadgeProps) {
  const { t } = useTranslation()

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500', className)}
            aria-label={t('assistantMetadata.missingDescription')}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {t('assistantMetadata.missingDescription')}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function isMissingDescription(value: string | undefined): boolean {
  return !value?.trim()
}
