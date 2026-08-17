import { Button } from '@4d/ui'
import { List, Plus } from 'lucide-react'
import { EmptyPanel as AppEmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { isHardcodedPickList, isValidPickListName, type PickListScope } from '~/lib/env'
import { DataclassListRow } from './DataclassListRow'
import { HardcodedListRow } from './HardcodedListRow'
import { useListsEditor } from './use-lists-editor'

export function ListsEditor({
  scope,
  onMovedTo,
}: {
  scope: PickListScope
  onMovedTo?: (scope: PickListScope) => void
}) {
  const { t } = useTranslation()
  const {
    entries,
    attrsByDc,
    refreshingId,
    pendingFocusId,
    dataclassOptions,
    getListValuesState,
    invalidatePickList,
    ConfirmDialog,
    addEntry,
    replaceEntry,
    handleTypeChange,
    handleDataclassChange,
    refreshEntry,
    removeEntry,
    removeAllEntriesExcept,
    transferTargets,
    transferEntry,
  } = useListsEditor(scope, { onMovedTo })

  if (entries.length === 0) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AppEmptyPanel
            icon={List}
            title={t('lists.emptyTitle')}
            description={t('lists.emptyDescription')}
            size="md"
            className="h-full min-h-0"
            action={<EmptyPanelAction onClick={addEntry}>{t('lists.add')}</EmptyPanelAction>}
          />
        </div>
        <ConfirmDialog />
      </>
    )
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-border/50 border-b px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            {t('lists.usageHint')}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={addEntry}
          >
            <Plus className="mr-1 h-3 w-3" aria-hidden />
            {t('lists.add')}
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-auto overscroll-contain p-2">
          {entries.map((entry) => {
            const nameOk = !entry.name.trim() || isValidPickListName(entry.name)
            const valuesState = getListValuesState(entry)
            const loading = refreshingId === entry.id || valuesState.status === 'loading'

            if (isHardcodedPickList(entry)) {
              return (
                <HardcodedListRow
                  key={entry.id}
                  entry={entry}
                  nameOk={nameOk}
                  pendingFocusId={pendingFocusId}
                  onNameChange={(name) => replaceEntry(entry.id, { ...entry, name })}
                  onTypeChange={(type) => handleTypeChange(entry.id, type)}
                  onValuesChange={(values) => replaceEntry(entry.id, { ...entry, values })}
                  onRemove={() => removeEntry(entry.id)}
                  onRemoveExcept={() => void removeAllEntriesExcept(entry.id)}
                  transferTargets={transferTargets}
                  onMoveTo={(target) => void transferEntry(entry.id, target, 'move')}
                  onDuplicateTo={(target) => void transferEntry(entry.id, target, 'duplicate')}
                />
              )
            }

            return (
              <DataclassListRow
                key={entry.id}
                entry={entry}
                nameOk={nameOk}
                loading={loading}
                valuesState={valuesState}
                dataclassOptions={dataclassOptions}
                attrs={attrsByDc[entry.dataclass] ?? []}
                pendingFocusId={pendingFocusId}
                onNameChange={(name) => replaceEntry(entry.id, { ...entry, name })}
                onTypeChange={(type) => handleTypeChange(entry.id, type)}
                onDataclassChange={(dataclass) => void handleDataclassChange(entry.id, dataclass)}
                onAttributeChange={(attribute) => {
                  invalidatePickList(entry.id)
                  replaceEntry(entry.id, { ...entry, attribute })
                }}
                onRefresh={() => void refreshEntry(entry.id)}
                onRemove={() => removeEntry(entry.id)}
                onRemoveExcept={() => void removeAllEntriesExcept(entry.id)}
                transferTargets={transferTargets}
                onMoveTo={(target) => void transferEntry(entry.id, target, 'move')}
                onDuplicateTo={(target) => void transferEntry(entry.id, target, 'duplicate')}
              />
            )
          })}
        </div>
      </div>
      <ConfirmDialog />
    </>
  )
}
