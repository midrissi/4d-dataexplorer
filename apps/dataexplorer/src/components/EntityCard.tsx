import { EMPTY_VALUE, formatValue } from '@4d/rest'
import { Button, ClickToCopy, cn, Value } from '@4d/ui'
import { Clock, Copy, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { DeferredImage } from '~/components/DeferredImage'
import { getIntlLocale, useTranslation } from '~/i18n'
import { getEntityTimestamp } from '~/lib/entity-timestamp'
import {
  DEFERRED_RELATION_MARKER,
  getByPath,
  getImageUri,
  isDeferredRelationValue,
} from '~/lib/fieldPaths'
import { isMobileShell } from '~/lib/platform'
import type { Entity } from '~/store'

export type EntityCardProps = {
  entity: Entity
  index: number
  isSelected: boolean
  isFocused: boolean
  readonlyMode: boolean
  /** Ordered (possibly dotted) attribute paths to show; empty = default preview. */
  cardFields?: string[]
  /** Catalog schema for the dataclass; used to hide relation attributes. */
  schema?: Array<{ name: string; type: string; kind?: string; behavior?: string }>
  isExpanded: boolean
  onToggleExpand: () => void
  onSelect: (entity: Entity, index: number) => void
  onDuplicate: () => void
  onDelete: () => void
  cardRef: (el: HTMLDivElement | null) => void
  duplicateShortcut?: string
  deleteShortcut?: string
}

export function EntityCard({
  entity,
  index,
  isSelected,
  isFocused,
  readonlyMode,
  cardFields,
  schema,
  isExpanded,
  onToggleExpand,
  onSelect,
  onDuplicate,
  onDelete,
  cardRef,
  duplicateShortcut,
  deleteShortcut,
}: EntityCardProps) {
  const { t, language } = useTranslation()
  const locale = getIntlLocale(language)
  // When the user has chosen specific card fields, show exactly those (in order,
  // resolving nested relation paths); otherwise preview the first few attributes.
  const usingCustomFields = (cardFields?.length ?? 0) > 0
  // Relation attributes (relatedEntity / relatedEntities) must not be shown in
  // the card preview, so collect their names from the catalog schema. Calculated
  // or alias attributes that resolve to an entity selection are flagged via
  // `behavior` rather than `kind`.
  const relationNames = useMemo(() => {
    const names = new Set<string>()
    for (const attr of schema ?? []) {
      if (
        attr.kind === 'relatedEntity' ||
        attr.kind === 'relatedEntities' ||
        attr.behavior === 'relatedEntity' ||
        attr.behavior === 'relatedEntities'
      ) {
        names.add(attr.name)
      }
    }
    return names
  }, [schema])
  const allFields = Object.entries(entity).filter(
    ([key, value]) =>
      !key.startsWith('__') &&
      key !== 'id' &&
      !relationNames.has(key) &&
      !isDeferredRelationValue(value)
  )
  const PREVIEW_COUNT = 4
  const remainingCount = usingCustomFields ? 0 : allFields.length - PREVIEW_COUNT
  const previewFields: Array<readonly [string, unknown]> = usingCustomFields
    ? (cardFields ?? []).map((path) => [path, getByPath(entity, path)] as const)
    : isExpanded
      ? allFields
      : allFields.slice(0, PREVIEW_COUNT)

  const timestamp = getEntityTimestamp(entity, locale)
  // Touch devices have no hover state, so per-card actions must stay visible
  // and use touch-sized targets instead of the desktop hover-reveal + xs icons.
  const mobile = isMobileShell()

  return (
    <div
      ref={cardRef}
      id={`entity-${entity.id}`}
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(entity, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(entity, index)
        }
      }}
      className={cn(
        'group relative w-full cursor-pointer rounded-lg border bg-card text-left shadow-sm outline-none transition-all hover:shadow-md',
        mobile ? 'p-4' : 'p-3',
        isSelected
          ? 'border-primary ring-1 ring-primary/30'
          : 'border-border hover:border-primary/50',
        isFocused && !isSelected && 'bg-muted/50'
      )}
    >
      {/* Header with key and actions */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <ClickToCopy
          as="code"
          value={String(entity.__KEY ?? '')}
          tooltipLabel={t('common.clickToCopy')}
          tooltipCopiedLabel={t('common.copied')}
          className="min-w-0 max-w-full truncate rounded-md bg-primary/10 px-2 py-1 font-medium font-mono text-primary text-xs hover:bg-primary/20"
        >
          {entity.__KEY}
        </ClickToCopy>
        <div
          className={cn(
            'flex items-center gap-0.5 transition-opacity',
            mobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <ClickToCopy
            value={JSON.stringify(entity, null, 2)}
            tooltipLabel={t('entity.copyJson')}
            tooltipCopiedLabel={t('common.copied')}
            className={cn(
              'rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
              mobile ? 'p-2.5' : 'p-1.5'
            )}
          >
            <Copy className="h-3.5 w-3.5" />
          </ClickToCopy>
          {!readonlyMode && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
                className={cn('text-muted-foreground', mobile ? 'h-9! w-9!' : 'h-6! w-6!')}
                title={
                  duplicateShortcut
                    ? `${t('entity.duplicate')} (${duplicateShortcut})`
                    : t('entity.duplicate')
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className={cn('text-muted-foreground', mobile ? 'h-9! w-9!' : 'h-6! w-6!')}
                title={
                  deleteShortcut ? `${t('entity.delete')} (${deleteShortcut})` : t('entity.delete')
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview fields */}
      <div className="space-y-1.5">
        {previewFields.map(([key, value]) => {
          if (value === DEFERRED_RELATION_MARKER) {
            return (
              <div key={key} className="text-sm">
                <span className="font-medium text-muted-foreground">{key}:</span>{' '}
                <span className="font-mono text-muted-foreground text-xs">
                  {t('fieldManager.relationNotLoaded')}
                </span>
              </div>
            )
          }
          if (getImageUri(value)) {
            return (
              <div key={key} className="text-sm">
                <span className="font-medium text-muted-foreground">{key}:</span>{' '}
                <DeferredImage
                  value={value}
                  alt={String(key)}
                  className="mt-1 max-h-24 max-w-full rounded border object-contain"
                />
              </div>
            )
          }
          const formatted = formatValue(value, locale)
          const isNull = value === null || value === undefined || formatted === EMPTY_VALUE
          return (
            <div key={key} className="text-sm">
              <span className="font-medium text-muted-foreground">{key}:</span>{' '}
              {isNull ? (
                <Value.Null />
              ) : (
                <span className="wrap-break-word text-foreground">{formatted}</span>
              )}
            </div>
          )
        })}
        {previewFields.length === 0 && (
          <p className="text-muted-foreground text-sm italic">{t('entity.noPreviewAvailable')}</p>
        )}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="mt-1 font-medium text-primary text-xs hover:underline"
          >
            {isExpanded
              ? t('entity.showLessFields')
              : t('entity.showMoreFields', { count: remainingCount })}
          </button>
        )}
      </div>

      {/* Footer with stamp and timestamp */}
      <div className="mt-3 flex items-center justify-between border-border/50 border-t pt-2">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            {t('entity.stampLabel')} {entity.__STAMP}
          </span>
          {timestamp && (
            <span
              className="flex items-center gap-1 text-muted-foreground text-xs"
              title={t('entity.timestamp')}
            >
              <Clock className="h-3 w-3" />
              {timestamp.value}
            </span>
          )}
        </div>
        {isSelected && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
            {t('entity.selected')}
          </span>
        )}
      </div>
    </div>
  )
}
