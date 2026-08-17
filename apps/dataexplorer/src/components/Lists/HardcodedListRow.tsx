import { Badge } from '@4d/ui'
import type { MutableRefObject } from 'react'
import { ListTagsInput, serializeListParamTags } from '~/components/RequestKeyValue/ListTagsInput'
import { useTranslation } from '~/i18n'
import {
  type HardcodedPickListDeclaration,
  type PickListKind,
  type PickListScope,
  parseHardcodedListValues,
} from '~/lib/env'
import { ListRowChrome } from './ListRowChrome'

export function HardcodedListRow({
  entry,
  nameOk,
  pendingFocusId,
  onNameChange,
  onTypeChange,
  onValuesChange,
  onRemove,
  onRemoveExcept,
  transferTargets,
  onMoveTo,
  onDuplicateTo,
}: {
  entry: HardcodedPickListDeclaration
  nameOk: boolean
  pendingFocusId: MutableRefObject<string | null>
  onNameChange: (name: string) => void
  onTypeChange: (type: PickListKind) => void
  onValuesChange: (values: string[]) => void
  onRemove: () => void
  onRemoveExcept: () => void
  transferTargets: { value: PickListScope; label: string }[]
  onMoveTo: (scope: PickListScope) => void
  onDuplicateTo: (scope: PickListScope) => void
}) {
  const { t } = useTranslation()

  return (
    <ListRowChrome
      entry={entry}
      nameOk={nameOk}
      placeholder="statusCodes"
      gridClassName="grid min-h-9 grid-cols-[minmax(6rem,0.7fr)_minmax(6.5rem,0.55fr)_minmax(10rem,1.6fr)_auto] items-start gap-1.5 rounded-md border border-border/60 bg-background/60 px-1.5 py-1 transition-colors hover:bg-muted/20"
      pendingFocusId={pendingFocusId}
      onNameChange={onNameChange}
      onTypeChange={onTypeChange}
      onRemove={onRemove}
      onRemoveExcept={onRemoveExcept}
      transferTargets={transferTargets}
      onMoveTo={onMoveTo}
      onDuplicateTo={onDuplicateTo}
      trailingClassName="flex items-center gap-0.5 pt-0.5"
      trailing={
        <Badge
          variant="muted"
          className="h-5 shrink-0 px-1.5 py-0 font-mono text-[9px] tabular-nums"
        >
          {entry.values.length}
        </Badge>
      }
      footer={
        !nameOk ? (
          <span className="col-span-full truncate text-[10px] text-destructive" role="alert">
            {t('lists.nameInvalid')}
          </span>
        ) : null
      }
    >
      <div className="min-w-0 rounded-md border border-border/50 bg-background/80">
        <ListTagsInput
          value={serializeListParamTags(entry.values)}
          aria-label={t('lists.values')}
          placeholder={t('lists.valuesPlaceholder')}
          onChange={(raw) => onValuesChange(parseHardcodedListValues(raw))}
        />
      </div>
    </ListRowChrome>
  )
}
