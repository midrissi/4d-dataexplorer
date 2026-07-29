import { Button, cn, PasswordInput } from '@4d/ui'
import { AlertCircle, ArrowLeft, Database } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { formatThrownError } from '~/lib/api'
import { isMobileShell } from '~/lib/platform'

type AccessKeyScreenProps = {
  onSubmit: (accessKey: string) => Promise<void>
  /** Prefill from the desktop connection profile when available. */
  initialAccessKey?: string
  /** Why the user was sent here (login failure, 401, etc.). */
  reason?: string | null
  /** Desktop: return to the connection edit form. */
  onBack?: () => void
}

export function AccessKeyScreen({
  onSubmit,
  initialAccessKey = '',
  reason = null,
  onBack,
}: AccessKeyScreenProps) {
  const { t } = useTranslation()
  const [accessKey, setAccessKey] = useState(initialAccessKey)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const key = accessKey.trim()
      if (!key) return
      setError(null)
      setSubmitting(true)
      try {
        await onSubmit(key)
      } catch (err) {
        setError(formatThrownError(err, t('loading.accessKeyError')))
      } finally {
        setSubmitting(false)
      }
    },
    [accessKey, onSubmit, t]
  )

  return (
    <div
      className={
        isMobileShell()
          ? 'flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-background px-4 pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)]'
          : 'flex h-screen w-full flex-col items-center justify-center bg-background'
      }
    >
      {' '}
      <div className="mb-4 flex flex-col items-center">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary shadow-primary/20 shadow-sm">
          <Database className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="font-bold text-xl tracking-tight">{t('loading.title')}</h1>
        <p className="text-muted-foreground text-xs">{t('loading.subtitle')}</p>
      </div>
      <div className="w-full max-w-sm">
        {reason ? (
          <div
            data-testid="access-key-reason"
            className="mb-3 rounded-md border border-destructive/50 bg-destructive/5 p-2.5"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-destructive text-xs">
                  {t('loading.accessKeyRedirectTitle')}
                </p>
                <p className="mt-0.5 text-destructive/80 text-xs leading-relaxed">{reason}</p>
              </div>
            </div>
          </div>
        ) : null}
        <p className="mb-3 text-center text-muted-foreground text-xs">
          {t('loading.accessKeyRequired')}
        </p>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1.5">
            <label htmlFor="accessKey" className="sr-only">
              {t('loading.accessKeyPlaceholder')}
            </label>
            <PasswordInput
              ref={inputRef}
              id="accessKey"
              autoFocus
              autoComplete="off"
              placeholder={t('loading.accessKeyPlaceholder')}
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              disabled={submitting}
              className={cn('h-8 w-full text-xs', isMobileShell() && 'h-11 text-base')}
            />
          </div>
          {error && (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="sm"
            className="h-8 w-full"
            disabled={submitting || !accessKey.trim()}
          >
            {submitting ? t('loading.submittingAccessKey') : t('loading.submitAccessKey')}
          </Button>
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-muted-foreground text-xs"
              disabled={submitting}
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              {t('loading.backToConnections')}
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
