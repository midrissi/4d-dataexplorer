import { Button, cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@4d/ui'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { CustomArgumentEditor } from './CustomArgumentEditor'
import { EntityReferenceInput } from './EntityReferenceInput'
import { kindLabel, type RuntimeArgumentNamePrefix } from './runtime-argument-kind'
import { ScalarValueInput } from './ScalarValueInput'

export const ArgumentRow = memo(function ArgumentRow({
  argument,
  index,
  dataClasses,
  allowedKinds,
  namePrefix,
  onChange,
  onChangeKind,
  onDuplicate,
  onRemove,
}: {
  argument: RuntimeArgument
  index: number
  dataClasses: string[]
  allowedKinds: ReadonlyArray<RuntimeArgument['kind']>
  namePrefix: RuntimeArgumentNamePrefix
  onChange: (argument: RuntimeArgument) => void
  onChangeKind: (id: string, kind: RuntimeArgument['kind']) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const sortable = useSortable({ id: argument.id })
  const style = {
    transform: CSS.Transform.toString(sortable.transform ? { ...sortable.transform, x: 0 } : null),
    transition: sortable.transition,
  }
  const positionalName = `${namePrefix}${index + 1}`
  const isCustom = argument.kind === 'custom'
  const isEntityRef = argument.kind === 'entity' || argument.kind === 'entitysel'
  const isScalar =
    argument.kind === 'string' ||
    argument.kind === 'number' ||
    argument.kind === 'boolean' ||
    argument.kind === 'date'

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'group relative border-border/60 border-b last:border-b-0',
        'transition-colors duration-150',
        sortable.isDragging && 'z-10 bg-muted/60 shadow-sm'
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-x-1">
        <div className="flex items-center self-center">
          <button
            type="button"
            className="cursor-grab rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('methodExecutor.reorderArgument')}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted-foreground/80 tabular-nums">
            {positionalName}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden px-1">
          {isEntityRef ? (
            <EntityReferenceInput
              argument={{ ...argument, name: positionalName }}
              dataClasses={dataClasses}
              onChange={onChange}
            />
          ) : isScalar ? (
            <ScalarValueInput
              argument={{ ...argument, name: positionalName }}
              onChange={onChange}
            />
          ) : (
            <span className="font-mono text-muted-foreground text-xs">
              {argument.sourceType ?? 'Variant'}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-px self-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Select
            value={argument.kind}
            onValueChange={(value) => onChangeKind(argument.id, value as RuntimeArgument['kind'])}
          >
            <SelectTrigger className="h-6 w-34 justify-between gap-1 border-0 bg-transparent px-1.5 text-[11px] text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedKinds.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {kindLabel(kind, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onDuplicate}
            aria-label={t('methodExecutor.duplicateArgument')}
            title={t('methodExecutor.duplicateArgument')}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={t('methodExecutor.removeArgument')}
            title={t('methodExecutor.removeArgument')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isCustom ? <CustomArgumentEditor argument={argument} onChange={onChange} /> : null}
    </div>
  )
})
