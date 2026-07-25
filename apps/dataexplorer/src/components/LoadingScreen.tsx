import { cn } from '@4d/ui'
import { AlertCircle, ArrowLeft, Check, Database, Loader2, RefreshCw, Table2 } from 'lucide-react'
import { useTranslation } from '~/i18n'

export type LoadingStep = {
  id: string
  label: string
  status: 'pending' | 'loading' | 'done' | 'error'
  detail?: string
}

type LoadingScreenProps = {
  steps: LoadingStep[]
  error?: string | null
  onRetry?: () => void
  onDisconnect?: () => void
}

export function LoadingScreen({ steps, error, onRetry, onDisconnect }: LoadingScreenProps) {
  const { t } = useTranslation()
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      {/* Logo and title */}
      <div className="mb-4 flex flex-col items-center">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary shadow-primary/20 shadow-sm">
          <Database className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="font-bold text-xl tracking-tight">{t('loading.title')}</h1>
        <p className="text-muted-foreground text-xs">{t('loading.subtitle')}</p>
      </div>

      {/* Loading steps */}
      <div className="w-full max-w-sm space-y-1.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-all',
              step.status === 'loading' && 'border-primary/50 bg-primary/5',
              step.status === 'done' && 'border-success/30 bg-success/5',
              step.status === 'error' && 'border-destructive/50 bg-destructive/5',
              step.status === 'pending' && 'border-border bg-muted/30 opacity-50'
            )}
          >
            {/* Status icon */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center">
              {step.status === 'loading' && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {step.status === 'done' && <Check className="h-4 w-4 text-success" />}
              {step.status === 'error' && <span className="text-destructive text-sm">✕</span>}
              {step.status === 'pending' && <Table2 className="h-4 w-4 text-muted-foreground/50" />}
            </div>

            {/* Label and detail */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'font-medium text-xs',
                  step.status === 'pending' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
              {step.detail && (
                <p className="truncate text-[11px] text-muted-foreground">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 w-full max-w-sm rounded-md border border-destructive/50 bg-destructive/5 p-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-destructive text-xs">
                {t('loading.connectionError')}
              </p>
              <p className="mt-0.5 text-destructive/80 text-xs leading-relaxed">{error}</p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-destructive/10 px-2.5 font-medium text-destructive text-xs transition-colors hover:bg-destructive/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('loading.retry')}
              </button>
            )}
            {onDisconnect && (
              <button
                type="button"
                onClick={onDisconnect}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-muted px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted/80"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('loading.backToConnections')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
