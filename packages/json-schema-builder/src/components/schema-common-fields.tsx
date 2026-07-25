import {
  CodeEditor,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Textarea,
} from '@4d/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import * as React from 'react'
import type { JSONSchema } from '../types'
import { LabelWithClear } from './label-with-clear'
import { useSchemaBuilderContext, useSchemaBuilderI18n } from './schema-builder'

function BooleanFieldWithReset({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
}) {
  const t = useSchemaBuilderI18n()
  const [open, setOpen] = React.useState(false)
  const hasValue = value !== undefined
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
      {hasValue ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="min-w-0 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-left font-medium text-foreground text-xs hover:bg-muted/80 hover:underline hover:underline-offset-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              aria-label={`${label} ${t('commonClickToReset')}`}
            >
              {label}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto px-3 py-2">
            <button
              type="button"
              className="text-muted-foreground text-xs hover:text-foreground"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
            >
              {t('commonResetValue')}
            </button>
          </PopoverContent>
        </Popover>
      ) : (
        <label htmlFor={id} className="cursor-pointer text-muted-foreground text-xs">
          {label}
        </label>
      )}
    </div>
  )
}

export interface SchemaCommonFieldsProps {
  value: JSONSchema
  onChange: (schema: JSONSchema) => void
}

function tryParseJson(text: string): unknown {
  if (!text.trim()) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

export function SchemaCommonFields({ value, onChange }: SchemaCommonFieldsProps) {
  const t = useSchemaBuilderI18n()
  const { editorPrefs, onEditorPrefsChange } = useSchemaBuilderContext()
  const update = React.useCallback(
    (patch: Partial<JSONSchema>) => {
      onChange({ ...value, ...patch } as JSONSchema)
    },
    [value, onChange]
  )

  const schema = value as unknown as Record<string, unknown>
  const title = (schema.title as string) ?? ''
  const description = (schema.description as string) ?? ''
  const defaultVal = schema.default
  const examples = schema.examples
  const readOnly = schema.readOnly as boolean | undefined
  const writeOnly = schema.writeOnly as boolean | undefined
  const deprecated = schema.deprecated as boolean | undefined

  const defaultText = defaultVal === undefined ? '' : JSON.stringify(defaultVal)
  const examplesText =
    examples === undefined ? '' : Array.isArray(examples) ? JSON.stringify(examples) : ''

  const [expanded, setExpanded] = React.useState(false)
  const [defaultInput, setDefaultInput] = React.useState(defaultText)
  const [examplesInput, setExamplesInput] = React.useState(examplesText)

  React.useEffect(() => {
    setDefaultInput(defaultText)
  }, [defaultText])
  React.useEffect(() => {
    setExamplesInput(examplesText)
  }, [examplesText])

  const commitDefault = React.useCallback(() => {
    const parsed = tryParseJson(defaultInput)
    if (!defaultInput.trim()) {
      update({ default: undefined })
      return
    }
    if (parsed !== undefined) update({ default: parsed })
  }, [defaultInput, update])

  const commitExamples = React.useCallback(() => {
    const parsed = tryParseJson(examplesInput)
    if (!examplesInput.trim()) {
      update({ examples: undefined })
      return
    }
    if (parsed === undefined) return
    update(Array.isArray(parsed) ? { examples: parsed } : { examples: [parsed] })
  }, [examplesInput, update])

  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted/10 py-1.5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        {t('common')}
      </button>
      {expanded && (
        <>
          <div>
            <LabelWithClear
              label={t('commonTitle')}
              hasValue={title.length > 0}
              onClear={() => update({ title: undefined })}
            />
            <Input
              value={title}
              onChange={(e) => update({ title: e.target.value || undefined })}
              placeholder={t('placeholderDash')}
              className="h-6 text-xs"
            />
          </div>
          <div>
            <LabelWithClear
              label={t('commonDescription')}
              hasValue={description.length > 0}
              onClear={() => update({ description: undefined })}
            />
            <Textarea
              value={description}
              onChange={(e) => update({ description: e.target.value || undefined })}
              placeholder={t('placeholderDash')}
              className="min-h-10 resize-y text-xs"
              rows={1}
            />
          </div>
          <div>
            <LabelWithClear
              label={t('commonDefaultJson')}
              hasValue={defaultVal !== undefined}
              onClear={() => {
                setDefaultInput('')
                update({ default: undefined })
              }}
            />
            <CodeEditor
              language="json"
              value={defaultInput}
              onChange={setDefaultInput}
              onBlur={commitDefault}
              height="80px"
              fontSize={12}
              editorPrefs={editorPrefs}
              onEditorPrefsChange={onEditorPrefsChange}
            />
          </div>
          <div>
            <LabelWithClear
              label={t('commonExamplesJson')}
              hasValue={
                examples !== undefined && (Array.isArray(examples) ? examples.length > 0 : true)
              }
              onClear={() => {
                setExamplesInput('')
                update({ examples: undefined })
              }}
            />
            <CodeEditor
              language="json"
              value={examplesInput}
              onChange={setExamplesInput}
              onBlur={commitExamples}
              height="80px"
              fontSize={12}
              editorPrefs={editorPrefs}
              onEditorPrefsChange={onEditorPrefsChange}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BooleanFieldWithReset
              id="common-readonly"
              label={t('commonReadOnly')}
              value={readOnly}
              onChange={(v) => update({ readOnly: v })}
            />
            <BooleanFieldWithReset
              id="common-writeonly"
              label={t('commonWriteOnly')}
              value={writeOnly}
              onChange={(v) => update({ writeOnly: v })}
            />
            <BooleanFieldWithReset
              id="common-deprecated"
              label={t('commonDeprecated')}
              value={deprecated}
              onChange={(v) => update({ deprecated: v })}
            />
          </div>
        </>
      )}
    </div>
  )
}
