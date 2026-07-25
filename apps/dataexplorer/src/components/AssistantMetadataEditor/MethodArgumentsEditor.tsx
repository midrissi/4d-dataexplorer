import {
  Button,
  CodeEditor,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@4d/ui'
import {
  argumentsToParamsSchema,
  methodArgumentsEditorJsonSchema,
  sanitizeMethodArgumentForType,
} from '@4djs/assistant/tools'
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
import {
  Braces,
  Code2,
  GripVertical,
  ListOrdered,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '~/i18n'
import type { MethodArgumentSchema } from '~/lib/assistant-metadata-schema'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'
import './assistant-metadata-editor.css'
import { AiGenerateFooter } from './MethodArgumentsAiFooter'

const ARGUMENT_TYPES: MethodArgumentSchema['type'][] = [
  'string',
  'integer',
  'number',
  'boolean',
  'object',
  'array',
]

const TYPE_DOT: Record<MethodArgumentSchema['type'], string> = {
  string: 'bg-sky-500',
  integer: 'bg-violet-500',
  number: 'bg-teal-500',
  boolean: 'bg-amber-500',
  object: 'bg-orange-500',
  array: 'bg-rose-500',
}

type MethodArgumentsEditorProps = {
  methodName: string
  methodArguments: MethodArgumentSchema[] | undefined
  onChange: (methodArguments: MethodArgumentSchema[] | undefined) => void
  onGenerate?: () => void | Promise<void>
  aiEnabled?: boolean
  generating?: boolean
}

function defaultArgument(type: MethodArgumentSchema['type'] = 'string'): MethodArgumentSchema {
  return { type }
}

function createItemIds(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomUUID())
}

function useStableItemIds(count: number) {
  const [ids, setIds] = useState(() => createItemIds(count))

  useEffect(() => {
    setIds((prev) => {
      if (prev.length === count) return prev
      if (prev.length < count) {
        return [...prev, ...createItemIds(count - prev.length)]
      }
      return prev.slice(0, count)
    })
  }, [count])

  const reorderIds = useCallback((oldIndex: number, newIndex: number) => {
    setIds((prev) => arrayMove(prev, oldIndex, newIndex))
  }, [])

  const resetIds = useCallback((nextCount: number) => {
    setIds(createItemIds(nextCount))
  }, [])

  return { ids, reorderIds, resetIds }
}

const CONSTRAINT_CONTROL_CLASS =
  'method-args__control method-args__control--constraint border-0 bg-transparent text-xs shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0'

function hasConstraintValues(arg: MethodArgumentSchema): boolean {
  switch (arg.type) {
    case 'string':
      return arg.minLength !== undefined || arg.maxLength !== undefined || arg.pattern !== undefined
    case 'integer':
    case 'number':
      return arg.minimum !== undefined || arg.maximum !== undefined
    case 'object':
      return (
        arg.properties !== undefined ||
        arg.required !== undefined ||
        arg.additionalProperties !== undefined
      )
    case 'array':
      return arg.items !== undefined || arg.minItems !== undefined || arg.maxItems !== undefined
    default:
      return false
  }
}

function argumentHasConstraintsPanel(type: MethodArgumentSchema['type']): boolean {
  return type !== 'boolean'
}

function formatJsonField(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function parseJsonField(text: string): unknown | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return undefined
  }
}

type JsonConstraintFieldProps = {
  label: string
  value: unknown
  placeholder: string
  rows?: number
  onCommit: (value: Record<string, unknown> | undefined) => void
}

function JsonConstraintField({
  label,
  value,
  placeholder,
  rows = 3,
  onCommit,
}: JsonConstraintFieldProps) {
  const [text, setText] = useState(() => formatJsonField(value))

  useEffect(() => {
    setText(formatJsonField(value))
  }, [value])

  const commit = () => {
    const parsed = parseJsonField(text)
    if (parsed === undefined) {
      onCommit(undefined)
      return
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      onCommit(parsed as Record<string, unknown>)
    }
  }

  return (
    <label className="method-args__constraints-json-label">
      {label}
      <textarea
        className="method-args__control method-args__control--json border-0 bg-transparent text-xs shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        rows={rows}
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    </label>
  )
}

type ArgumentConstraintsPanelProps = {
  arg: MethodArgumentSchema
  onChange: (patch: Partial<MethodArgumentSchema>) => void
}

