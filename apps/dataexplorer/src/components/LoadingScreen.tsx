import { Alert, AlertDescription, AlertTitle, Button, cn } from '@4d/ui'
import { AlertCircle, ArrowLeft, RefreshCw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppBrandIcon } from '~/components/AppBrandIcon'
import { LoadingStepCard } from '~/components/LoadingStepCard'
import type { LoadingStep } from '~/components/loading-step'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

export type { LoadingStep } from '~/components/loading-step'

/** Show cancel once a connect looks stuck (avoids flashing on fast loads). */
const CANCEL_REVEAL_MS = 2500

type LoadingScreenProps = {
  steps: LoadingStep[]
  error?: string | null
  onRetry?: () => void
  onCancel?: () => void
  onDisconnect?: () => void
}

export function LoadingScreen({
  steps,
  error,
  onRetry,
  onCancel,
  onDisconnect,
}: LoadingScreenProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const [cancelReady, setCancelReady] = useState(false)

  useEffect(() => {
    if (!onCancel || error) {
      setCancelReady(false)
      return
    }
    setCancelReady(false)
    const id = window.setTimeout(() => setCancelReady(true), CANCEL_REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [onCancel, error])

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

  const showCancel = Boolean(onCancel && !error && cancelReady)
  const progressPercent = Math.round(progress * 100)
  const progressCurrent = Math.min(completed + (progress < 1 ? 1 : 0), total)

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center overflow-hidden bg-background',
        mobile
          ? 'h-full justify-between px-5 pt-[max(1.5rem,var(--app-safe-top))] pb-[max(1.25rem,var(--app-safe-bottom))]'
          : 'h-screen justify-center px-4'
      )}
    >
      {mobile ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-linear-to-b from-primary/12 via-primary/4 to-transparent"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          'fade-in relative z-10 w-full animate-in duration-300',
          mobile ? 'mx-auto max-w-md flex-1 content-center' : 'max-w-sm'
        )}
      >
        <header className={cn('flex flex-col items-center text-center', mobile ? 'mb-8' : 'mb-5')}>
          <div
            className={cn(
              'mb-3 shadow-md shadow-primary/25',
              mobile ? 'mb-5 h-16 w-16' : 'h-11 w-11'
            )}
          >
            <AppBrandIcon className="h-full w-full" title={t('loading.title')} />
          </div>
          <h1
            className={cn(
              'font-semibold text-foreground tracking-tight',
              mobile ? 'text-2xl' : 'text-xl'
            )}
          >
            {t('loading.title')}
          </h1>
          <p className={cn('text-muted-foreground', mobile ? 'mt-1.5 text-sm' : 'mt-0.5 text-xs')}>
            {t('loading.subtitle')}
          </p>
        </header>

        {mobile && total > 0 && !error ? (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-medium text-foreground/80">
                {activeLabel ?? t('loading.subtitle')}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {t('loading.progressCount', {
                  current: Math.min(completed + 1, total),
                  total,
                })}
              </span>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label={t('loading.progressAria', {
                current: progressCurrent,
                total,
              })}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <ol
          className={cn(
            'w-full list-none overflow-hidden p-0',
            mobile
              ? 'divide-y divide-border/80 rounded-2xl border border-border/80 bg-card/60 shadow-xs backdrop-blur-sm'
              : 'space-y-1.5'
          )}
          aria-label={t('loading.stepsAria')}
          aria-live="polite"
        >
          {steps.map((step) => (
            <li key={step.id}>
              <LoadingStepCard step={step} mobile={mobile} stacked={mobile} />
            </li>
          ))}
        </ol>

        {error ? (
          <Alert variant="destructive" className={cn(mobile ? 'mt-6' : 'mt-3')} role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertTitle>{t('loading.connectionError')}</AlertTitle>
            <AlertDescription className="mt-1">{error}</AlertDescription>
            {onRetry || onDisconnect ? (
              <div className={cn('flex flex-wrap gap-2', mobile ? 'mt-4' : 'mt-3')}>
                {onRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size={mobile ? 'default' : 'sm'}
                    className={cn(mobile && 'h-11 min-w-30')}
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
            ) : null}
          </Alert>
        ) : null}

        {!mobile && showCancel ? (
          <div className="mt-5 flex justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('loading.cancelRequest')}
            </Button>
          </div>
        ) : null}
      </div>

      {mobile && showCancel ? (
        <div className="fade-in slide-in-from-bottom-2 relative z-10 w-full max-w-md shrink-0 animate-in pt-3 duration-300">
          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full text-base"
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden />
            {t('loading.cancelRequest')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
