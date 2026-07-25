import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@4d/ui'
import {
  Ban,
  Braces,
  ChevronDown,
  ChevronRight,
  Infinity as InfinityIcon,
  Plus,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import type { JSONSchema, JSONSchemaObject } from '../types'
import { CheckboxButton } from './checkbox-button'
import { CollapsibleSection } from './collapsible-section'
import { LabelWithClear } from './label-with-clear'
import { useSchemaBuilderI18n } from './schema-builder'
import { SchemaNodeEditor } from './schema-node-editor'
import { SegmentedControl } from './segmented-control'
import { SortableList } from './sortable-list'

type SchemaAllowMode = 'forbid' | 'any' | 'schema'

function schemaAllowMode(value: unknown): SchemaAllowMode {
  if (typeof value === 'object' && value !== null) return 'schema'
  if (value === true) return 'any'
  return 'forbid'
}

function SectionLabelWithReset({ label, onReset }: { label: string; onReset: () => void }) {
  const t = useSchemaBuilderI18n()
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 whitespace-nowrap rounded bg-muted px-0 py-0.5 text-left font-medium text-foreground text-xs hover:bg-muted/80 hover:underline hover:underline-offset-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          aria-label={`${label} ${t('commonHasValueClickToReset')}`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto px-3 py-2">
        <button
          type="button"
          className="text-muted-foreground text-xs hover:text-foreground"
          onClick={() => {
            onReset()
            setOpen(false)
          }}
        >
          {t('commonResetValue')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

export interface ObjectEditorProps {
  value: JSONSchemaObject
  path: string[]
  onChange: (schema: JSONSchema) => void
}

export function ObjectEditor({ value, path, onChange }: ObjectEditorProps) {
  const t = useSchemaBuilderI18n()
  const properties = value.properties ?? {}
  const propEntries = React.useMemo(() => Object.entries(properties), [properties])
  const propKeys = React.useMemo(() => propEntries.map(([k]) => k), [propEntries])

  const [expandedProperties, setExpandedProperties] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    setExpandedProperties((prev) => {
      const next = new Set(prev)
      for (const k of next) if (!propKeys.includes(k)) next.delete(k)
      return next
    })
  }, [propKeys])

  const togglePropertyExpanded = React.useCallback((key: string) => {
    setExpandedProperties((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const expandAllProperties = React.useCallback(() => {
    setExpandedProperties(new Set(propKeys))
  }, [propKeys])
  const collapseAllProperties = React.useCallback(() => {
    setExpandedProperties(new Set())
  }, [])

  const addProperty = React.useCallback(() => {
    const key = `property_${Object.keys(properties).length}`
    const next = {
      ...value,
      properties: { ...properties, [key]: { type: 'string' as const } },
    }
    onChange(next)
  }, [value, properties, onChange])

  const removeProperty = React.useCallback(
    (key: string) => {
      const { [key]: _, ...rest } = properties
      const required = (value.required ?? []).filter((r) => r !== key)
      onChange({ ...value, properties: rest, required: required.length ? required : undefined })
    },
    [value, properties, onChange]
  )

  const setPropertyKey = React.useCallback(
    (oldKey: string, newKey: string) => {
      if (newKey === oldKey || !newKey.trim()) return
      const { [oldKey]: propSchema, ...rest } = properties
      const nextProps = { ...rest, [newKey.trim()]: propSchema }
      const required = (value.required ?? []).map((r) => (r === oldKey ? newKey.trim() : r))
      onChange({ ...value, properties: nextProps, required })
    },
    [value, properties, onChange]
  )

  const setAdditionalProperties = React.useCallback(
    (v: boolean | JSONSchema) => {
      onChange({ ...value, additionalProperties: v })
    },
    [value, onChange]
  )

  const toggleRequired = React.useCallback(
    (key: string, required: boolean) => {
      const current = value.required ?? []
      const next = required
        ? [...current, key].filter((r, i, a) => a.indexOf(r) === i)
        : current.filter((r) => r !== key)
      onChange({ ...value, required: next.length ? next : undefined })
    },
    [value, onChange]
  )

  const reorderProperties = React.useCallback(
    (newEntries: [string, JSONSchema][]) => {
      const newProps: Record<string, JSONSchema> = {}
      for (const [k, v] of newEntries) newProps[k] = v
      onChange({ ...value, properties: newProps })
    },
    [value, onChange]
  )

  const additionalProps = value.additionalProperties
  const additionalPropsSchema =
    typeof additionalProps === 'object' && additionalProps !== null ? additionalProps : null

  const setMinProperties = React.useCallback(
    (n: number | undefined) => onChange({ ...value, minProperties: n }),
    [value, onChange]
  )
  const setMaxProperties = React.useCallback(
    (n: number | undefined) => onChange({ ...value, maxProperties: n }),
    [value, onChange]
  )

  const setPatternProperties = React.useCallback(
    (patternProperties: Record<string, JSONSchema> | undefined) =>
      onChange({ ...value, patternProperties }),
    [value, onChange]
  )
  const patternProps = value.patternProperties ?? {}

  const setDependentRequired = React.useCallback(
    (dependentRequired: Record<string, string[]> | undefined) =>
      onChange({ ...value, dependentRequired }),
    [value, onChange]
  )
  const dependentReq = value.dependentRequired ?? {}

  const setDependentSchemas = React.useCallback(
    (dependentSchemas: Record<string, JSONSchema> | undefined) =>
      onChange({ ...value, dependentSchemas }),
    [value, onChange]
  )
  const dependentSch = value.dependentSchemas ?? {}

  const unevalProps = value.unevaluatedProperties
  const unevalSchema = typeof unevalProps === 'object' && unevalProps !== null ? unevalProps : null
  const setUnevaluatedProperties = React.useCallback(
    (v: boolean | JSONSchema) => onChange({ ...value, unevaluatedProperties: v }),
    [value, onChange]
  )

  return (
    <div className="flex flex-col gap-1">
      <CollapsibleSection
        label={t('propsProperties')}
        count={propEntries.length}
        headerAction={
          <div className="flex items-center gap-0.5">
            {propEntries.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconXs"
                    className="h-6 w-6"
                    onClick={() =>
                      expandedProperties.size === propKeys.length
                        ? collapseAllProperties()
                        : expandAllProperties()
                    }
                    aria-label={
                      expandedProperties.size === propKeys.length
                        ? t('propsCollapseAll')
                        : t('propsExpandAll')
                    }
                  >
                    {expandedProperties.size === propKeys.length ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {expandedProperties.size === propKeys.length
                    ? t('propsCollapseAllTooltip')
                    : t('propsExpandAllTooltip')}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-6 w-6"
                  onClick={addProperty}
                  aria-label={t('propsAddProperty')}
                >
                  <Plus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('propsAddProperty')}</TooltipContent>
            </Tooltip>
          </div>
        }
      >
        <SortableList
          items={propEntries}
          getItemId={([k]) => k}
          onReorder={reorderProperties}
          className="gap-1"
          renderItem={([key, propSchema], _dragHandleProps) => {
            const isExpanded = expandedProperties.has(key)
            return (
              <div className="flex flex-col gap-1 py-0 pr-0.5">
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => togglePropertyExpanded(key)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded ? t('propsCollapseDetails') : t('propsExpandDetails')
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isExpanded ? t('propsCollapseDetails') : t('propsExpandDetails')}
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    key={key}
                    defaultValue={key}
                    onBlur={(e) => setPropertyKey(key, e.target.value.trim())}
                    className="h-6 flex-1 font-mono text-xs"
                    placeholder={t('placeholderPropertyName')}
                  />
                  <CheckboxButton
                    checked={(value.required ?? []).includes(key)}
                    onCheckedChange={(checked) => toggleRequired(key, checked)}
                    ariaLabel={t('propsRequired')}
                    tooltip={t('propsRequired')}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => removeProperty(key)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('propsRemoveProperty')}
                      >
                        <Trash2 className="size-3.5 shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('propsRemoveProperty')}</TooltipContent>
                  </Tooltip>
                </div>
                {isExpanded ? (
                  <div className="rounded bg-muted/10 pl-2">
                    <SchemaNodeEditor value={propSchema} path={[...path, 'properties', key]} />
                  </div>
                ) : null}
              </div>
            )
          }}
        />
      </CollapsibleSection>
      <div className="flex flex-wrap items-center gap-1.5 rounded-sm bg-muted/20 px-1.5 py-1">
        <div className="flex h-6 w-full items-center gap-1">
          {value.additionalProperties !== undefined ? (
            <SectionLabelWithReset
              label={t('propsAdditionalProperties')}
              onReset={() => {
                const { additionalProperties: _, ...rest } = value
                onChange(rest as JSONSchemaObject)
              }}
            />
          ) : (
            <div className="py-0.5">
              <Label className="whitespace-nowrap py-0.5 font-medium text-muted-foreground text-xs">
                {t('propsAdditionalProperties')}
              </Label>
            </div>
          )}
        </div>
        <SegmentedControl
          aria-label={t('propsAdditionalProperties')}
          value={schemaAllowMode(additionalProps)}
          onValueChange={(mode) => {
            if (mode === 'forbid') setAdditionalProperties(false)
            else if (mode === 'any') setAdditionalProperties(true)
            else
              setAdditionalProperties(
                (typeof additionalProps === 'object' && additionalProps !== null
                  ? additionalProps
                  : { type: 'string' }) as JSONSchema
              )
          }}
          options={[
            { value: 'forbid', label: t('propsNotAllowed'), icon: Ban },
            { value: 'any', label: t('propsAny'), icon: InfinityIcon },
            { value: 'schema', label: t('propsSchema'), icon: Braces },
          ]}
        />
        {additionalPropsSchema && (
          <div className="w-full rounded bg-muted/10 pl-2">
            <SchemaNodeEditor
              value={additionalPropsSchema}
              path={[...path, 'additionalProperties']}
              onChange={(s) => setAdditionalProperties(s)}
            />
          </div>
        )}
      </div>

      <div className="grid max-w-xs grid-cols-2 gap-1.5 rounded bg-muted/20 p-1.5">
        <div>
          <LabelWithClear
            label={t('propsMinProperties')}
            hasValue={value.minProperties !== undefined}
            onClear={() => setMinProperties(undefined)}
          />
          <Input
            type="number"
            min={0}
            value={value.minProperties ?? ''}
            onChange={(e) => setMinProperties(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={t('placeholderDash')}
            className="h-6 text-xs"
          />
        </div>
        <div>
          <LabelWithClear
            label={t('propsMaxProperties')}
            hasValue={value.maxProperties !== undefined}
            onClear={() => setMaxProperties(undefined)}
          />
          <Input
            type="number"
            min={0}
            value={value.maxProperties ?? ''}
            onChange={(e) => setMaxProperties(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={t('placeholderDash')}
            className="h-6 text-xs"
          />
        </div>
      </div>

      <PatternPropertiesEditor
        value={patternProps}
        path={[...path, 'patternProperties']}
        onChange={setPatternProperties}
      />

      <DependentRequiredEditor value={dependentReq} onChange={setDependentRequired} />

      <DependentSchemasEditor
        value={dependentSch}
        path={[...path, 'dependentSchemas']}
        onChange={setDependentSchemas}
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-sm bg-muted/20 px-1.5 py-1">
        <div className="flex h-6 w-full items-center gap-1">
          {value.unevaluatedProperties !== undefined ? (
            <SectionLabelWithReset
              label={t('propsUnevaluatedProperties')}
              onReset={() => {
                const { unevaluatedProperties: _, ...rest } = value
                onChange(rest as JSONSchemaObject)
              }}
            />
          ) : (
            <div className="py-0.5">
              <Label className="whitespace-nowrap py-0.5 font-medium text-muted-foreground text-xs">
                {t('propsUnevaluatedProperties')}
              </Label>
            </div>
          )}
        </div>
        <SegmentedControl
          aria-label={t('propsUnevaluatedProperties')}
          value={schemaAllowMode(unevalProps)}
          onValueChange={(mode) => {
            if (mode === 'forbid') setUnevaluatedProperties(false)
            else if (mode === 'any') setUnevaluatedProperties(true)
            else
              setUnevaluatedProperties(
                (typeof unevalProps === 'object' && unevalProps !== null
                  ? unevalProps
                  : { type: 'string' }) as JSONSchema
              )
          }}
          options={[
            { value: 'forbid', label: t('propsNotAllowed'), icon: Ban },
            { value: 'any', label: t('propsAny'), icon: InfinityIcon },
            { value: 'schema', label: t('propsSchema'), icon: Braces },
          ]}
        />
        {unevalSchema && (
          <div className="w-full rounded bg-muted/10 pl-2">
            <SchemaNodeEditor
              value={unevalSchema}
              path={[...path, 'unevaluatedProperties']}
              onChange={setUnevaluatedProperties}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function PatternPropertiesEditor({
  value,
  path,
  onChange,
}: {
  value: Record<string, JSONSchema>
  path: string[]
  onChange: (v: Record<string, JSONSchema> | undefined) => void
}) {
  const t = useSchemaBuilderI18n()
  const entries = React.useMemo(() => Object.entries(value), [value])
  const add = React.useCallback(() => {
    const key = `pattern_${Object.keys(value).length}`
    onChange({ ...value, [key]: { type: 'string' } })
  }, [value, onChange])
  const remove = React.useCallback(
    (k: string) => {
      const { [k]: _, ...rest } = value
      onChange(Object.keys(rest).length ? rest : undefined)
    },
    [value, onChange]
  )
  const setKey = React.useCallback(
    (oldK: string, newK: string) => {
      if (!newK.trim() || newK === oldK) return
      const { [oldK]: v, ...rest } = value
      onChange({ ...rest, [newK.trim()]: v })
    },
    [value, onChange]
  )
  const setSchema = React.useCallback(
    (k: string, schema: JSONSchema) => onChange({ ...value, [k]: schema }),
    [value, onChange]
  )
  const keys = React.useMemo(() => entries.map(([k]) => k), [entries])
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const k of next) if (!keys.includes(k)) next.delete(k)
      return next
    })
  }, [keys])
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  return (
    <CollapsibleSection
      label={t('propsPatternProperties')}
      count={entries.length}
      headerAction={
        <div className="flex items-center gap-0.5">
          {entries.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-6 w-6"
                  onClick={() =>
                    expanded.size === keys.length
                      ? setExpanded(new Set())
                      : setExpanded(new Set(keys))
                  }
                  aria-label={
                    expanded.size === keys.length ? t('propsCollapseAll') : t('propsExpandAll')
                  }
                >
                  {expanded.size === keys.length ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {expanded.size === keys.length
                  ? t('propsCollapseAllTooltip')
                  : t('propsExpandAllTooltip')}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                className="h-6 w-6"
                onClick={add}
                aria-label={t('arrayAdd')}
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('arrayAdd')}</TooltipContent>
          </Tooltip>
        </div>
      }
      className="rounded bg-muted/20 p-1.5"
    >
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('emptyNoPatternProperties')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map(([pattern, schema]) => {
            const isExpanded = expanded.has(pattern)
            return (
              <div key={pattern} className="flex flex-col gap-1 rounded bg-muted/10 p-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(pattern)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t('propsCollapseDetails') : t('propsExpandDetails')}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                  </button>
                  <Input
                    defaultValue={pattern}
                    onBlur={(e) => setKey(pattern, e.target.value.trim())}
                    placeholder={t('placeholderRegexPattern')}
                    className="h-6 flex-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => remove(pattern)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('remove')}
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </button>
                </div>
                {isExpanded ? (
                  <div className="pl-1.5">
                    <SchemaNodeEditor
                      value={schema}
                      path={[...path, pattern]}
                      onChange={(s) => setSchema(pattern, s)}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </CollapsibleSection>
  )
}

function DependentRequiredEditor({
  value,
  onChange,
}: {
  value: Record<string, string[]>
  onChange: (v: Record<string, string[]> | undefined) => void
}) {
  const t = useSchemaBuilderI18n()
  const entries = React.useMemo(() => Object.entries(value), [value])
  const add = React.useCallback(() => {
    const key = `dep_${Object.keys(value).length}`
    onChange({ ...value, [key]: [] })
  }, [value, onChange])
  const remove = React.useCallback(
    (k: string) => {
      const { [k]: _, ...rest } = value
      onChange(Object.keys(rest).length ? rest : undefined)
    },
    [value, onChange]
  )
  const setKey = React.useCallback(
    (oldK: string, newK: string) => {
      if (!newK.trim() || newK === oldK) return
      const { [oldK]: v, ...rest } = value
      onChange({ ...rest, [newK.trim()]: v })
    },
    [value, onChange]
  )
  const setRequired = React.useCallback(
    (k: string, required: string[]) => {
      onChange({ ...value, [k]: required.length ? required : [] })
    },
    [value, onChange]
  )
  const keys = React.useMemo(() => entries.map(([k]) => k), [entries])
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const k of next) if (!keys.includes(k)) next.delete(k)
      return next
    })
  }, [keys])
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  return (
    <CollapsibleSection
      label={t('propsDependentRequired')}
      count={entries.length}
      headerAction={
        <div className="flex items-center gap-0.5">
          {entries.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-6 w-6"
                  onClick={() =>
                    expanded.size === keys.length
                      ? setExpanded(new Set())
                      : setExpanded(new Set(keys))
                  }
                  aria-label={
                    expanded.size === keys.length ? t('propsCollapseAll') : t('propsExpandAll')
                  }
                >
                  {expanded.size === keys.length ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {expanded.size === keys.length
                  ? t('propsCollapseAllTooltip')
                  : t('propsExpandAllTooltip')}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                className="h-6 w-6"
                onClick={add}
                aria-label={t('arrayAdd')}
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('arrayAdd')}</TooltipContent>
          </Tooltip>
        </div>
      }
      className="rounded bg-muted/20 p-1.5"
    >
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('emptyNoDependentRequired')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map(([prop, required]) => {
            const isExpanded = expanded.has(prop)
            return (
              <div key={prop} className="flex flex-col gap-1 rounded bg-muted/10 p-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(prop)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t('propsCollapseDetails') : t('propsExpandDetails')}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                  </button>
                  <Input
                    defaultValue={prop}
                    onBlur={(e) => setKey(prop, e.target.value.trim())}
                    placeholder={t('placeholderIfPresentProperty')}
                    className="h-6 flex-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => remove(prop)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('remove')}
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </button>
                </div>
                {isExpanded ? (
                  <Input
                    value={required.join(', ')}
                    onChange={(e) =>
                      setRequired(
                        prop,
                        e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder={t('placeholderRequiredWhenPresent')}
                    className="h-6 text-xs"
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </CollapsibleSection>
  )
}

function DependentSchemasEditor({
  value,
  path,
  onChange,
}: {
  value: Record<string, JSONSchema>
  path: string[]
  onChange: (v: Record<string, JSONSchema> | undefined) => void
}) {
  const t = useSchemaBuilderI18n()
  const entries = React.useMemo(() => Object.entries(value), [value])
  const add = React.useCallback(() => {
    const key = `dep_${Object.keys(value).length}`
    onChange({ ...value, [key]: { type: 'string' } })
  }, [value, onChange])
  const remove = React.useCallback(
    (k: string) => {
      const { [k]: _, ...rest } = value
      onChange(Object.keys(rest).length ? rest : undefined)
    },
    [value, onChange]
  )
  const setKey = React.useCallback(
    (oldK: string, newK: string) => {
      if (!newK.trim() || newK === oldK) return
      const { [oldK]: v, ...rest } = value
      onChange({ ...rest, [newK.trim()]: v })
    },
    [value, onChange]
  )
  const setSchema = React.useCallback(
    (k: string, schema: JSONSchema) => onChange({ ...value, [k]: schema }),
    [value, onChange]
  )
  const keys = React.useMemo(() => entries.map(([k]) => k), [entries])
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const k of next) if (!keys.includes(k)) next.delete(k)
      return next
    })
  }, [keys])
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  return (
    <CollapsibleSection
      label={t('propsDependentSchemas')}
      count={entries.length}
      headerAction={
        <div className="flex items-center gap-0.5">
          {entries.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-6 w-6"
                  onClick={() =>
                    expanded.size === keys.length
                      ? setExpanded(new Set())
                      : setExpanded(new Set(keys))
                  }
                  aria-label={
                    expanded.size === keys.length ? t('propsCollapseAll') : t('propsExpandAll')
                  }
                >
                  {expanded.size === keys.length ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {expanded.size === keys.length
                  ? t('propsCollapseAllTooltip')
                  : t('propsExpandAllTooltip')}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                className="h-6 w-6"
                onClick={add}
                aria-label={t('arrayAdd')}
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('arrayAdd')}</TooltipContent>
          </Tooltip>
        </div>
      }
      className="rounded bg-muted/20 p-1.5"
    >
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('emptyNoDependentSchemas')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map(([prop, schema]) => {
            const isExpanded = expanded.has(prop)
            return (
              <div key={prop} className="flex flex-col gap-1 rounded bg-muted/10 p-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(prop)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t('propsCollapseDetails') : t('propsExpandDetails')}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                  </button>
                  <Input
                    defaultValue={prop}
                    onBlur={(e) => setKey(prop, e.target.value.trim())}
                    placeholder={t('placeholderIfPresentProperty')}
                    className="h-6 flex-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => remove(prop)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('remove')}
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </button>
                </div>
                {isExpanded ? (
                  <div className="pl-1.5">
                    <SchemaNodeEditor
                      value={schema}
                      path={[...path, prop]}
                      onChange={(s) => setSchema(prop, s)}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </CollapsibleSection>
  )
}
