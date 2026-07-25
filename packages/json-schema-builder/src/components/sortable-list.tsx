import { cn } from '@4d/ui'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import * as React from 'react'
import { useSchemaBuilderI18n } from './schema-builder'

export interface SortableListProps<T> {
  items: T[]
  getItemId: (item: T) => string
  onReorder: (newOrder: T[]) => void
  renderItem: (item: T, dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode
  className?: string
}

export function SortableList<T>({
  items,
  getItemId,
  onReorder,
  renderItem,
  className,
}: SortableListProps<T>) {
  const ids = React.useMemo(() => items.map(getItemId), [items, getItemId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over == null || active.id === over.id) return
      const oldIndex = ids.indexOf(active.id as string)
      const newIndex = ids.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(items, oldIndex, newIndex)
      onReorder(newOrder)
    },
    [items, ids, onReorder]
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={cn('flex flex-col', className)}>
          {items.map((item) => (
            <SortableListItem
              key={getItemId(item)}
              item={item}
              getItemId={getItemId}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableListItemProps<T> {
  item: T
  getItemId: (item: T) => string
  renderItem: (item: T, dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode
}

function SortableListItem<T>({ item, getItemId, renderItem }: SortableListItemProps<T>) {
  const id = getItemId(item)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style: React.CSSProperties = {
    ...(transform != null && {
      transform: CSS.Transform.toString({ ...transform, x: 0 }),
    }),
    transition,
  }

  const t = useSchemaBuilderI18n()
  const dragHandleProps = {
    ...attributes,
    ...listeners,
    type: 'button' as const,
    className:
      'flex h-6 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-ring',
    'aria-label': t('sortableDragToReorder'),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-1 rounded-sm bg-muted/20 p-1 transition-shadow',
        isDragging && 'z-10 opacity-60 shadow-sm'
      )}
    >
      <button {...dragHandleProps}>
        <GripVertical className="size-3.5 shrink-0" />
      </button>
      <div className="min-w-0 flex-1">{renderItem(item, dragHandleProps)}</div>
    </div>
  )
}
