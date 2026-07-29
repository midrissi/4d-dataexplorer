import { Alert, AlertDescription, AlertTitle, Button, cn } from '@4d/ui'
import { AlertCircle, ArrowLeft, Database, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { LoadingStepCard } from '~/components/LoadingStepCard'
import type { LoadingStep } from '~/components/loading-step'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

export type { LoadingStep } from '~/components/loading-step'

type LoadingScreenProps = {
  steps: LoadingStep[]
  error?: string | null
  onRetry?: () => void
  onDisconnect?: () => void
}

export function LoadingScreen({ steps, error, onRetry, onDisconnect }: LoadingScreenProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()

  const { completed, total, progress, activeLabel } = useMemo(() => {
    const totalSteps = steps.length
    const doneCount = steps.filter((s) => s.status === 'done').length
    const loadingStep = steps.find((s) => s.status === 'loading')
    const ratio = totalSteps === 0 ? 0 : (doneCount + (loadingStep ? 0.35 : 0)) / totalSteps
    return {
      completed: doneCount,
      total: totalSteps,
      progress: Math.min(1, Math.max(0, ratio)),
      activeLabel: loadingStep?.detail ?? loadingStep?.label ?? null,
    }
  }, [steps])

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center justify-center overflow-hidden bg-background',
        mobile
          ? 'h-full px-5 pt-[max(1.5rem,var(--app-safe-top))] pb-[max(1.5rem,var(--app-safe-bottom))]'
          : 'h-screen px-4'
      )}
    >
      {mobile ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-primary/10 to-transparent"
          aria-hidden
        />
      ) : null}

      <div className={cn('relative z-10 w-full', mobile ? 'max-w-md' : 'max-w-sm')}>
        <div className={cn('flex flex-col items-center text-center', mobile ? 'mb-8' : 'mb-4')}>
          <div
            className={cn(
              'flex items-center justify-center bg-primary shadow-xs',
              mobile
                ? 'mb-4 h-14 w-14 rounded-2xl'
                : 'mb-2 h-10 w-10 rounded-md shadow-primary/20 shadow-sm'
            )}
            aria-hidden
          >
            <Database className={cn('text-primary-foreground', mobile ? 'h-7 w-7' : 'h-5 w-5')} />
          </div>
          <h1
            className={cn(
              'font-bold text-foreground tracking-tight',
              mobile ? 'text-2xl' : 'text-xl'
            )}
          >
            {t('loading.title')}
          </h1>
          <p className={cn('text-muted-foreground', mobile ? 'mt-1 text-sm' : 'text-xs')}>
            {t('loading.subtitle')}
          </p>
        </div>

        {mobile && total > 0 ? (
          <div className="mb-5 space-y-2">
            <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
              <span className="truncate">{activeLabel ?? t('loading.subtitle')}</span>
              <span className="shrink-0 tabular-nums">
                {t('loading.progressCount', { current: Math.min(completed + 1, total), total })}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={t('loading.progressAria', {
                current: Math.min(completed + (progress < 1 ? 1 : 0), total),
                total,
              })}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        <ol
          className={cn('w-full list-none p-0', mobile ? 'space-y-2.5' : 'space-y-1.5')}
          aria-label={t('loading.stepsAria')}
          aria-live="polite"
        >
          {steps.map((step) => (
            <li key={step.id}>
              <LoadingStepCard step={step} mobile={mobile} />
            </li>
          ))}
        </ol>

        {error ? (
          <Alert variant="destructive" className={cn(mobile ? 'mt-6' : 'mt-3')}>
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertTitle>{t('loading.connectionError')}</AlertTitle>
            <AlertDescription className="mt-1">{error}</AlertDescription>
            {(onRetry || onDisconnect) && (
              <div className={cn('flex flex-wrap gap-2', mobile ? 'mt-4' : 'mt-3')}>
                {onRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size={mobile ? 'default' : 'sm'}
                    className={cn(mobile && 'h-11 min-w-[7.5rem]')}
                    onClick={onRetry}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    {t('loading.retry')}
                  </Button>
                ) : null}
                {onDisconnect ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size={mobile ? 'default' : 'sm'}
                    className={cn(mobile && 'h-11')}
                    onClick={onDisconnect}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    {t('loading.backToConnections')}
                  </Button>
                ) : null}
              </div>
            )}
          </Alert>
        ) : null}
      </div>
    </div>
  )
}
