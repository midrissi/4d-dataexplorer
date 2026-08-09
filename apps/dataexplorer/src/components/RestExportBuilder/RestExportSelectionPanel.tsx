import { Checkbox, cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { triState } from '~/lib/rest-export'
import { RestExportTriStateIconButton } from './RestExportTriStateIconButton'

function SelectableList({
  title,
  names,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  emptyLabel,
}: {
  title: string
  names: string[]
  selected: string[]
  onToggle: (name: string, checked: boolean) => void
  onSelectAll: () => void
  onSelectNone: () => void
  emptyLabel: string
}) {
  const { t } = useTranslation()
  const selectedSet = new Set(selected)
  const state = triState(selected.length, names.length)

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-medium text-xs">{title}</p>
        <RestExportTriStateIconButton
          state={state}
          labels={{
            false: t('restExportBuilder.selectAll'),
            indeterminate: t('restExportBuilder.selectAll'),
            true: t('restExportBuilder.selectNone'),
          }}
          disabled={names.length === 0}
          onToggle={(selectAll) => (selectAll ? onSelectAll() : onSelectNone())}
        />
      </div>
      {names.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/20">
          {names.map((name) => {
            const id = `rest-export-${title}-${name}`
            const checked = selectedSet.has(name)
            return (
              <label
                key={name}
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-border/50 border-b px-2 py-1.5 last:border-b-0',
                  'hover:bg-muted/50'
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(value) => onToggle(name, value === true)}
                />
                <span className="min-w-0 truncate font-mono text-xs">{name}</span>
              </label>
            )
          })}
        </div>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t('restExportBuilder.selectedCount', { count: selected.length })}
      </p>
    </div>
  )
}

export function RestExportSelectionPanel({
  dataClassNames,
  singletonNames,
  selectedDataClasses,
  selectedSingletons,
  onToggleDataClass,
  onToggleSingleton,
  onSelectAllDataClasses,
  onSelectNoneDataClasses,
  onSelectAllSingletons,
  onSelectNoneSingletons,
}: {
  dataClassNames: string[]
  singletonNames: string[]
  selectedDataClasses: string[]
  selectedSingletons: string[]
  onToggleDataClass: (name: string, checked: boolean) => void
  onToggleSingleton: (name: string, checked: boolean) => void
  onSelectAllDataClasses: () => void
  onSelectNoneDataClasses: () => void
  onSelectAllSingletons: () => void
  onSelectNoneSingletons: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <SelectableList
        title={t('restExportBuilder.dataclasses')}
        names={dataClassNames}
        selected={selectedDataClasses}
        onToggle={onToggleDataClass}
        onSelectAll={onSelectAllDataClasses}
        onSelectNone={onSelectNoneDataClasses}
        emptyLabel={t('restExportBuilder.noDataclasses')}
      />
      <SelectableList
        title={t('restExportBuilder.singletons')}
        names={singletonNames}
        selected={selectedSingletons}
        onToggle={onToggleSingleton}
        onSelectAll={onSelectAllSingletons}
        onSelectNone={onSelectNoneSingletons}
        emptyLabel={t('restExportBuilder.noSingletons')}
      />
    </div>
  )
}
