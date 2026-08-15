import { Button, Input, TemplatedTextInput } from '@4d/ui'
import { X } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import type { AnonymizeFieldMode, AnonymizeFieldPlan } from '~/lib/entity-io'
import type { EnvTemplateThis } from '~/lib/env/this-context'
import { EntityIoSelect, type EntityIoSelectOption } from './EntityIoSelect'

export const AnonymizeFieldRow = memo(function AnonymizeFieldRow({
  field,
  fieldOptions,
  modeOptions,
  fieldLabel,
  modeLabel,
  removeLabel,
  thisRoot,
  onFieldNameChange,
  onChange,
  onRemove,
}: {
  field: AnonymizeFieldPlan
  fieldOptions: EntityIoSelectOption<string>[]
  modeOptions: EntityIoSelectOption<AnonymizeFieldMode>[]
  fieldLabel: string
  modeLabel: string
  removeLabel: string
  thisRoot?: EnvTemplateThis
  onFieldNameChange: (from: string, to: string) => void
  onChange: (name: string, patch: Partial<AnonymizeFieldPlan>) => void
  onRemove: (name: string) => void
}) {
  const fieldHint = useMemo(
    () => ({ name: field.name, type: field.type }),
    [field.name, field.type]
  )
  const envField = useTemplatedEnvFieldProps({ field: fieldHint, thisRoot })

  return (
    <div className="grid min-h-8 grid-cols-[minmax(7rem,1fr)_7rem_minmax(9rem,1.2fr)_1.75rem] items-center gap-1.5 border-border/50 border-b px-2 py-1 text-xs transition-colors last:border-b-0 hover:bg-muted/35">
      <EntityIoSelect
        ariaLabel={`${fieldLabel} ${field.name}`}
        value={field.name}
        onValueChange={(next) => {
          if (next !== field.name) onFieldNameChange(field.name, next)
        }}
        options={fieldOptions}
        className="font-mono"
      />
      <EntityIoSelect<AnonymizeFieldMode>
        ariaLabel={`${field.name} ${modeLabel}`}
        value={field.mode}
        onValueChange={(mode) => onChange(field.name, { mode })}
        options={modeOptions}
      />
      {field.mode === 'faker' ? (
        <TemplatedTextInput
          className="h-7 min-w-0 font-mono text-[10px]"
          aria-label={`${field.name} Faker`}
          value={field.fakerKey ?? ''}
          onChange={(next) => onChange(field.name, { fakerKey: next })}
          placeholder="{{$faker.person.firstName | lower}}"
          {...envField}
        />
      ) : field.mode === 'fixed' ? (
        <Input
          className="h-7 min-w-0 font-mono text-[10px]"
          aria-label={`${field.name} fixed value`}
          value={field.fixedValue ?? ''}
          onChange={(event) => onChange(field.name, { fixedValue: event.target.value })}
        />
      ) : (
        <div aria-hidden />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`${removeLabel} ${field.name}`}
        onClick={() => onRemove(field.name)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
})
