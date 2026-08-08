import { ClickToCopy, cn } from '@4d/ui'
import { KeyRound } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

export function EntitySelectionKeyBar({ entitySetId }: { entitySetId: string }) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{t('methodExecutor.selectionKey')}</span>
      <ClickToCopy
        value={entitySetId}
        tooltipLabel={t('common.clickToCopy')}
        tooltipCopiedLabel={t('common.copied')}
        className={cn(
          'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded border bg-background font-mono text-foreground hover:bg-accent',
          mobile ? 'min-h-9 px-2 py-1.5 text-xs' : 'px-2 py-0.5 text-xs'
        )}
      >
        <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate">{entitySetId}</span>
      </ClickToCopy>
    </div>
  )
}
