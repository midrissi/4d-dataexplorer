import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@4d/ui'
import type { JSONSchema, JSONSchemaRef } from '../types'
import { useSchemaBuilderI18n } from './schema-builder'

export interface RefEditorProps {
  value: JSONSchemaRef
  definitions: Record<string, JSONSchema>
  onChange: (schema: JSONSchema) => void
  onOpenDefinitions?: () => void
}

export function RefEditor({ value, definitions, onChange, onOpenDefinitions }: RefEditorProps) {
  const t = useSchemaBuilderI18n()
  const refId = value.$ref.replace(/^#\/\$defs\//, '').replace(/^#\/definitions\//, '')
  const ids = Object.keys(definitions)

  const handleChange = (id: string) => {
    onChange({ $ref: `#/$defs/${id}` })
  }

  return (
    <div className="flex flex-col gap-1 rounded bg-muted/10 p-1.5">
      <div className="flex items-center gap-1.5">
        <Select value={refId} onValueChange={handleChange}>
          <SelectTrigger className="h-6 flex-1 text-xs">
            <SelectValue placeholder={t('placeholderChooseDefinition')} />
          </SelectTrigger>
          <SelectContent>
            {ids.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onOpenDefinitions && (
          <button
            type="button"
            onClick={onOpenDefinitions}
            className="whitespace-nowrap font-medium text-primary text-xs transition-colors hover:underline"
          >
            {t('refEditDefinitions')}
          </button>
        )}
      </div>
    </div>
  )
}
