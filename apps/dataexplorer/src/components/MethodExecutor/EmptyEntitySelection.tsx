import { ExternalLink, Inbox, KeyRound, Rows3 } from 'lucide-react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { EntitySelectionKeyBar } from './EntitySelectionKeyBar'

export function EmptyEntitySelection({
  dataClass,
  entitySetId,
  count = 0,
  onOpenSelection,
}: {
  dataClass: string | null
  entitySetId?: string
  /** Total entities in the selection (`__COUNT`), even when `__ENTITIES` is empty. */
  count?: number
  onOpenSelection?: () => void
}) {
  const { t } = useTranslation()
  const name = dataClass ?? t('methodExecutor.entitySelection')
  const hasEntities = count > 0
  const canOpen = Boolean(onOpenSelection && (entitySetId || dataClass))

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {entitySetId ? <EntitySelectionKeyBar entitySetId={entitySetId} /> : null}
      <EmptyPanel
        icon={Inbox}
        badgeLabel={String(count)}
        badgeTone={hasEntities ? 'amber' : 'primary'}
        title={
          hasEntities
            ? t('methodExecutor.emptySelectionWithCountTitle')
            : t('methodExecutor.emptySelectionTitle')
        }
        description={
          hasEntities
            ? t('methodExecutor.emptySelectionWithCountDescription', { name, count })
            : t('methodExecutor.emptySelectionDescription', { name })
        }
        ghost="rows"
        bordered
        size="lg"
        className="min-h-0 flex-1"
        chips={[
          { icon: Rows3, label: name, tone: 'primary' },
          {
            icon: KeyRound,
            label: hasEntities
              ? t('methodExecutor.emptySelectionWithCountHint', { count })
              : t('methodExecutor.emptySelectionHint'),
            tone: 'amber',
          },
        ]}
        action={
          hasEntities && canOpen ? (
            <EmptyPanelAction onClick={onOpenSelection}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {t('methodExecutor.openAll')}
            </EmptyPanelAction>
          ) : null
        }
      />
    </div>
  )
}
