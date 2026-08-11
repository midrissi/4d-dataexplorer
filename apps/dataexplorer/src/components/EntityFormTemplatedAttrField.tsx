import { Label, TemplatedTextInput } from '@4d/ui'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import type { EnvTemplateThis } from '~/lib/env/this-context'

/** String / uuid (and fallback) entity fields with field-aware `{{` suggestions. */
export function EntityFormTemplatedAttrField({
  attrName,
  attrType,
  fieldId,
  fieldValue,
  thisRoot,
  onFieldChange,
}: {
  attrName: string
  attrType: string
  fieldId: string
  fieldValue: unknown
  thisRoot: EnvTemplateThis
  onFieldChange: (field: string, value: unknown) => void
}) {
  const envField = useTemplatedEnvFieldProps({
    thisRoot,
    field: { name: attrName, type: attrType },
  })

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm">
        {attrName}
      </Label>
      <TemplatedTextInput
        id={fieldId}
        value={fieldValue != null ? String(fieldValue) : ''}
        onChange={(value) => onFieldChange(attrName, value || null)}
        {...envField}
      />
    </div>
  )
}
