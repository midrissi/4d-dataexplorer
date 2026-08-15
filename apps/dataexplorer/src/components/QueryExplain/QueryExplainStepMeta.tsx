import { SavedListMetaPill } from '~/components/SavedListPanel'
import { useTranslation } from '~/i18n'

export function QueryExplainStepMeta({
  timeMs,
  recordsFound,
}: {
  timeMs?: number
  recordsFound?: number
}) {
  const { t } = useTranslation()
  if (timeMs == null && recordsFound == null) return null
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {timeMs != null ? (
        <SavedListMetaPill className="border-border/50 bg-muted/40 text-muted-foreground">
          {t('queryExplain.timeMs', { ms: timeMs })}
        </SavedListMetaPill>
      ) : null}
      {recordsFound != null ? (
        <SavedListMetaPill className="border-border/50 bg-muted/40 text-muted-foreground">
          {t('queryExplain.recordsFound', { count: recordsFound })}
        </SavedListMetaPill>
      ) : null}
    </span>
  )
}
