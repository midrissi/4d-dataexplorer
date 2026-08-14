import { cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

/** Desktop-only note that ⌘/Ctrl+click opens in a new tab. */
export function OpenInNewTabHint({
  className,
  labelKey = 'common.openInNewTabModClickHint',
}: {
  className?: string
  /** Override the default hint (e.g. Method Executor background + HTTP Client shortcuts). */
  labelKey?: string
}) {
  const { t } = useTranslation()
  if (isMobileShell()) return null

  return (
    <p className={cn('text-[10px] text-muted-foreground/85 leading-snug', className)}>
      {t(labelKey)}
    </p>
  )
}
