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
  nameIssue,
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
  nameIssue: 'invalid' | 'duplicate' | null
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
      nameIssue={nameIssue}
      placeholder="statusCodes"
      pendingFocusId={pendingFocusId}
      onNameChange={onNameChange}
      onTypeChange={onTypeChange}
      onRemove={onRemove}
      onRemoveExcept={onRemoveExcept}
      transferTargets={transferTargets}
      onMoveTo={onMoveTo}
      onDuplicateTo={onDuplicateTo}
      trailing={
        <Badge
          variant="muted"
          className="h-5 shrink-0 px-1.5 py-0 font-mono text-[9px] tabular-nums"
        >
          {entry.values.length}
        </Badge>
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
