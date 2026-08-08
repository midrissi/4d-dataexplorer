import type { DataClassAttribute } from '@4d/rest'
import { EMPTY_VALUE } from '@4d/rest'
import { cn, Value } from '@4d/ui'
import { ChevronDown, ChevronRight, Link2, Network, Unlink } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '~/i18n'
import { relationKindFromAttr } from '~/lib/entity-viewer/attributes'

export function NullRelatedEntityCard({
  attr,
  foreignKeyValue,
}: {
  attr: Pick<
    DataClassAttribute,
    'name' | 'type' | 'kind' | 'behavior' | 'foreignKey' | 'inverseName' | 'path' | 'scope'
  >
  foreignKeyValue?: unknown
}) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const isSet = relationKindFromAttr(attr) === 'relatedEntities'
  const relatedType =
    typeof attr.type === 'string' && attr.type.trim() ? attr.type : t('entity.relatedEntity')
  const RelationIcon = isSet ? Network : Link2

  const metaParts: Array<{ key: string; label: string; value: string; mono?: boolean }> = []
  if (attr.foreignKey) {
    const fkDisplay =
      foreignKeyValue === null || foreignKeyValue === undefined || foreignKeyValue === ''
        ? EMPTY_VALUE
        : String(foreignKeyValue)
    metaParts.push({
      key: 'fk',
      label: t('entity.relationForeignKey'),
      value: `${attr.foreignKey}=${fkDisplay}`,
      mono: true,
    })
  }
  if (attr.inverseName) {
    metaParts.push({
      key: 'inv',
      label: t('entity.relationInverse'),
      value: attr.inverseName,
      mono: true,
    })
  }
  if (attr.path) {
    metaParts.push({
      key: 'path',
      label: t('entity.relationPath'),
      value: attr.path,
      mono: true,
    })
  }
  if (attr.scope) {
    metaParts.push({
      key: 'scope',
      label: t('entity.relationScope'),
      value: attr.scope,
    })
  }

  const description = isSet
    ? t('entity.nullRelatedEntitiesDescription', { type: relatedType })
    : t('entity.nullRelatedEntityDescription', { type: relatedType })

  return (
    <div className="my-0.5 overflow-hidden rounded-md border border-border/70 border-dashed bg-muted/10">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-muted/40"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted/70 text-muted-foreground">
          <Unlink className="h-3 w-3" />
        </span>
        <RelationIcon className="h-3 w-3 shrink-0 text-muted-foreground/80" />
        <span className="min-w-0 truncate font-medium text-[13px] leading-none">{attr.name}</span>
        <span className="shrink-0 rounded-sm border bg-background/80 px-1.5 py-px font-mono text-[10px] text-muted-foreground leading-none">
          {relatedType}
        </span>
        <span className="ml-auto shrink-0 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
          {t('entity.nullRelatedEntityTitle')}
        </span>
        <Value.Null className="shrink-0 border-destructive/25 bg-destructive/10 text-destructive" />
      </button>

      {isExpanded ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-border/40 border-t border-dashed bg-background/20 px-2 py-1">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground leading-snug">
            {description}
          </p>
          {metaParts.length > 0 ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {metaParts.map((part) => (
                <span
                  key={part.key}
                  className="inline-flex max-w-full items-center gap-0.5 rounded-sm border border-border/60 bg-muted/30 px-1.5 py-px text-[9px] text-muted-foreground leading-none"
                  title={`${part.label}: ${part.value}`}
                >
                  <span className="shrink-0 font-medium uppercase tracking-wide opacity-60">
                    {part.label}
                  </span>
                  <span
                    className={cn('min-w-0 truncate text-foreground/90', part.mono && 'font-mono')}
                  >
                    {part.value}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
