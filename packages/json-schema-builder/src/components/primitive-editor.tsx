import { Button, Input } from '@4d/ui'
import { Plus, X } from 'lucide-react'
import * as React from 'react'
import type { JSONSchema, JSONSchemaNumber, JSONSchemaString } from '../types'
import { LabelWithClear } from './label-with-clear'
import { useSchemaBuilderI18n } from './schema-builder'

export interface PrimitiveEditorProps {
  value: JSONSchema
  onChange: (schema: JSONSchema) => void
}

export function PrimitiveEditor({ value, onChange }: PrimitiveEditorProps) {
  const t = useSchemaBuilderI18n()
  const update = React.useCallback(
    (patch: Partial<JSONSchema>) => {
      onChange({ ...value, ...patch } as JSONSchema)
    },
    [value, onChange]
  )
  const enumIdsRef = React.useRef<string[]>([])

  const type = (value as { type?: string }).type
  if (type === 'string') {
    const s = value as JSONSchemaString
    const enumArr = s.enum ?? []
    if (enumIdsRef.current.length < enumArr.length) {
      enumIdsRef.current = [
        ...enumIdsRef.current,
        ...Array.from({ length: enumArr.length - enumIdsRef.current.length }, () =>
          crypto.randomUUID()
        ),
      ]
    } else if (enumIdsRef.current.length > enumArr.length) {
      enumIdsRef.current = enumIdsRef.current.slice(0, enumArr.length)
    }
    return (
      <div className="flex flex-col gap-1 rounded bg-muted/10 p-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <LabelWithClear
              label={t('primitiveMinLength')}
              hasValue={s.minLength !== undefined}
              onClear={() => update({ minLength: undefined })}
            />
            <Input
              type="number"
              min={0}
              value={s.minLength ?? ''}
              onChange={(e) =>
                update({
                  minLength: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t('placeholderDash')}
              className="h-6 text-xs"
            />
          </div>
          <div>
            <LabelWithClear
              label={t('primitiveMaxLength')}
              hasValue={s.maxLength !== undefined}
              onClear={() => update({ maxLength: undefined })}
            />
            <Input
              type="number"
              min={0}
              value={s.maxLength ?? ''}
              onChange={(e) =>
                update({
                  maxLength: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t('placeholderDash')}
              className="h-6 text-xs"
            />
          </div>
        </div>
        <div>
          <LabelWithClear
            label={t('primitiveFormat')}
            hasValue={typeof s.format === 'string' && s.format.length > 0}
            onClear={() => update({ format: undefined })}
          />
          <Input
            value={s.format ?? ''}
            onChange={(e) => update({ format: e.target.value || undefined })}
            placeholder={t('placeholderFormatExample')}
            className="h-6 text-xs"
          />
        </div>
        <div>
          <LabelWithClear
            label={t('primitivePattern')}
            hasValue={typeof s.pattern === 'string' && s.pattern.length > 0}
            onClear={() => update({ pattern: undefined })}
          />
          <Input
            value={s.pattern ?? ''}
            onChange={(e) => update({ pattern: e.target.value || undefined })}
            placeholder="—"
            className="h-6 font-mono text-xs"
          />
        </div>
        <div>
          <LabelWithClear
            label={t('primitiveEnum')}
            hasValue={Array.isArray(s.enum) && s.enum.length > 0}
            onClear={() => update({ enum: undefined })}
          />
          {enumArr.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {enumArr.map((item, i) => (
                <li key={enumIdsRef.current[i]} className="flex items-center gap-1">
                  <Input
                    value={item}
                    onChange={(e) => {
                      const next = [...(s.enum ?? [])]
                      next[i] = e.target.value
                      update({ enum: next })
                    }}
                    placeholder={t('placeholderValue')}
                    className="h-6 flex-1 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconXs"
                    className="size-7 shrink-0"
                    aria-label={t('removeEnumValue')}
                    onClick={() => {
                      const next = (s.enum ?? []).filter((_, j) => j !== i)
                      const nextIds = [...enumIdsRef.current]
                      nextIds.splice(i, 1)
                      enumIdsRef.current = nextIds
                      update({ enum: next.length > 0 ? next : undefined })
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-6 gap-1 text-xs"
            onClick={() => update({ enum: [...(s.enum ?? []), ''] })}
          >
            <Plus className="size-3" />
            {t('arrayAddEnumValue')}
          </Button>
        </div>
      </div>
    )
  }

  if (type === 'number' || type === 'integer') {
    const n = value as JSONSchemaNumber
    return (
      <div className="flex flex-col gap-1 rounded bg-muted/10 p-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <LabelWithClear
              label={t('primitiveMinimum')}
              hasValue={n.minimum !== undefined}
              onClear={() => update({ minimum: undefined })}
            />
            <Input
              type="number"
              value={n.minimum ?? ''}
              onChange={(e) =>
                update({
                  minimum: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t('placeholderDash')}
              className="h-6 text-xs"
            />
          </div>
          <div>
            <LabelWithClear
              label={t('primitiveMaximum')}
              hasValue={n.maximum !== undefined}
              onClear={() => update({ maximum: undefined })}
            />
            <Input
              type="number"
              value={n.maximum ?? ''}
              onChange={(e) =>
                update({
                  maximum: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t('placeholderDash')}
              className="h-6 text-xs"
            />
          </div>
        </div>
        <div>
          <LabelWithClear
            label={t('primitiveMultipleOf')}
            hasValue={n.multipleOf !== undefined}
            onClear={() => update({ multipleOf: undefined })}
          />
          <Input
            type="number"
            step="any"
            value={n.multipleOf ?? ''}
            onChange={(e) =>
              update({
                multipleOf: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="—"
            className="h-6 text-xs"
          />
        </div>
      </div>
    )
  }

  if (type === 'boolean' || type === 'null') {
    return (
      <div className="rounded bg-muted/10 px-1.5 py-1 text-muted-foreground text-xs">
        {t('primitiveNoOptionsFor', { type })}
      </div>
    )
  }

  return null
}
