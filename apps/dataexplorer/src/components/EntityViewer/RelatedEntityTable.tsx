import { EntityDataGrid } from '~/components/EntityDataGrid'
import { useTranslation } from '~/i18n'
import type { Entity } from '~/store'

export function RelatedEntityTable({
  items,
  sortColumn,
  sortOrder,
  onSortChange,
}: {
  items: Record<string, unknown>[]
  sortColumn: string | null
  sortOrder: 'asc' | 'desc'
  onSortChange: (column: string | null, order: 'asc' | 'desc') => void
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <p className="py-1 text-muted-foreground text-sm italic">{t('entity.noRelatedEntities')}</p>
    )
  }

  return (
    <div className="h-80 overflow-hidden rounded-md border">
      <EntityDataGrid
        entities={items as Entity[]}
        showActions={false}
        sortColumn={sortColumn}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
      />
    </div>
  )
}