function ArgumentConstraintsPanel({ arg, onChange }: ArgumentConstraintsPanelProps) {
  const { t } = useTranslation()
  const placeholder = t('assistantMetadata.argumentConstraintAny')
  const hasValues = hasConstraintValues(arg)

  const clearConstraints = () => {
    switch (arg.type) {
      case 'string':
        onChange({ minLength: undefined, maxLength: undefined, pattern: undefined })
        break
      case 'integer':
      case 'number':
        onChange({ minimum: undefined, maximum: undefined })
        break
      case 'object':
        onChange({
          properties: undefined,
          required: undefined,
          additionalProperties: undefined,
        })
        break
      case 'array':
        onChange({ items: undefined, minItems: undefined, maxItems: undefined })
        break
    }
  }

  const renderRangeFields = (
    minLabel: string,
    maxLabel: string,
    minValue: number | undefined,
    maxValue: number | undefined,
    onMinChange: (value: number | undefined) => void,
    onMaxChange: (value: number | undefined) => void
  ) => (
    <div className="method-args__constraints-fields">
      <div className="method-args__constraint">
        <span className="method-args__constraint-name">{minLabel}</span>
        <Input
          type="number"
          inputMode="numeric"
          className={CONSTRAINT_CONTROL_CLASS}
          value={minValue ?? ''}
          placeholder={placeholder}
          aria-label={minLabel}
          onChange={(e) => onMinChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
      <span className="method-args__constraint-sep" aria-hidden>
        —
      </span>
      <div className="method-args__constraint">
        <span className="method-args__constraint-name">{maxLabel}</span>
        <Input
          type="number"
          inputMode="numeric"
          className={CONSTRAINT_CONTROL_CLASS}
          value={maxValue ?? ''}
          placeholder={placeholder}
          aria-label={maxLabel}
          onChange={(e) => onMaxChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
    </div>
  )

  let fields: ReactNode = null

  if (arg.type === 'string') {
    fields = renderRangeFields(
      t('assistantMetadata.argumentMinLength'),
      t('assistantMetadata.argumentMaxLength'),
      arg.minLength,
      arg.maxLength,
      (minLength) => onChange({ minLength }),
      (maxLength) => onChange({ maxLength })
    )
  } else if (arg.type === 'integer' || arg.type === 'number') {
    fields = renderRangeFields(
      t('assistantMetadata.argumentMinimum'),
      t('assistantMetadata.argumentMaximum'),
      arg.minimum,
      arg.maximum,
      (minimum) => onChange({ minimum }),
      (maximum) => onChange({ maximum })
    )
  } else if (arg.type === 'object') {
    fields = (
      <div className="method-args__constraints-json">
        <JsonConstraintField
          label={t('assistantMetadata.argumentProperties')}
          value={arg.properties}
          placeholder='{ "fieldName": { "type": "string" } }'
          onCommit={(properties) => onChange({ properties })}
        />
      </div>
    )
  } else if (arg.type === 'array') {
    fields = (
      <div className="method-args__constraints-stack">
        <JsonConstraintField
          label={t('assistantMetadata.argumentItems')}
          value={arg.items}
          placeholder='{ "type": "string" }'
          rows={2}
          onCommit={(items) => onChange({ items })}
        />
        {renderRangeFields(
          t('assistantMetadata.argumentMinItems'),
          t('assistantMetadata.argumentMaxItems'),
          arg.minItems,
          arg.maxItems,
          (minItems) => onChange({ minItems }),
          (maxItems) => onChange({ maxItems })
        )}
      </div>
    )
  }

  return (
    <div className="method-args__constraints">
      <div className="method-args__constraints-bar method-args__constraints-bar--stacked">
        <span className="method-args__constraints-label">
          <SlidersHorizontal className="h-3 w-3" aria-hidden />
          {t('assistantMetadata.argumentConstraints')}
        </span>

        {fields}

        {hasValues ? (
          <button
            type="button"
            className="method-args__constraints-clear"
            onClick={clearConstraints}
            aria-label={t('assistantMetadata.clearConstraints')}
            title={t('assistantMetadata.clearConstraints')}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}

type ArgumentCardProps = {
  sortId: string
  arg: MethodArgumentSchema
  index: number
  onChange: (patch: Partial<MethodArgumentSchema>) => void
  onRemove: () => void
}

function ArgumentCard({ sortId, arg, index, onChange, onRemove }: ArgumentCardProps) {
  const { t } = useTranslation()
  const [constraintsOpen, setConstraintsOpen] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId,
  })

  const hasConstraints = argumentHasConstraintsPanel(arg.type)
  const constraintValuesSet = hasConstraintValues(arg)
  const typeDot = TYPE_DOT[arg.type]

  const style: CSSProperties = {
    ...(transform != null && {
      transform: CSS.Transform.toString({ ...transform, x: 0 }),
    }),
    transition,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn('method-args__card', isDragging && 'method-args__card--dragging')}
    >
      <div className="method-args__card-row">
        <button
          type="button"
          className="method-args__drag-handle"
          {...attributes}
          {...listeners}
          aria-label={t('assistantMetadata.dragArgumentToReorder')}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>

        <span className="method-args__index" aria-hidden>
          {index + 1}
        </span>

        <Select
          value={arg.type}
          onValueChange={(value) =>
            onChange(sanitizeMethodArgumentForType(arg, value as MethodArgumentSchema['type']))
          }
        >
          <SelectTrigger
            className={cn(
              'method-args__type-select border-0 shadow-none focus:ring-0 focus:ring-offset-0',
              `method-args__type-select--${arg.type}`
            )}
          >
            <span className={cn('method-args__type-dot', typeDot)} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ARGUMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={arg.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value || undefined })}
          placeholder={t('assistantMetadata.argumentDescriptionPlaceholder')}
          className="method-args__control method-args__control--inline min-w-0 flex-1 border-0 bg-transparent text-xs shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {hasConstraints ? (
          <button
            type="button"
            className={cn(
              'method-args__icon-btn',
              (constraintsOpen || constraintValuesSet) && 'method-args__icon-btn--active'
            )}
            onClick={() => setConstraintsOpen((open) => !open)}
            aria-expanded={constraintsOpen}
            aria-label={t('assistantMetadata.argumentConstraints')}
            title={t('assistantMetadata.argumentConstraints')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          className="method-args__icon-btn method-args__icon-btn--danger"
          onClick={onRemove}
          aria-label={t('assistantMetadata.removeArgument')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {hasConstraints && constraintsOpen ? (
        <ArgumentConstraintsPanel arg={arg} onChange={onChange} />
      ) : null}
    </article>
  )
}

export function MethodArgumentsEditor({
  methodName,
  methodArguments: args,
  onChange,
  onGenerate,
  aiEnabled = false,
  generating = false,
}: MethodArgumentsEditorProps) {
  const { t } = useTranslation()
  const [advancedTab, setAdvancedTab] = useState<'preview' | 'json' | null>(null)
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()

  const items = args ?? []
  const { ids: itemIds, reorderIds, resetIds } = useStableItemIds(items.length)
  const [jsonDraft, setJsonDraft] = useState('')
  const jsonDraftDirtyRef = useRef(false)

  const serializeItems = useCallback(
    (list: MethodArgumentSchema[]) => JSON.stringify(list, null, 2),
    []
  )

  const commitJsonDraft = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as unknown
      if (!Array.isArray(parsed)) return false
      const next = parsed.filter(
        (entry): entry is MethodArgumentSchema =>
          !!entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          typeof (entry as MethodArgumentSchema).type === 'string'
      )
      resetIds(next.length)
      onChange(next.length > 0 ? next : undefined)
      jsonDraftDirtyRef.current = false
      return true
    } catch {
      return false
    }
  }, [jsonDraft, onChange, resetIds])

  const handleJsonDraftChange = useCallback((text: string) => {
    jsonDraftDirtyRef.current = true
    setJsonDraft(text)
  }, [])

  // Refresh draft from visual editor only when the user hasn't edited JSON locally.
  useEffect(() => {
    if (advancedTab === 'json' && !jsonDraftDirtyRef.current) {
      setJsonDraft(serializeItems(items))
    }
  }, [advancedTab, items, serializeItems])

  const previewJson = useMemo(
    () => JSON.stringify(argumentsToParamsSchema(items), null, 2),
    [items]
  )

  const editorLabels = useMemo(
    () => ({
      format: t('assistantMetadata.jsonFormat'),
      copy: t('assistantMetadata.jsonCopy'),
      copied: t('assistantMetadata.jsonCopied'),
      wrap: t('assistantMetadata.jsonWrap'),
      theme: t('assistantMetadata.jsonTheme'),
      fontSize: t('assistantMetadata.jsonFontSize'),
    }),
    [t]
  )

  const argumentsEditorPath = useMemo(() => `method-arguments/${methodName}.json`, [methodName])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const updateAt = (index: number, patch: Partial<MethodArgumentSchema>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange(next.length > 0 ? next : undefined)
  }

  const removeAt = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length > 0 ? next : undefined)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over == null || active.id === over.id) return

    const oldIndex = itemIds.indexOf(String(active.id))
    const newIndex = itemIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    onChange(arrayMove(items, oldIndex, newIndex))
    reorderIds(oldIndex, newIndex)
  }

  const addArgument = () => {
    onChange([...items, defaultArgument()])
  }

  const toggleAdvancedTab = (tab: 'preview' | 'json') => {
    if (advancedTab === 'json') {
      commitJsonDraft()
    }
    setAdvancedTab((current) => {
      const next = current === tab ? null : tab
      if (next === 'json') {
        setJsonDraft(serializeItems(items))
        jsonDraftDirtyRef.current = false
      }
      return next
    })
  }

  return (
    <div className="method-args">
      <div className="method-args__header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
            <span className="font-medium text-sm">{t('assistantMetadata.methodArguments')}</span>
            {items.length > 0 ? (
              <span className="method-args__count">
                {t('assistantMetadata.argumentsCount', { count: items.length })}
              </span>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="mt-0.5 text-muted-foreground text-xs">
              {t('assistantMetadata.argumentsFlowHint')}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          className="h-6 shrink-0 gap-1 px-2 text-xs"
          onClick={addArgument}
        >
          <Plus className="h-3 w-3" />
          {t('assistantMetadata.addArgument')}
        </Button>
      </div>

      <div className="method-args__body">
        {items.length === 0 ? (
          <div className="method-args__empty">
            <div className="method-args__empty-icon">
              <Braces className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <p className="font-medium text-sm">{t('assistantMetadata.argumentsEmptyTitle')}</p>
            <p className="max-w-sm text-center text-muted-foreground text-xs leading-relaxed">
              {t('assistantMetadata.argumentsEmptyHint')}
            </p>
            <Button type="button" size="xs" className="mt-1 h-6 gap-1 px-2.5" onClick={addArgument}>
              <Plus className="h-3 w-3" />
              {t('assistantMetadata.addFirstArgument')}
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="method-args__list">
                {items.map((arg, index) => {
                  const sortId = itemIds[index]
                  if (!sortId) return null

                  return (
                    <ArgumentCard
                      key={sortId}
                      sortId={sortId}
                      arg={arg}
                      index={index}
                      onChange={(patch) => updateAt(index, patch)}
                      onRemove={() => removeAt(index)}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="method-args__toolbar">
        <div
          className="method-args__tabs"
          role="tablist"
          aria-label={t('assistantMetadata.methodArguments')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={advancedTab === 'preview'}
            className={cn(
              'method-args__tab',
              advancedTab === 'preview' && 'method-args__tab--active'
            )}
            onClick={() => toggleAdvancedTab('preview')}
          >
            <Braces className="h-3 w-3" />
            {t('assistantMetadata.paramsSchemaPreview')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={advancedTab === 'json'}
            className={cn('method-args__tab', advancedTab === 'json' && 'method-args__tab--active')}
            onClick={() => toggleAdvancedTab('json')}
          >
            <Code2 className="h-3 w-3" />
            {t('assistantMetadata.editArgumentsJson')}
          </button>
        </div>

        <AiGenerateFooter
          onGenerate={onGenerate}
          aiEnabled={aiEnabled}
          generating={generating}
          tooltip={t('assistantMetadata.generateArgumentsHint')}
          ariaLabel={t('assistantMetadata.generateArguments')}
        />
      </div>

      {advancedTab === 'preview' ? (
        <div className="method-args__panel method-args__panel--editor">
          <CodeEditor
            path={`${argumentsEditorPath}/preview`}
            language="json"
            value={previewJson}
            readOnly
            height="260px"
            fontSize={12}
            showLineNumbers
            className="method-args__code-editor"
            labels={editorLabels}
            editorPrefs={codeEditorPrefs}
            onEditorPrefsChange={updateCodeEditorPrefs}
          />
        </div>
      ) : null}

      {advancedTab === 'json' ? (
        <div className="method-args__panel method-args__panel--editor">
          <CodeEditor
            path={argumentsEditorPath}
            language="json"
            value={jsonDraft}
            onChange={handleJsonDraftChange}
            onBlur={commitJsonDraft}
            height="260px"
            fontSize={12}
            showLineNumbers
            schema={methodArgumentsEditorJsonSchema}
            className="method-args__code-editor"
            labels={editorLabels}
            editorPrefs={codeEditorPrefs}
            onEditorPrefsChange={updateCodeEditorPrefs}
          />
        </div>
      ) : null}
    </div>
  )
}
