import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@4d/ui'
import { Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import type { JSONSchema, JSONSchemaAllOf, JSONSchemaAnyOf, JSONSchemaOneOf } from '../types'
import { CollapsibleSection } from './collapsible-section'
import { useSchemaBuilderI18n } from './schema-builder'
import { SchemaNodeEditor } from './schema-node-editor'
import { SortableList } from './sortable-list'

const KEYWORD_LABEL_KEYS = { oneOf: 'typeOneOf', anyOf: 'typeAnyOf', allOf: 'typeAllOf' } as const

export interface CompositeEditorProps {
  value: JSONSchemaOneOf | JSONSchemaAnyOf | JSONSchemaAllOf
  path: string[]
  onChange: (schema: JSONSchema) => void
}

export function CompositeEditor({ value, path, onChange }: CompositeEditorProps) {
  const t = useSchemaBuilderI18n()
  const keyword = 'oneOf' in value ? 'oneOf' : 'anyOf' in value ? 'anyOf' : 'allOf'
  const schemas: JSONSchema[] = (value as unknown as Record<string, JSONSchema[]>)[keyword] ?? []

  const setSchemas = React.useCallback(
    (newSchemas: JSONSchema[]) => {
      onChange({ [keyword]: newSchemas } as unknown as JSONSchema)
    },
    [keyword, onChange]
  )

  const addBranch = React.useCallback(() => {
    setSchemas([...schemas, { type: 'string' }])
  }, [schemas, setSchemas])

  const removeBranch = React.useCallback(
    (index: number) => {
      setSchemas(schemas.filter((_, i) => i !== index))
    },
    [schemas, setSchemas]
  )

  return (
    <CollapsibleSection
      label={t(KEYWORD_LABEL_KEYS[keyword])}
      count={schemas.length}
      headerAction={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="iconXs"
              className="h-6 w-6"
              onClick={addBranch}
              aria-label={t('compositeAddBranch')}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('compositeAddBranch')}</TooltipContent>
        </Tooltip>
      }
    >
      <SortableList
        items={schemas.map((s, i) => ({ schema: s, index: i }))}
        getItemId={({ index }) => `${path.join('-')}-branch-${index}`}
        onReorder={(newOrder) => setSchemas(newOrder.map(({ schema }) => schema))}
        className="gap-1"
        renderItem={({ schema, index }) => (
          <div className="flex flex-col gap-1 py-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-xs">
                {t('compositeBranchN', { n: String(index + 1) })}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => removeBranch(index)}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('removeBranch')}
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('removeBranch')}</TooltipContent>
              </Tooltip>
            </div>
            <div className="rounded bg-muted/10 pl-2">
              <SchemaNodeEditor value={schema} path={[...path, keyword, String(index)]} />
            </div>
          </div>
        )}
      />
    </CollapsibleSection>
  )
}
