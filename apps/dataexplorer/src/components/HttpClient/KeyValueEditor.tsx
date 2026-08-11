import { Button, Checkbox, cn, TemplatedTextInput } from '@4d/ui'
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
import { GripVertical, ListTree, Plus, Trash2 } from 'lucide-react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { SuggestInput } from '~/components/SuggestInput'
import { useTranslation } from '~/i18n'
import { createKeyValuePair, type HttpKeyValuePair } from '~/store/http-client-types'

function SortableKeyValueRow({
  pair,
  index,
  keyPlaceholder,
  valuePlaceholder,
  keySuggestions,
  thisRoot,
  onUpdate,
  onRemove,
}: {
  pair: HttpKeyValuePair
  index: number
  keyPlaceholder: string
  valuePlaceholder: string
  keySuggestions: readonly string[]
  valueSuggestions: readonly string[]
  thisRoot?: unknown
  onUpdate: (index: number, patch: Partial<HttpKeyValuePair>) => void
  onRemove: (index: number) => void
}) {
  const { t } = useTranslation()
  const envField = useTemplatedEnvFieldProps({ thisRoot })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pair.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_minmax(0,1.35fr)_2rem] items-stretch border-border/60 border-b last:border-b-0',
        isDragging && 'relative z-10 bg-muted/70 shadow-sm'
      )}
    >
      <button
        type="button"
        className="flex cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={t('httpClient.reorderRow')}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-center justify-center border-border/50 border-r">
        <Checkbox
          checked={pair.enabled}
          onCheckedChange={(checked) => onUpdate(index, { enabled: checked === true })}
          aria-label={t('httpClient.enableRow')}
        />
      </div>

      <div className="flex min-w-0 items-center border-border/50 border-r">
        <SuggestInput
          value={pair.key}
          onChange={(key) => onUpdate(index, { key })}
          suggestions={keySuggestions}
          filter="includes"
          placeholder={keyPlaceholder}
          className="h-full w-full"
          inputClassName="h-6 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
          minListWidth={180}
        />
      </div>

      <div className="flex min-w-0 items-center border-border/50 border-r">
        <TemplatedTextInput
          value={pair.value}
          onChange={(value) => onUpdate(index, { value })}
          placeholder={valuePlaceholder}
          className="h-6 w-full rounded-none border-0 bg-transparent px-2 py-0 font-mono text-xs leading-none shadow-none focus-visible:ring-0"
          {...envField}
        />
      </div>

      <div className="flex items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
          onClick={() => onRemove(index)}
          aria-label={t('httpClient.removeRow')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keySuggestions,
  valueSuggestions,
  getValueSuggestions,
  thisRoot,
  addLabel = 'Add',
  emptyTitle = 'No entries yet',
  emptyDescription,
}: {
  pairs: HttpKeyValuePair[]
  onChange: (pairs: HttpKeyValuePair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  keySuggestions?: readonly string[]
  valueSuggestions?: readonly string[]
  /** Per-row value suggestions based on the current key (overrides valueSuggestions when non-empty). */
  getValueSuggestions?: (key: string) => readonly string[]
  thisRoot?: unknown
  addLabel?: string
  emptyTitle?: string
  emptyDescription?: string
}) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const update = (index: number, patch: Partial<HttpKeyValuePair>) => {
    onChange(pairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)))
  }

  const remove = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...pairs, createKeyValuePair()])
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pairs.findIndex((pair) => pair.id === active.id)
    const newIndex = pairs.findIndex((pair) => pair.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(pairs, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      {pairs.length === 0 ? (
        <EmptyPanel
          icon={ListTree}
          badgeIcon={Plus}
          badgeTone="primary"
          title={emptyTitle}
          description={emptyDescription}
          ghost="rows"
          bordered
          size="sm"
          action={
            <EmptyPanelAction icon={Plus} onClick={add}>
              {addLabel}
            </EmptyPanelAction>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border bg-background">
          <div className="grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_minmax(0,1.35fr)_2rem] border-border/60 border-b bg-muted/30 text-[11px] text-muted-foreground">
            <div aria-hidden />
            <div aria-hidden className="border-border/50 border-r" />
            <div className="border-border/50 border-r px-2 py-1.5 font-medium">
              {t('httpClient.key')}
            </div>
            <div className="border-border/50 border-r px-2 py-1.5 font-medium">
              {t('httpClient.value')}
            </div>
            <div aria-hidden />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={pairs.map((pair) => pair.id)}
              strategy={verticalListSortingStrategy}
            >
              {pairs.map((pair, index) => (
                <SortableKeyValueRow
                  key={pair.id}
                  pair={pair}
                  index={index}
                  keyPlaceholder={keyPlaceholder}
                  valuePlaceholder={valuePlaceholder}
                  keySuggestions={keySuggestions ?? []}
                  valueSuggestions={getValueSuggestions?.(pair.key) ?? valueSuggestions ?? []}
                  thisRoot={thisRoot}
                  onUpdate={update}
                  onRemove={remove}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      {pairs.length > 0 ? (
        <Button type="button" variant="outline" size="xs" onClick={add}>
          <Plus />
          {addLabel}
        </Button>
      ) : null}
    </div>
  )
}
