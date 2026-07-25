import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@4d/ui'
import * as React from 'react'
import { getSchemaType } from '../lib/schema-utils'
import type { JSONSchemaCompositeKeyword, JSONSchemaTypeName } from '../types'
import { useSchemaBuilderI18n } from './schema-builder'

const TYPE_OPTION_KEYS = [
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'object',
  'array',
  'oneOf',
  'anyOf',
  'allOf',
  'ref',
] as const

const TYPE_LABEL_KEY: Record<string, keyof import('../i18n').SchemaBuilderMessages> = {
  string: 'typeString',
  number: 'typeNumber',
  integer: 'typeInteger',
  boolean: 'typeBoolean',
  null: 'typeNull',
  object: 'typeObject',
  array: 'typeArray',
  oneOf: 'typeOneOf',
  anyOf: 'typeAnyOf',
  allOf: 'typeAllOf',
  ref: 'typeRef',
}

export interface TypeSelectorProps {
  value: unknown
  /** When true, the Reference option is shown (e.g. when there are definitions or when at root so user can create a ref). */
  allowRef: boolean
  onChange: (type: JSONSchemaTypeName | JSONSchemaCompositeKeyword | 'ref') => void
  disabled?: boolean
}

export function TypeSelector({ value, allowRef, onChange, disabled }: TypeSelectorProps) {
  const t = useSchemaBuilderI18n()
  const current = getSchemaType(value as import('../types').JSONSchema)
  const selectValue = current === null ? 'object' : current === 'ref' ? 'ref' : current

  const options = React.useMemo(() => {
    const list = TYPE_OPTION_KEYS.filter((v) => v !== 'ref' || allowRef)
    return list.map((value) => ({ value, label: t(TYPE_LABEL_KEY[value]) }))
  }, [allowRef, t])

  const handleChange = (v: string) => {
    if (v === 'ref') {
      onChange('ref')
      return
    }
    if (v === 'oneOf' || v === 'anyOf' || v === 'allOf') {
      onChange(v as JSONSchemaCompositeKeyword)
      return
    }
    onChange(v as JSONSchemaTypeName)
  }

  return (
    <Select value={selectValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="h-6 w-full max-w-45 text-xs">
        <SelectValue placeholder={t('typePlaceholder')} />
      </SelectTrigger>
      <SelectContent
        align="center"
        className="min-w-(--radix-select-trigger-width) bg-popover opacity-100"
      >
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="justify-center text-center data-[state=checked]:bg-accent data-highlighted:bg-accent data-[state=checked]:text-accent-foreground data-highlighted:text-accent-foreground"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
