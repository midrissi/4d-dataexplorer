import { Button, cn } from '@4d/ui'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { ArgumentRow } from './ArgumentRow'
import { flushPendingArgumentValues } from './arg-input'
import {
  ARGUMENT_KINDS,
  changeRuntimeArgumentKind,
  duplicateArgument,
  emptyArgument,
  type RuntimeArgumentNamePrefix,
  withPositionalNames,
} from './runtime-argument-kind'

export { flushPendingArgumentValues, readLiveArgumentInputValues } from './arg-input'
export {
  areRuntimeArgumentsReady,
  changeRuntimeArgumentKind,
  type RuntimeArgumentNamePrefix,
  withPositionalNames,
} from './runtime-argument-kind'

export function RuntimeArgumentsEditor({
  argumentsList,
  dataClasses,
  onChange,
  allowedKinds = ARGUMENT_KINDS,
  namePrefix = '$',
  className,
}: {
  argumentsList: RuntimeArgument[]
  dataClasses: string[]
  onChange: (argumentsList: RuntimeArgument[]) => void
  allowedKinds?: ReadonlyArray<RuntimeArgument['kind']>
  namePrefix?: RuntimeArgumentNamePrefix
  className?: string
}) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const defaultKind = allowedKinds[0] ?? 'string'
  const listRef = useRef(argumentsList)
  listRef.current = argumentsList

  const commit = (next: RuntimeArgument[]) => {
    const named = withPositionalNames(next, namePrefix)
    listRef.current = named
    onChange(named)
  }

  const patchArgument = (next: RuntimeArgument) => {
    commit(listRef.current.map((item) => (item.id === next.id ? next : item)))
  }

  const changeArgumentKind = (id: string, kind: RuntimeArgument['kind']) => {
    flushPendingArgumentValues()
    const current = listRef.current.find((item) => item.id === id)
    if (!current) return
    patchArgument(changeRuntimeArgumentKind(current, kind))
  }

  const addArgument = () =>
    commit([...listRef.current, emptyArgument(listRef.current.length + 1, namePrefix, defaultKind)])
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = listRef.current.findIndex((argument) => argument.id === active.id)
    const newIndex = listRef.current.findIndex((argument) => argument.id === over.id)
    commit(arrayMove(listRef.current, oldIndex, newIndex))
  }

  return (
    <div className={cn('space-y-2 border-border/60 border-t pt-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t('methodExecutor.arguments')}
          </h3>
          {argumentsList.length > 0 ? (
            <span className="rounded-sm bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
              {argumentsList.length}
            </span>
          ) : null}
          <p className="truncate text-[11px] text-muted-foreground leading-snug">
            {t('methodExecutor.positionalOrder')}
          </p>
        </div>
        {argumentsList.length > 0 ? (
          <Button variant="outline" size="xs" className="shrink-0" onClick={addArgument}>
            <Plus />
            {t('methodExecutor.add')}
          </Button>
        ) : null}
      </div>

      {argumentsList.length === 0 ? (
        <button
          type="button"
          onClick={addArgument}
          className={cn(
            'group relative flex w-full items-center gap-2 overflow-hidden rounded-md',
            'border border-border/70 border-dashed bg-muted/20 px-2 py-1 text-left',
            'transition-colors duration-150',
            'hover:border-primary/45 hover:bg-primary/5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary/0 transition-colors group-hover:bg-primary"
          />
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm',
              'border border-muted-foreground/25 border-dashed text-muted-foreground/55',
              'transition-colors group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary'
            )}
          >
            <Plus className="h-3 w-3" />
          </span>
          <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted-foreground/55 tabular-nums transition-colors group-hover:text-primary/80">
            {namePrefix}1
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground leading-snug">
            <span className="font-medium text-foreground/80">
              {t('methodExecutor.noArgumentsTitle')}
            </span>
            <span className="text-muted-foreground/80">
              {' — '}
              {t('methodExecutor.noArgumentsHint')}
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 rounded-sm px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide',
              'bg-muted text-muted-foreground',
              'transition-colors group-hover:bg-primary group-hover:text-primary-foreground'
            )}
          >
            {t('methodExecutor.add')}
          </span>
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={argumentsList.map((argument) => argument.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              className="overflow-hidden rounded-md border bg-background"
              data-runtime-arguments=""
            >
              {argumentsList.map((argument, index) => (
                <ArgumentRow
                  key={argument.id}
                  argument={argument}
                  index={index}
                  dataClasses={dataClasses}
                  allowedKinds={allowedKinds}
                  namePrefix={namePrefix}
                  onChange={patchArgument}
                  onChangeKind={changeArgumentKind}
                  onDuplicate={() =>
                    commit([
                      ...listRef.current.slice(0, index + 1),
                      duplicateArgument(argument),
                      ...listRef.current.slice(index + 1),
                    ])
                  }
                  onRemove={() => commit(listRef.current.filter((item) => item.id !== argument.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
