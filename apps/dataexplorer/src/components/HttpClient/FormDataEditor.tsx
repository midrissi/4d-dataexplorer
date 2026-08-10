import {
  Button,
  Checkbox,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TemplatedTextInput,
} from '@4d/ui'
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
import { GripVertical, Inbox, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTemplatedEnvFieldProps } from '~/components/Environments/use-templated-env-field-props'
import { useTranslation } from '~/i18n'
import { createHttpId, type HttpFormDataField } from '~/store/http-client-types'
import { HttpFilePicker } from './HttpFilePicker'

function createTextField(): HttpFormDataField {
  return {
    id: createHttpId(),
    kind: 'text',
    key: '',
    value: '',
    enabled: true,
  }
}

function SortableFormDataRow({
  field,
  index,
  fileSize,
  onUpdate,
  onRemove,
  onFileChosen,
  onFileCleared,
}: {
  field: HttpFormDataField
  index: number
  fileSize?: number
  onUpdate: (index: number, patch: Partial<HttpFormDataField> & { kind?: 'text' | 'file' }) => void
  onRemove: (index: number) => void
  onFileChosen: (fieldId: string, file: File) => void
  onFileCleared: (fieldId: string) => void
}) {
  const { t } = useTranslation()
  const envField = useTemplatedEnvFieldProps()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
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
        'group grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_5.5rem_minmax(0,1.35fr)_2rem] items-stretch border-border/60 border-b last:border-b-0',
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
          checked={field.enabled}
          onCheckedChange={(checked) => onUpdate(index, { enabled: checked === true })}
          aria-label={t('httpClient.enableRow')}
        />
      </div>

      <div className="min-w-0 border-border/50 border-r">
        <Input
          className="h-6 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
          placeholder={t('httpClient.key')}
          value={field.key}
          onChange={(e) => onUpdate(index, { key: e.target.value })}
        />
      </div>

      <div className="border-border/50 border-r">
        <Select
          value={field.kind}
          onValueChange={(kind) => {
            if (kind === 'text') {
              onFileCleared(field.id)
              onUpdate(index, {
                kind: 'text',
                value: field.kind === 'text' ? field.value : '',
              })
            } else {
              onFileCleared(field.id)
              onUpdate(index, { kind: 'file', fileName: undefined })
            }
          }}
        >
          <SelectTrigger className="h-6 w-full justify-between rounded-none border-0 bg-transparent px-2 text-[11px] text-muted-foreground shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">{t('httpClient.text')}</SelectItem>
            <SelectItem value="file">{t('httpClient.file')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 items-center border-border/50 border-r">
        {field.kind === 'text' ? (
          <TemplatedTextInput
            className="h-6 w-full rounded-none border-0 bg-transparent px-2 py-0 font-mono text-xs leading-none shadow-none focus-visible:ring-0"
            placeholder={t('httpClient.value')}
            value={field.value}
            onChange={(value) => onUpdate(index, { value })}
            {...envField}
          />
        ) : (
          <HttpFilePicker
            fileName={field.fileName}
            contentType={field.contentType}
            fileSize={fileSize}
            onPick={(file) => {
              onFileChosen(field.id, file)
              onUpdate(index, {
                kind: 'file',
                fileName: file.name,
                contentType: file.type || undefined,
              })
            }}
            onClear={() => {
              onFileCleared(field.id)
              onUpdate(index, { kind: 'file', fileName: undefined, contentType: undefined })
            }}
          />
        )}
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

export function FormDataEditor({
  fields,
  onChange,
  onFileChosen,
}: {
  fields: HttpFormDataField[]
  onChange: (fields: HttpFormDataField[]) => void
  onFileChosen: (fieldId: string, file: File) => void
}) {
  const { t } = useTranslation()
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({})
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const update = (
    index: number,
    patch: Partial<HttpFormDataField> & { kind?: 'text' | 'file' }
  ) => {
    onChange(
      fields.map((field, i) => {
        if (i !== index) return field
        if (patch.kind === 'text') {
          return {
            id: field.id,
            kind: 'text' as const,
            key: patch.key ?? field.key,
            value:
              typeof patch.value === 'string'
                ? patch.value
                : field.kind === 'text'
                  ? field.value
                  : '',
            enabled: patch.enabled ?? field.enabled,
            contentType: patch.contentType,
          }
        }
        if (patch.kind === 'file') {
          return {
            id: field.id,
            kind: 'file' as const,
            key: patch.key ?? field.key,
            enabled: patch.enabled ?? field.enabled,
            fileName: patch.fileName,
            fileBase64: patch.fileBase64,
            contentType: patch.contentType,
          }
        }
        return { ...field, ...patch } as HttpFormDataField
      })
    )
  }

  const remove = (index: number) => {
    const removed = fields[index]
    if (removed) {
      setFileSizes((prev) => {
        if (!(removed.id in prev)) return prev
        const next = { ...prev }
        delete next[removed.id]
        return next
      })
    }
    onChange(fields.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...fields, createTextField()])
  }

  const handleFileChosen = (fieldId: string, file: File) => {
    setFileSizes((prev) => ({ ...prev, [fieldId]: file.size }))
    onFileChosen(fieldId, file)
  }

  const handleFileCleared = (fieldId: string) => {
    setFileSizes((prev) => {
      if (!(fieldId in prev)) return prev
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = fields.findIndex((field) => field.id === active.id)
    const newIndex = fields.findIndex((field) => field.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(fields, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <EmptyPanel
          icon={Inbox}
          badgeIcon={Plus}
          badgeTone="primary"
          title={t('httpClient.noFieldsTitle')}
          description={t('httpClient.noFieldsDescription')}
          ghost="rows"
          bordered
          size="sm"
          action={
            <EmptyPanelAction icon={Plus} onClick={add}>
              {t('httpClient.addField')}
            </EmptyPanelAction>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border bg-background">
          <div className="grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_5.5rem_minmax(0,1.35fr)_2rem] border-border/60 border-b bg-muted/30 text-[11px] text-muted-foreground">
            <div aria-hidden />
            <div aria-hidden className="border-border/50 border-r" />
            <div className="border-border/50 border-r px-2 py-1.5 font-medium">
              {t('httpClient.key')}
            </div>
            <div className="border-border/50 border-r px-2 py-1.5 font-medium">
              {t('httpClient.type')}
            </div>
            <div className="border-border/50 border-r px-2 py-1.5 font-medium">
              {t('httpClient.value')}
            </div>
            <div aria-hidden />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={fields.map((field) => field.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field, index) => (
                <SortableFormDataRow
                  key={field.id}
                  field={field}
                  index={index}
                  fileSize={fileSizes[field.id]}
                  onUpdate={update}
                  onRemove={remove}
                  onFileChosen={handleFileChosen}
                  onFileCleared={handleFileCleared}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      {fields.length > 0 ? (
        <Button type="button" variant="outline" size="xs" onClick={add}>
          <Plus />
          {t('httpClient.addField')}
        </Button>
      ) : null}
    </div>
  )
}
