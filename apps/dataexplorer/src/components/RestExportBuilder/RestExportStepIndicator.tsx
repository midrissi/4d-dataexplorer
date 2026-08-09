import { cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

export type RestExportStep = {
  id: string
  label: string
}

export function RestExportStepIndicator({
  steps,
  currentIndex,
  onSelect,
}: {
  steps: RestExportStep[]
  currentIndex: number
  onSelect: (index: number) => void
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()

  return (
    <div className="shrink-0 border-b px-3 py-2">
      <ol
        className="flex items-center gap-1 overflow-x-auto"
        aria-label={t('restExportBuilder.stepsAria')}
      >
        {steps.map((step, index) => {
          const active = index === currentIndex
          const done = index < currentIndex
          return (
            <li key={step.id} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <span className="h-px w-3 shrink-0 bg-border sm:w-5" aria-hidden />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(index)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md text-xs transition-colors',
                  mobile ? 'min-h-11 px-2 py-2' : 'px-1.5 py-1',
                  active && 'bg-muted font-medium text-foreground',
                  !active && 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full font-semibold',
                    mobile ? 'h-6 w-6 text-[11px]' : 'h-5 w-5 text-[10px]',
                    active && 'bg-primary text-primary-foreground',
                    done && !active && 'bg-primary/15 text-primary',
                    !done && !active && 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t('restExportBuilder.stepHint', {
          current: currentIndex + 1,
          total: steps.length,
          label: steps[currentIndex]?.label ?? '',
        })}
      </p>
    </div>
  )
}
