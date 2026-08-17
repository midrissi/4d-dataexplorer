import { Badge, Button } from '@4d/ui'
import { CircleAlert, Loader2, RefreshCw } from 'lucide-react'
import type { MutableRefObject } from 'react'
import { EntityIoSelect, type EntityIoSelectOption } from '~/components/EntityIo/EntityIoSelect'
import { useTranslation } from '~/i18n'
import type { EntityIoAttribute } from '~/lib/entity-io'
import type {
  DataclassPickListDeclaration,
  PickListKind,
  PickListScope,
  PickListValuesState,
} from '~/lib/env'
import { formatListValuesPreview } from './format-list-values-preview'
import { ListRowChrome } from './ListRowChrome'

export function DataclassListRow({
  entry,
  nameIssue,
  loading,
  valuesState,
  dataclassOptions,
  attrs,
  pendingFocusId,
  onNameChange,
  onTypeChange,
  onDataclassChange,
  onAttributeChange,
  onRefresh,
  onRemove,
  onRemoveExcept,
  transferTargets,
  onMoveTo,
  onDuplicateTo,
}: {
  entry: DataclassPickListDeclaration
  nameIssue: 'invalid' | 'duplicate' | null
  loading: boolean
  valuesState: PickListValuesState
  dataclassOptions: EntityIoSelectOption<string>[]
  attrs: EntityIoAttribute[]
  pendingFocusId: MutableRefObject<string | null>
  onNameChange: (name: string) => void
  onTypeChange: (type: PickListKind) => void
  onDataclassChange: (dataclass: string) => void
  onAttributeChange: (attribute: string) => void
  onRefresh: () => void
  onRemove: () => void
  onRemoveExcept: () => void
  transferTargets: { value: PickListScope; label: string }[]
  onMoveTo: (scope: PickListScope) => void
  onDuplicateTo: (scope: PickListScope) => void
}) {
  const { t } = useTranslation()
  const preview = formatListValuesPreview(valuesState)
  const attributeOptions: EntityIoSelectOption<string>[] = [
    ...(entry.attribute && !attrs.some((a) => a.name === entry.attribute)
      ? [{ value: entry.attribute, label: entry.attribute }]
      : []),
    ...attrs.map((attr) => ({ value: attr.name, label: attr.name })),
  ]
  if (attributeOptions.length === 0) {
    attributeOptions.push({ value: '', label: t('lists.attribute') })
  }

  return (
    <ListRowChrome
      entry={entry}
      nameIssue={nameIssue}
      placeholder="companyKeys"
      pendingFocusId={pendingFocusId}
      onNameChange={onNameChange}
      onTypeChange={onTypeChange}
      onRemove={onRemove}
      onRemoveExcept={onRemoveExcept}
      transferTargets={transferTargets}
      onMoveTo={onMoveTo}
      onDuplicateTo={onDuplicateTo}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          aria-label={t('lists.load')}
          title={t('lists.load')}
          disabled={
            !entry.name.trim() ||
            !entry.dataclass ||
            !entry.attribute ||
            loading ||
            nameIssue !== null
          }
          onClick={onRefresh}
        >
          {loading ? (
            <span className="animate-spin">
              <Loader2 className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
      }
    >
      <div className="grid min-w-0 grid-cols-[minmax(7rem,0.9fr)_minmax(7rem,0.9fr)_minmax(0,1.1fr)] items-center gap-1.5">
        <div className="focus-ring-wrap min-w-0">
          <EntityIoSelect
            ariaLabel={t('lists.dataclass')}
            value={entry.dataclass}
            onValueChange={onDataclassChange}
            options={dataclassOptions}
            className="h-7 min-w-0 font-mono text-[10px]"
          />
        </div>
        <div className="focus-ring-wrap min-w-0">
          <EntityIoSelect
            ariaLabel={t('lists.attribute')}
            value={entry.attribute}
            disabled={!entry.dataclass}
            onValueChange={onAttributeChange}
            options={attributeOptions}
            className="h-7 min-w-0 font-mono text-[10px]"
          />
        </div>
        <div
          className="flex min-w-0 items-center gap-1.5 overflow-hidden"
          title={valuesState.status === 'error' ? valuesState.message : (preview ?? undefined)}
        >
          {valuesState.status === 'ready' ? (
            <>
              <Badge
                variant="muted"
                className="h-5 shrink-0 px-1.5 py-0 font-mono text-[9px] tabular-nums"
              >
                {valuesState.values.length}
                {valuesState.truncated ? ` · ${t('lists.truncated')}` : null}
              </Badge>
              <span className="truncate font-mono text-[9px] text-muted-foreground">{preview}</span>
            </>
          ) : valuesState.status === 'empty' ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {t('lists.emptyValues')}
            </span>
          ) : valuesState.status === 'error' ? (
            <>
              <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
              <span className="truncate text-[10px] text-destructive">{valuesState.message}</span>
            </>
          ) : (
            <span className="truncate font-mono text-[9px] text-muted-foreground/70">
              {entry.dataclass && entry.attribute ? `${entry.dataclass}.${entry.attribute}` : '—'}
            </span>
          )}
        </div>
      </div>
    </ListRowChrome>
  )
}
