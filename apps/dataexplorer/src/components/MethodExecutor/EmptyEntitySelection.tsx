import { Inbox, KeyRound, Rows3 } from 'lucide-react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { EntitySelectionKeyBar } from './EntitySelectionKeyBar'

export function EmptyEntitySelection({
  dataClass,
  entitySetId,
}: {
  dataClass: string | null
  entitySetId?: string
}) {
  const { t } = useTranslation()
  const name = dataClass ?? t('methodExecutor.entitySelection')

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {entitySetId ? <EntitySelectionKeyBar entitySetId={entitySetId} /> : null}
      <EmptyPanel
        icon={Inbox}
        badgeLabel="0"
        badgeTone="primary"
        title={t('methodExecutor.emptySelectionTitle')}
        description={t('methodExecutor.emptySelectionDescription', { name })}
        ghost="rows"
        bordered
        size="lg"
        className="min-h-0 flex-1"
        chips={[
          { icon: Rows3, label: name, tone: 'primary' },
          { icon: KeyRound, label: t('methodExecutor.emptySelectionHint'), tone: 'amber' },
        ]}
      />
    </div>
  )
}
