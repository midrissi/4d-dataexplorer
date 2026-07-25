import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@4d/ui'
import {
  Ban,
  Braces,
  Infinity as InfinityIcon,
  ListOrdered,
  Plus,
  Square,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { isTupleItems } from '../lib/schema-utils'
import type { JSONSchema, JSONSchemaArray } from '../types'
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

function UniqueItemsLabelWithReset({ onReset }: { onReset: () => void }) {
  const t = useSchemaBuilderI18n()
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-left font-medium text-foreground text-xs hover:bg-muted/80 hover:underline hover:underline-offset-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          aria-label={`${t('arrayUniqueItems')} ${t('commonHasValueClickToReset')}`}
        >
          {t('arrayUniqueItems')}
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

export interface ArrayEditorProps {
  value: JSONSchemaArray
  path: string[]
  onChange: (schema: JSONSchema) => void
}

export function ArrayEditor({ value, path, onChange }: ArrayEditorProps) {
  const t = useSchemaBuilderI18n()
  const isTuple = isTupleItems(value)
  const items = value.items

  const singleSchema = !Array.isArray(items) ? (items as JSONSchema) : undefined
  const tupleItems = Array.isArray(items) ? (items as JSONSchema[]) : []

  const additionalItems = value.additionalItems
  const additionalItemsSchema =
    typeof additionalItems === 'object' && additionalItems !== null ? additionalItems : null
  const setAdditionalItems = React.useCallback(
    (v: boolean | JSONSchema) => onChange({ ...value, additionalItems: v }),
    [value, onChange]
  )

  const containsSchema = value.contains
  const setContains = React.useCallback(
    (s: JSONSchema | undefined) => onChange({ ...value, contains: s }),
    [value, onChange]
  )

  const unevalItems = value.unevaluatedItems
  const unevalItemsSchema =
    typeof unevalItems === 'object' && unevalItems !== null ? unevalItems : null
  const setUnevaluatedItems = React.useCallback(
    (v: boolean | JSONSchema) => onChange({ ...value, unevaluatedItems: v }),
    [value, onChange]
  )

  const setTupleItems = React.useCallback(
    (newItems: JSONSchema[]) => {
      onChange({ ...value, items: newItems })
    },
    [value, onChange]
  )

  const addTupleItem = React.useCallback(() => {
    const next = [...tupleItems, { type: 'string' as const }]
    onChange({ ...value, items: next })
  }, [value, tupleItems, onChange])

  const removeTupleItem = React.useCallback(
    (index: number) => {
      const next = tupleItems.filter((_, i) => i !== index)
      onChange({ ...value, items: next })
    },
    [value, tupleItems, onChange]
  )

  const switchToTuple = React.useCallback(() => {
    const current = value.items as JSONSchema | undefined
    onChange({
      ...value,
      items: current ? [current] : [{ type: 'string' as const }],
    })
  }, [value, onChange])

  const switchToSingle = React.useCallback(() => {
    const arr = value.items as JSONSchema[]
    onChange({
      ...value,
      items: arr.length > 0 ? arr[0] : { type: 'string' as const },
    })
  }, [value, onChange])

  const itemsCount = isTuple ? tupleItems.length : 1

  return (
    <div className="flex flex-col gap-1">
      <CollapsibleSection
        label={t('arrayItems')}
        count={itemsCount}
        headerAction={
          isTuple ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-6 w-6"
                  onClick={addTupleItem}
                  aria-label={t('arrayAddItem')}
                >
                  <Plus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('arrayAddItem')}</TooltipContent>
            </Tooltip>
          ) : null
        }
      >
        <div className="flex items-center gap-1.5">
          <SegmentedControl
            aria-label={t('arrayItems')}
            value={isTuple ? 'tuple' : 'single'}
            onValueChange={(mode) => {
              if (mode === 'single') switchToSingle()
              else switchToTuple()
            }}
            options={[
              { value: 'single', label: t('arraySingleSchema'), icon: Square },
              { value: 'tuple', label: t('arrayTuple'), icon: ListOrdered },
            ]}
          />
        </div>
        {!isTuple ? (
          <div className="mt-1 rounded bg-muted/10 pl-2">
            <SchemaNodeEditor
              value={singleSchema ?? { type: 'string' }}
              path={[...path, 'items']}
            />
          </div>
        ) : (
          <>
            <SortableList
              items={tupleItems.map((s, i) => ({ schema: s, index: i }))}
              getItemId={({ index }) => `${path.join('-')}-${index}`}
              onReorder={(newOrder) => setTupleItems(newOrder.map(({ schema }) => schema))}
              className="gap-1"
              renderItem={({ schema, index }) => (
                <div className="flex flex-col gap-1 py-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground text-xs">
                      {t('arrayItemN', { n: String(index + 1) })}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => removeTupleItem(index)}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={t('arrayRemoveItem')}
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('arrayRemoveItem')}</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="rounded bg-muted/10 pl-2">
                    <SchemaNodeEditor value={schema} path={[...path, 'items', String(index)]} />
                  </div>
                </div>
              )}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  className="h-6 w-6"
                  onClick={addTupleItem}
                  aria-label={t('arrayAddItem')}
                >
                  <Plus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('arrayAddItem')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </CollapsibleSection>

      {/* Prefix items */}
      <PrefixItemsSection value={value} path={path} onChange={onChange} />

      {/* Additional items */}
      <CollapsibleSection
        label={t('arrayAdditionalItems')}
        className="rounded-sm bg-muted/20 px-1.5 py-1"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <SegmentedControl
            aria-label={t('arrayAdditionalItems')}
            value={schemaAllowMode(additionalItems)}
            onValueChange={(mode) => {
              if (mode === 'forbid') setAdditionalItems(false)
              else if (mode === 'any') setAdditionalItems(true)
              else
                setAdditionalItems(
                  (typeof additionalItems === 'object' && additionalItems !== null
                    ? additionalItems
                    : { type: 'string' }) as JSONSchema
                )
            }}
            options={[
              { value: 'forbid', label: t('propsNotAllowed'), icon: Ban },
              { value: 'any', label: t('propsAny'), icon: InfinityIcon },
              { value: 'schema', label: t('propsSchema'), icon: Braces },
            ]}
          />
          {additionalItemsSchema && (
            <div className="w-full rounded bg-muted/10 pl-2">
              <SchemaNodeEditor
                value={additionalItemsSchema}
                path={[...path, 'additionalItems']}
                onChange={setAdditionalItems}
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Contains */}
      <div className="rounded bg-muted/20 p-1.5">
        <div className="flex items-center justify-between gap-1">
          <Label className="font-medium text-muted-foreground text-xs">{t('arrayContains')}</Label>
          {containsSchema ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setContains(undefined)}
            >
              {t('arrayClear')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setContains({ type: 'string' })}
            >
              {t('arraySetSchema')}
            </Button>
          )}
        </div>
        {containsSchema && (
          <div className="mt-1 rounded bg-muted/10 pl-2">
            <SchemaNodeEditor
              value={containsSchema}
              path={[...path, 'contains']}
              onChange={setContains}
            />
          </div>
        )}
      </div>

      <div className="grid max-w-sm grid-cols-2 gap-1.5 rounded bg-muted/20 p-1.5">
        <div>
          <LabelWithClear
            label={t('arrayMinItems')}
            hasValue={value.minItems !== undefined}
            onClear={() => onChange({ ...value, minItems: undefined })}
          />
          <Input
            type="number"
            min={0}
            value={value.minItems ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                minItems: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="h-6 text-xs"
          />
        </div>
        <div>
          <LabelWithClear
            label={t('arrayMaxItems')}
            hasValue={value.maxItems !== undefined}
            onClear={() => onChange({ ...value, maxItems: undefined })}
          />
          <Input
            type="number"
            min={0}
            value={value.maxItems ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                maxItems: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="h-6 text-xs"
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch
            id="array-unique"
            checked={value.uniqueItems ?? false}
            onCheckedChange={(c) => onChange({ ...value, uniqueItems: c || undefined })}
          />
          {value.uniqueItems === true ? (
            <UniqueItemsLabelWithReset
              onReset={() => onChange({ ...value, uniqueItems: undefined })}
            />
          ) : (
            <div className="py-0.5">
              <Label htmlFor="array-unique" className="whitespace-nowrap text-xs">
                {t('arrayUniqueItems')}
              </Label>
            </div>
          )}
        </div>
        <div>
          <LabelWithClear
            label={t('arrayMinContains')}
            hasValue={value.minContains !== undefined}
            onClear={() => onChange({ ...value, minContains: undefined })}
          />
          <Input
            type="number"
            min={0}
            value={value.minContains ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                minContains: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="h-6 text-xs"
          />
        </div>
        <div>
          <LabelWithClear
            label={t('arrayMaxContains')}
            hasValue={value.maxContains !== undefined}
            onClear={() => onChange({ ...value, maxContains: undefined })}
          />
          <Input
            type="number"
            min={0}
            value={value.maxContains ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                maxContains: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="h-6 text-xs"
          />
        </div>
      </div>

      {/* Unevaluated items */}
      <CollapsibleSection
        label={t('arrayUnevaluatedItems')}
        className="rounded-sm bg-muted/20 px-1.5 py-1"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <SegmentedControl
            aria-label={t('arrayUnevaluatedItems')}
            value={schemaAllowMode(unevalItems)}
            onValueChange={(mode) => {
              if (mode === 'forbid') setUnevaluatedItems(false)
              else if (mode === 'any') setUnevaluatedItems(true)
              else
                setUnevaluatedItems(
                  (typeof unevalItems === 'object' && unevalItems !== null
                    ? unevalItems
                    : { type: 'string' }) as JSONSchema
                )
            }}
            options={[
              { value: 'forbid', label: t('propsNotAllowed'), icon: Ban },
              { value: 'any', label: t('propsAny'), icon: InfinityIcon },
              { value: 'schema', label: t('propsSchema'), icon: Braces },
            ]}
          />
          {unevalItemsSchema && (
            <div className="w-full rounded bg-muted/10 pl-2">
              <SchemaNodeEditor
                value={unevalItemsSchema}
                path={[...path, 'unevaluatedItems']}
                onChange={setUnevaluatedItems}
              />
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}

function PrefixItemsSection({
  value,
  path,
  onChange,
}: {
  value: JSONSchemaArray
  path: string[]
  onChange: (schema: JSONSchema) => void
}) {
  const t = useSchemaBuilderI18n()
  const prefixItems = value.prefixItems ?? []
  const add = React.useCallback(() => {
    const next = [...prefixItems, { type: 'string' as const }]
    onChange({ ...value, prefixItems: next })
  }, [value, prefixItems, onChange])
  const remove = React.useCallback(
    (index: number) => {
      const next = prefixItems.filter((_, i) => i !== index)
      onChange({ ...value, prefixItems: next.length ? next : undefined })
    },
    [value, prefixItems, onChange]
  )
  const setSchema = React.useCallback(
    (index: number, schema: JSONSchema) => {
      const next = [...prefixItems]
      next[index] = schema
      onChange({ ...value, prefixItems: next })
    },
    [value, prefixItems, onChange]
  )
  return (
    <CollapsibleSection
      label={t('arrayPrefixItems')}
      count={prefixItems.length}
      headerAction={
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
      }
      className="rounded bg-muted/20 p-1.5"
    >
      {prefixItems.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('arrayNoPrefixItems')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {prefixItems.map((schema, index) => (
            // Prefix items are positional tuple schemas: index is the item's stable identity.
            <div
              key={`${path.join('-')}-prefix-${index}`}
              className="flex flex-col gap-1 rounded bg-muted/10 p-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground text-xs">
                  {t('arrayPrefixN', { n: String(index + 1) })}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t('remove')}
                >
                  <Trash2 className="size-3.5 shrink-0" />
                </button>
              </div>
              <div className="pl-1.5">
                <SchemaNodeEditor
                  value={schema}
                  path={[...path, 'prefixItems', String(index)]}
                  onChange={(s) => setSchema(index, s)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
