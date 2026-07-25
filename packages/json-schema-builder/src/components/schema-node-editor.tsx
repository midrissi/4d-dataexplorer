import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@4d/ui'
import { Link2 } from 'lucide-react'
import * as React from 'react'
import {
  convertRootToDefinition,
  convertToDefinition,
  defaultSchemaForComposite,
  defaultSchemaForType,
  getSchemaType,
  nextDefinitionId,
} from '../lib/schema-utils'
import type { JSONSchema, JSONSchemaCompositeKeyword, JSONSchemaTypeName } from '../types'
import { isArraySchema, isCompositeSchema, isObjectSchema, isRef } from '../types'
import { ArrayEditor } from './array-editor'
import { CompositeEditor } from './composite-editor'
import { ObjectEditor } from './object-editor'
import { PrimitiveEditor } from './primitive-editor'
import { RefEditor } from './ref-editor'
import { useSchemaBuilderContext, useSchemaBuilderI18n } from './schema-builder'
import { SchemaCommonFields } from './schema-common-fields'
import { TypeSelector } from './type-selector'

export interface SchemaNodeEditorProps {
  value: JSONSchema
  path: string[]
  onChange?: (schema: JSONSchema) => void
  isRoot?: boolean
}

export function SchemaNodeEditor({
  value,
  path,
  onChange: onChangeProp,
  isRoot = false,
}: SchemaNodeEditorProps) {
  const t = useSchemaBuilderI18n()
  const schemaBuilderContext = useSchemaBuilderContext()

  const effectiveOnChange = React.useCallback(
    (newSchema: JSONSchema) => {
      if (isRoot && onChangeProp) {
        onChangeProp(newSchema)
        return
      }
      schemaBuilderContext.setAtPath(path, newSchema)
    },
    [isRoot, onChangeProp, path, schemaBuilderContext]
  )

  const definitions = schemaBuilderContext.definitions
  const hasDefinitions = Object.keys(definitions).length > 0

  const handleTypeChange = React.useCallback(
    (type: JSONSchemaTypeName | JSONSchemaCompositeKeyword | 'ref') => {
      if (type === 'ref') {
        const ids = Object.keys(definitions)
        if (ids.length > 0) {
          effectiveOnChange({ $ref: `#/$defs/${ids[0]}` })
        } else if (isRoot) {
          const id = nextDefinitionId(definitions)
          const newDefs = { ...definitions, [id]: { type: 'object' as const, properties: {} } }
          const newRoot = {
            $ref: `#/$defs/${id}`,
            $defs: newDefs,
            ...(schemaBuilderContext.root?.definitions !== undefined
              ? { definitions: schemaBuilderContext.root.definitions }
              : {}),
          } as import('../types').JSONSchemaRoot
          schemaBuilderContext.onChange(newRoot)
        }
        return
      }
      if (type === 'oneOf' || type === 'anyOf' || type === 'allOf') {
        effectiveOnChange(defaultSchemaForComposite(type))
        return
      }
      effectiveOnChange(defaultSchemaForType(type))
    },
    [definitions, effectiveOnChange, isRoot, schemaBuilderContext]
  )

  const currentType = getSchemaType(value)
  const allowRef = hasDefinitions || isRoot

  const handleConvertToDefinition = React.useCallback(() => {
    const id = nextDefinitionId(schemaBuilderContext.definitions)
    const newRoot = isRoot
      ? convertRootToDefinition(schemaBuilderContext.root, id)
      : convertToDefinition(schemaBuilderContext.root, path, id)
    schemaBuilderContext.onChange(newRoot)
  }, [schemaBuilderContext, path, isRoot])

  const canConvertToDefinition =
    !isRef(value) && currentType !== null && (isRoot || path.length > 0)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex h-6 items-center gap-1.5">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            {t('labelType')}
          </span>
          <TypeSelector value={value} allowRef={allowRef} onChange={handleTypeChange} />
        </div>
        {canConvertToDefinition && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="iconXs"
                className="h-6 w-6 shrink-0"
                onClick={handleConvertToDefinition}
                aria-label={t('convertToDefinition')}
              >
                <Link2 className="size-3.5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('convertToDefinition')}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <SchemaCommonFields value={value} onChange={effectiveOnChange} />
      <div className="pl-0">
        {isRef(value) && (
          <RefEditor
            value={value}
            definitions={schemaBuilderContext.definitions}
            onChange={effectiveOnChange}
            onOpenDefinitions={schemaBuilderContext.onOpenDefinitions}
          />
        )}
        {currentType === 'object' && isObjectSchema(value) && (
          <ObjectEditor value={value} path={path} onChange={effectiveOnChange} />
        )}
        {currentType === 'array' && isArraySchema(value) && (
          <ArrayEditor value={value} path={path} onChange={effectiveOnChange} />
        )}
        {isCompositeSchema(value) && (
          <CompositeEditor value={value} path={path} onChange={effectiveOnChange} />
        )}
        {currentType !== null &&
          currentType !== 'ref' &&
          currentType !== 'object' &&
          currentType !== 'array' &&
          currentType !== 'oneOf' &&
          currentType !== 'anyOf' &&
          currentType !== 'allOf' && <PrimitiveEditor value={value} onChange={effectiveOnChange} />}
      </div>
    </div>
  )
}
