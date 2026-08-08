import { isInternalAttribute } from '~/lib/entity-viewer/attributes'
import { getDeferredRelation } from '~/lib/entity-viewer/deferred'
import { DeferredRelation } from './DeferredRelation'
import { MetadataPanel } from './MetadataPanel'
import { RelationCellValue } from './RelationCellValue'

export function RelatedEntityForm({ entity }: { entity: Record<string, unknown> }) {
  const internalEntries = Object.entries(entity).filter(([key]) => isInternalAttribute(key))
  const fields = Object.entries(entity).filter(([key]) => !isInternalAttribute(key))
  if (internalEntries.length === 0 && fields.length === 0) return null

  return (
    <div className="space-y-2 py-1">
      <MetadataPanel entries={internalEntries} />
      {fields.map(([key, value]) => {
        const rel = getDeferredRelation(value)
        if (rel) {
          return (
            <DeferredRelation
              key={key}
              name={key}
              uri={rel.uri}
              kind={rel.key != null ? 'relatedEntity' : 'relatedEntities'}
              displayMode="form"
            />
          )
        }
        return (
          <div
            key={key}
            className="grid grid-cols-[minmax(140px,auto)_1fr] items-start gap-3 text-sm"
          >
            <span className="font-medium text-muted-foreground">{key}</span>
            <div className="min-w-0">
              <RelationCellValue value={value} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
