import { cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { platformModLabel } from '~/store/settings'

/** Desktop-only note for mod+click open shortcuts (⌘ on Mac, Ctrl elsewhere). */
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
      {t(labelKey, { mod: platformModLabel() })}
    </p>
  )
}
