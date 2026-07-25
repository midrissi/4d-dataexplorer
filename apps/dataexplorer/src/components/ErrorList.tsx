import { Button, ClickToCopy, cn } from '@4d/ui'
import { AlertCircle, Copy, X } from 'lucide-react'
import { useTranslation } from '~/i18n'

function getErrorMessages(error: string): string[] {
  return error
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface ErrorListProps {
  error: string
  title?: string
  onDismiss?: () => void
  className?: string
  /** 'inline' = form/modal, 'banner' = viewer header, 'centered' = full-page */
  variant?: 'inline' | 'banner' | 'centered'
}

export function ErrorList({
  error,
  title,
  onDismiss,
  className,
  variant = 'inline',
}: ErrorListProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('common.couldntSave')
  const messages = getErrorMessages(error)

  if (messages.length === 0) return null

  const isCentered = variant === 'centered'
  const isBanner = variant === 'banner'

  // Build stable, unique keys even when the same message text repeats.
  const seenMessageCounts = new Map<string, number>()
  const keyedMessages = messages.map((text) => {
    const occurrence = seenMessageCounts.get(text) ?? 0
    seenMessageCounts.set(text, occurrence + 1)
    return { key: occurrence === 0 ? text : `${text}#${occurrence}`, text }
  })

  const listContent = (
    <ul
      className="list-none space-y-0.5 text-sm leading-snug"
      style={{ color: 'var(--destructive)' }}
    >
      {keyedMessages.map(({ key, text }) => (
        <li key={key} className="flex gap-1.5">
          <span
            className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: 'var(--destructive)' }}
            aria-hidden
          />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )

  const copyButton = (
    <ClickToCopy
      value={error}
      tooltipLabel={t('common.copyForSupport')}
      tooltipCopiedLabel={t('common.copied')}
      className="inline-flex h-auto items-center gap-1 p-0 font-medium text-destructive text-xs hover:text-destructive/90"
    >
      <Copy className="h-3.5 w-3.5 shrink-0" />
      {t('common.copyForSupport')}
    </ClickToCopy>
  )

  if (isCentered) {
    return (
      <div
        className={cn(
          'max-w-md rounded-lg border border-destructive/60 border-l-4 border-l-destructive bg-destructive/10 px-3 py-2.5 text-left shadow-sm',
          className
        )}
        role="alert"
      >
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/20">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="font-semibold text-destructive text-sm">{resolvedTitle}</p>
        </div>
        <div className="mt-1.5">{listContent}</div>
        <div className="mt-1.5 border-destructive/20 border-t pt-1.5">{copyButton}</div>
      </div>
    )
  }

  if (isBanner) {
    return (
      <div
        className={cn(
          'flex items-start gap-1.5 border-destructive/60 border-b bg-destructive/10 px-3 py-2 text-destructive shadow-sm',
          className
        )}
        role="alert"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/20">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="font-semibold text-destructive text-sm">{resolvedTitle}</p>
          {listContent}
          <div>{copyButton}</div>
        </div>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-destructive"
            onClick={onDismiss}
            aria-label={t('common.dismissAria')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fade-in-0 mt-2 shrink-0 animate-in rounded-lg border border-destructive/60 border-l-4 border-l-destructive bg-destructive/10 px-3 py-2 shadow-sm duration-200',
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/20">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        </div>
        <p className="font-semibold text-destructive text-sm">{resolvedTitle}</p>
      </div>
      <div className="mt-1.5">{listContent}</div>
      <div className="mt-1.5 border-destructive/20 border-t pt-1.5">{copyButton}</div>
    </div>
  )
}
