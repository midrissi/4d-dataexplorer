import { SegmentedControl } from '@4d/ui'
import { Hexagon, Table2 } from 'lucide-react'
import { useTranslation } from '~/i18n'
import type { DataclassExportMode } from '~/lib/rest-export'
import { RestExportSelectableList } from './RestExportSelectableList'

export function RestExportSelectionPanel({
  dataClassNames,
  singletonNames,
  selectedDataClasses,
  selectedSingletons,
  dataclassMode,
  dataClassFunctionCounts,
  omittedWithoutFunctions,
  onDataclassModeChange,
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
  dataclassMode: DataclassExportMode
  dataClassFunctionCounts?: Record<string, number>
  omittedWithoutFunctions?: number
  onDataclassModeChange: (mode: DataclassExportMode) => void
  onToggleDataClass: (name: string, checked: boolean) => void
  onToggleSingleton: (name: string, checked: boolean) => void
  onSelectAllDataClasses: () => void
  onSelectNoneDataClasses: () => void
  onSelectAllSingletons: () => void
  onSelectNoneSingletons: () => void
}) {
  const { t } = useTranslation()
  const collectionVar = dataclassMode === 'collectionVar'
  const omitted = omittedWithoutFunctions ?? 0
  const dataclassTitle = collectionVar
    ? t('restExportBuilder.dataclassesWithFunctions')
    : t('restExportBuilder.dataclasses')

  return (
    <div className="space-y-2">
      <section className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <SegmentedControl
          aria-label={t('restExportBuilder.dataclassModeAria')}
          value={dataclassMode}
          onValueChange={onDataclassModeChange}
          options={[
            { value: 'expanded', label: t('restExportBuilder.dataclassModeExpanded') },
            {
              value: 'collectionVar',
              label: t('restExportBuilder.dataclassModeCollectionVar'),
            },
          ]}
        />
        <p className="text-[11px] text-muted-foreground">
          {collectionVar
            ? t('restExportBuilder.dataclassModeHintCollectionVar')
            : t('restExportBuilder.dataclassModeHintExpanded')}
        </p>
      </section>
      <div className="flex flex-col gap-2 sm:flex-row">
        <RestExportSelectableList
          icon={Table2}
          title={dataclassTitle}
          listId="dataclasses"
          names={dataClassNames}
          selected={selectedDataClasses}
          onToggle={onToggleDataClass}
          onSelectAll={onSelectAllDataClasses}
          onSelectNone={onSelectNoneDataClasses}
          emptyTitle={dataclassTitle}
          emptyDescription={
            collectionVar
              ? t('restExportBuilder.noDataclassesWithFunctions')
              : t('restExportBuilder.noDataclasses')
          }
          counts={dataClassFunctionCounts}
          hint={
            collectionVar && omitted > 0
              ? t('restExportBuilder.omittedWithoutFunctions', { count: omitted })
              : undefined
          }
        />
        <RestExportSelectableList
          icon={Hexagon}
          title={t('restExportBuilder.singletons')}
          listId="singletons"
          names={singletonNames}
          selected={selectedSingletons}
          onToggle={onToggleSingleton}
          onSelectAll={onSelectAllSingletons}
          onSelectNone={onSelectNoneSingletons}
          emptyTitle={t('restExportBuilder.singletons')}
          emptyDescription={t('restExportBuilder.noSingletons')}
        />
      </div>
    </div>
  )
}
