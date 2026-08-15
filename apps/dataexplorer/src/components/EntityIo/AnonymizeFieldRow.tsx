import { memo, useMemo } from 'react'
import type { SuggestInputSuggestion } from '~/components/SuggestInput'
import { SuggestInput } from '~/components/SuggestInput'
import type { AnonymizeFieldMode, AnonymizeFieldPlan } from '~/lib/entity-io'
import { suggestionsForAnonymizeField } from './anonymize-faker-suggestions'
import { EntityIoSelect, type EntityIoSelectOption } from './EntityIoSelect'

export const AnonymizeFieldRow = memo(function AnonymizeFieldRow({
  field,
  modeOptions,
  modeLabel,
  fakerCatalog,
  fakerGroupLabels,
  onChange,
}: {
  field: AnonymizeFieldPlan
  modeOptions: EntityIoSelectOption<AnonymizeFieldMode>[]
  modeLabel: string
  fakerCatalog: readonly SuggestInputSuggestion[]
  fakerGroupLabels: Readonly<Record<string, string>>
  onChange: (name: string, patch: Partial<AnonymizeFieldPlan>) => void
}) {
  const suggestions = useMemo(
    () => suggestionsForAnonymizeField(field.name, fakerCatalog),
    [field.name, fakerCatalog]
  )

  return (
    <div className="grid min-h-8 grid-cols-[minmax(7rem,1fr)_7rem_minmax(9rem,1.2fr)] items-center gap-1.5 border-border/50 border-b px-2 py-1 text-xs transition-colors last:border-b-0 hover:bg-muted/35">
      <span className="truncate font-mono">{field.name}</span>
      <EntityIoSelect<AnonymizeFieldMode>
        ariaLabel={`${field.name} ${modeLabel}`}
        value={field.mode}
        onValueChange={(mode) => onChange(field.name, { mode })}
        options={modeOptions}
      />
      <SuggestInput
        className="min-w-0"
        inputClassName="font-mono text-[10px]"
        aria-label={`${field.name} Faker`}
        disabled={field.mode !== 'faker'}
        value={field.fakerKey ?? ''}
        onChange={(next) => onChange(field.name, { fakerKey: next })}
        placeholder="$faker.person.firstName"
        filter="includes"
        maxSuggestions={40}
        minListWidth={240}
        suggestions={suggestions}
        groupLabels={fakerGroupLabels}
      />
    </div>
  )
})
