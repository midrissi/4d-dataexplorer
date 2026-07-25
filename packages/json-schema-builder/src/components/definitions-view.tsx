import {
  Button,
  Input,
  Label,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useEscapeToDismiss,
} from '@4d/ui'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import * as React from 'react'
import { nextDefinitionId } from '../lib/schema-utils'
import { useSchemaBuilderContext, useSchemaBuilderI18n } from './schema-builder'
import { SchemaNodeEditor } from './schema-node-editor'

export interface DefinitionsViewProps {
  onClose?: () => void
  /** When true, render as sidebar; when false, as modal; 'inline' for tab panel content */
  variant?: 'sidebar' | 'modal' | 'inline'
}

export function DefinitionsView({ onClose, variant = 'sidebar' }: DefinitionsViewProps) {
  const t = useSchemaBuilderI18n()
  const { root, definitions, onChange } = useSchemaBuilderContext()
  const defs = definitions ?? {}
  const ids = Object.keys(defs)

  useEscapeToDismiss(variant === 'modal' && Boolean(onClose), () => onClose?.())

  const removeDefinition = React.useCallback(
    (id: string) => {
      const { [id]: _, ...rest } = defs
      const newRoot = { ...root, $defs: rest } as typeof root
      onChange(newRoot)
    },
    [root, defs, onChange]
  )

  const addDefinition = React.useCallback(() => {
    const id = nextDefinitionId(defs)
    const newDefs = { ...defs, [id]: { type: 'object' as const, properties: {} } }
    const newRoot = { ...root, $defs: newDefs } as typeof root
    onChange(newRoot)
  }, [root, defs, onChange])

  const [editingId, setEditingId] = React.useState<string | null>(ids[0] ?? null)
  const [renameId, setRenameId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState('')

  React.useEffect(() => {
    if (editingId === null && ids.length > 0) setEditingId(ids[0])
    if (editingId !== null && !ids.includes(editingId)) setEditingId(ids[0] ?? null)
  }, [ids, editingId])

  const startRename = (id: string) => {
    setRenameId(id)
    setRenameValue(id)
  }
  const commitRename = () => {
    if (renameId == null || !renameValue.trim() || renameValue === renameId) {
      setRenameId(null)
      return
    }
    const newId = renameValue.trim()
    if (newId in defs) {
      setRenameId(null)
      return
    }
    const schema = defs[renameId]
    const { [renameId]: _, ...rest } = defs
    const newDefs = { ...rest, [newId]: schema }
    const newRoot = { ...root, $defs: newDefs } as typeof root
    onChange(newRoot)
    setEditingId(newId)
    setRenameId(null)
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-border/50 border-b bg-muted/20 px-2">
        <h3 className="font-semibold text-foreground text-xs">{t('defsTitle')}</h3>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconXs"
                className="h-6 w-6"
                onClick={addDefinition}
                aria-label={t('defsAddDefinition')}
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('defsAddDefinition')}</TooltipContent>
          </Tooltip>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconXs"
                  onClick={onClose}
                  aria-label={t('defsClose')}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('defsClose')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1.5 p-1.5">
          {ids.length === 0 ? (
            <p className="rounded-sm bg-muted/20 px-2 py-3 text-center text-muted-foreground text-xs">
              {t('defsNoDefinitionsYet')}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {t('defsDefinitionIds')}
                </Label>
                <ul className="space-y-1">
                  {ids.map((id) => (
                    <li key={id} className="flex items-center gap-2">
                      {renameId === id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                          className="h-6 flex-1 text-xs"
                          autoFocus
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingId(id)}
                            className={`flex-1 truncate rounded-sm px-1.5 py-0.5 text-left text-xs ${editingId === id ? 'bg-muted' : 'hover:bg-muted/70'}`}
                          >
                            {id}
                          </button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => startRename(id)}
                                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={t('defsRenameDefinition')}
                              >
                                <Pencil className="size-3.5 shrink-0" strokeWidth={2.25} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{t('defsRenameDefinition')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => removeDefinition(id)}
                                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t('defsRemoveDefinition')}
                              >
                                <Trash2 className="size-3.5 shrink-0" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{t('defsRemoveDefinition')}</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {editingId != null && defs[editingId] != null && (
                <div className="space-y-1.5 rounded-sm bg-card p-1.5">
                  <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    {t('defsSchemaFor', { id: editingId })}
                  </Label>
                  <SchemaNodeEditor value={defs[editingId]} path={['$defs', editingId]} />
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border bg-background shadow-lg">
          {content}
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
  }

  return (
    <div className="flex min-h-0 w-80 shrink-0 flex-col border-border/50 border-l bg-card">
      {content}
    </div>
  )
}
