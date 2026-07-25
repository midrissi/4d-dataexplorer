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
  Switch,
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
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '~/i18n'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { DateArgumentPicker } from './DateArgumentPicker'
import { EntitySelectionKeyInput } from './EntitySelectionKeyInput'
import { SearchableDataclassSelect } from './SearchableDataclassSelect'

const ARGUMENT_KINDS = [
  'string',
  'number',
  'boolean',
  'date',
  'custom',
  'entity',
  'entitysel',
] as const satisfies ReadonlyArray<RuntimeArgument['kind']>

const ARG_INPUT_ATTR = 'data-method-arg-input'

type ArgumentFlush = () => void
const pendingArgumentFlushes = new Set<ArgumentFlush>()

/** Push any in-progress argument drafts to parent state (call before Run / Execute). */
export function flushPendingArgumentValues() {
  for (const flush of [...pendingArgumentFlushes]) flush()
}

/**
 * Live values from argument inputs currently in the DOM, keyed by param name (`:1`, `$2`, …).
 * Used so Cmd/Ctrl+Enter can read what is on screen even before blur.
 */
export function readLiveArgumentInputValues(): Record<string, string> {
  const root = document.querySelector('[data-runtime-arguments]')
  if (!root) return {}
  const values: Record<string, string> = {}
  for (const el of root.querySelectorAll<HTMLInputElement>(
    `input[${ARG_INPUT_ATTR}], textarea[${ARG_INPUT_ATTR}]`
  )) {
    const name = el.getAttribute('data-param-name')
    if (name) values[name] = el.value
  }
  return values
}

/**
 * Uncontrolled text field: no React updates while typing.
 * Commits on blur / unmount / flushPendingArgumentValues().
 */
function useUncontrolledCommit(value: string, onCommit: (value: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const liveValueRef = useRef(value)
  const committedRef = useRef(value)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit

  // Keep committed baseline in sync when parent value changes externally.
  useEffect(() => {
    committedRef.current = value
    liveValueRef.current = value
  }, [value])

  const flush = useCallback(() => {
    const el = inputRef.current
    const next = el?.value ?? liveValueRef.current
    liveValueRef.current = next
    if (next === committedRef.current) return
    committedRef.current = next
    onCommitRef.current(next)
  }, [])

  useEffect(() => {
    pendingArgumentFlushes.add(flush)
    return () => {
      pendingArgumentFlushes.delete(flush)
      flush()
    }
  }, [flush])

  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement === el) return
    if (el.value !== value) el.value = value
  }, [value])

  const onInput = useCallback((event: { currentTarget: HTMLInputElement }) => {
    liveValueRef.current = event.currentTarget.value
  }, [])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      handleArgInputTabNavigation(event)
      // Commit before Cmd/Ctrl+Enter bubbles to Run / Execute.
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        flush()
      }
    },
    [flush]
  )

  return { inputRef, flush, onInput, onKeyDown }
}

/** Tab / Shift+Tab between primary argument value inputs, skipping row chrome. */
function handleArgInputTabNavigation(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab' || event.altKey || event.metaKey || event.ctrlKey) return
  const current = event.currentTarget
  const container = current.closest('[data-runtime-arguments]')
  if (!container) return
  const inputs = Array.from(container.querySelectorAll<HTMLElement>(`[${ARG_INPUT_ATTR}]`)).filter(
    (el) => !(el instanceof HTMLInputElement && el.disabled)
  )
  const index = inputs.indexOf(current)
  if (index < 0) return
  const next = inputs[index + (event.shiftKey ? -1 : 1)]
  if (!next) return
  event.preventDefault()
  next.focus()
  if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
    next.select()
  }
}

export type RuntimeArgumentNamePrefix = '$' | ':'

function emptyArgument(
  index: number,
  namePrefix: RuntimeArgumentNamePrefix,
  kind: RuntimeArgument['kind'] = 'string'
): RuntimeArgument {
  return changeRuntimeArgumentKind(
    { id: crypto.randomUUID(), kind: 'string', name: `${namePrefix}${index}`, value: '' },
    kind
  )
}

export function withPositionalNames(
  argumentsList: RuntimeArgument[],
  namePrefix: RuntimeArgumentNamePrefix = '$'
): RuntimeArgument[] {
  return argumentsList.map((argument, index) => ({
    ...argument,
    name: `${namePrefix}${index + 1}`,
  }))
}

export function areRuntimeArgumentsReady(argumentsList: RuntimeArgument[]): boolean {
  return argumentsList.every((argument) => {
    if (argument.kind === 'entity') {
      return Boolean(argument.dataClass.trim() && argument.key.trim())
    }
    if (argument.kind === 'entitysel') {
      return Boolean(argument.dataClass.trim() && argument.entitySetId.trim())
    }
    if (argument.kind === 'number') {
      const trimmed = argument.value.trim()
      return trimmed !== '' && Number.isFinite(Number(trimmed))
    }
    if (argument.kind === 'date') {
      return /^\d{4}-\d{2}-\d{2}$/.test(argument.value.trim())
    }
    return true
  })
}

/** Text form of a typed value used when converting between argument kinds. */
function argumentValueAsText(argument: RuntimeArgument): string {
  switch (argument.kind) {
    case 'string':
    case 'number':
    case 'date':
    case 'custom':
      return argument.value
    case 'boolean':
      return argument.value ? 'true' : 'false'
    case 'entity':
      return argument.key
    case 'entitysel':
      return argument.entitySetId
  }
}

function parseBooleanText(raw: string): boolean | null {
  const lower = raw.trim().toLowerCase()
  if (!lower) return null
  if (['true', '1', 'yes', 'y'].includes(lower)) return true
  if (['false', '0', 'no', 'n'].includes(lower)) return false
  const n = Number(lower)
  if (Number.isFinite(n)) return n !== 0
  return null
}

function parseNumberText(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === 'true') return '1'
  if (lower === 'false') return '0'
  const n = Number(trimmed)
  if (Number.isFinite(n)) return String(n)
  return null
}

function parseDateText(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

function parseCustomText(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'null'
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    return JSON.stringify(trimmed)
  }
}

/**
 * Switch an argument's kind, converting the existing value when possible
 * (e.g. number `0` → string `"0"`) instead of resetting to an empty default.
 */
export function changeRuntimeArgumentKind(
  argument: RuntimeArgument,
  kind: RuntimeArgument['kind']
): RuntimeArgument {
  const common = { id: argument.id, name: argument.name, sourceType: argument.sourceType }
  if (argument.kind === kind) return argument

  const text = argumentValueAsText(argument)

  if (kind === 'entity') {
    return { ...common, kind, dataClass: '', key: text.trim() }
  }
  if (kind === 'entitysel') {
    return { ...common, kind, dataClass: '', entitySetId: text.trim() }
  }
  if (kind === 'boolean') {
    return { ...common, kind, value: parseBooleanText(text) ?? false }
  }
  if (kind === 'number') {
    return { ...common, kind, value: parseNumberText(text) ?? '0' }
  }
  if (kind === 'string') {
    return { ...common, kind, value: text }
  }
  if (kind === 'date') {
    return { ...common, kind, value: parseDateText(text) ?? '' }
  }
  return { ...common, kind: 'custom', value: parseCustomText(text) }
}

function duplicateArgument(argument: RuntimeArgument): RuntimeArgument {
  return { ...argument, id: crypto.randomUUID() }
}

type EntityReferenceArgument = Extract<RuntimeArgument, { kind: 'entity' | 'entitysel' }>

function AutoSizeKeyInput({
  id,
  name,
  value,
  label,
  onChange,
}: {
  id: string
  name: string
  value: string
  label: string
  onChange: (value: string) => void
}) {
  const { inputRef, flush, onInput, onKeyDown } = useUncontrolledCommit(value, onChange)

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        defaultValue={value}
        onBlur={flush}
        onInput={(event) => {
          onInput(event)
          const el = event.currentTarget
          const widthCh = Math.max(el.value.length, 1)
          el.size = widthCh
          el.style.width = `${widthCh}ch`
        }}
        onKeyDown={onKeyDown}
        data-param-name={name}
        {...{ [ARG_INPUT_ATTR]: '' }}
        autoComplete="off"
        spellCheck={false}
        size={Math.max(value.length, 1)}
        style={{ width: `${Math.max(value.length, 1)}ch`, fieldSizing: 'content' }}
        className="m-0 inline-block min-w-[1ch] appearance-none border-0 bg-transparent p-0 align-middle font-mono text-emerald-600 text-xs leading-5 outline-none ring-0 focus:outline-none dark:text-emerald-400"
      />
    </>
  )
}

function EntityReferenceInput({
  argument,
  dataClasses,
  onChange,
}: {
  argument: EntityReferenceArgument
  dataClasses: string[]
  onChange: (argument: RuntimeArgument) => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const isEntity = argument.kind === 'entity'
  const argumentName = argument.name ?? t('methodExecutor.argument')
  const keyLabel = isEntity ? t('methodExecutor.entityKey') : t('methodExecutor.entitySelectionKey')
  const value = isEntity ? argument.key : argument.entitySetId

  const setKey = (nextValue: string) => {
    if (argument.kind === 'entity') {
      onChange({ ...argument, key: nextValue })
    } else {
      onChange({ ...argument, entitySetId: nextValue })
    }
  }

  return (
    <code className="inline-flex min-w-max max-w-none flex-nowrap items-center gap-x-0 whitespace-nowrap font-mono text-xs leading-5">
      <span className="text-sky-600 dark:text-sky-400" translate="no" aria-hidden="true">
        ds
      </span>
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        .
      </span>
      <SearchableDataclassSelect
        value={argument.dataClass}
        dataClasses={dataClasses}
        argumentName={argumentName}
        onChange={(dataClass) => onChange({ ...argument, dataClass })}
      />
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        .
      </span>
      <span className="text-amber-600 dark:text-amber-400" translate="no" aria-hidden="true">
        {isEntity ? 'entity' : 'sel'}
      </span>
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        (
      </span>
      {isEntity ? (
        <AutoSizeKeyInput
          id={inputId}
          name={`method-argument-${argument.id}-key`}
          value={value}
          label={`${keyLabel}: ${argumentName}`}
          onChange={setKey}
        />
      ) : (
        <EntitySelectionKeyInput
          id={inputId}
          name={`method-argument-${argument.id}-key`}
          value={value}
          label={`${keyLabel}: ${argumentName}`}
          dataClass={argument.dataClass}
          onChange={setKey}
          onKeyDown={handleArgInputTabNavigation}
          {...{ [ARG_INPUT_ATTR]: '' }}
        />
      )}
      <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
        )
      </span>
    </code>
  )
}

function ScalarValueInput({
  argument,
  onChange,
}: {
  argument: Extract<RuntimeArgument, { kind: 'string' | 'number' | 'boolean' | 'date' }>
  onChange: (argument: RuntimeArgument) => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const argumentName = argument.name ?? t('methodExecutor.argument')
  const typeLabel = argument.sourceType ?? argument.kind

  if (argument.kind === 'boolean') {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
        <Switch
          id={inputId}
          checked={argument.value}
          onCheckedChange={(checked) => onChange({ ...argument, value: checked })}
          aria-label={`${t('methodExecutor.boolean')}: ${argumentName}`}
        />
        <span className="font-mono text-xs tabular-nums" translate="no">
          {argument.value ? 'true' : 'false'}
        </span>
      </div>
    )
  }

  if (argument.kind === 'date') {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
        <DateArgumentPicker
          id={inputId}
          name={`method-argument-${argument.id}-value`}
          value={argument.value}
          label={`${t('methodExecutor.date')}: ${argumentName}`}
          onChange={(value) => onChange({ ...argument, value })}
          onKeyDown={handleArgInputTabNavigation}
          {...{ [ARG_INPUT_ATTR]: '' }}
        />
      </div>
    )
  }

  return (
    <TextOrNumberValueInput
      key={`${argument.id}-${argument.kind}`}
      argument={argument}
      typeLabel={typeLabel}
      argumentName={argumentName}
      inputId={inputId}
      onChange={onChange}
    />
  )
}

function TextOrNumberValueInput({
  argument,
  typeLabel,
  argumentName,
  inputId,
  onChange,
}: {
  argument: Extract<RuntimeArgument, { kind: 'string' | 'number' }>
  typeLabel: string
  argumentName: string
  inputId: string
  onChange: (argument: RuntimeArgument) => void
}) {
  const { t } = useTranslation()
  const label = argument.kind === 'number' ? t('methodExecutor.number') : t('methodExecutor.string')
  const argumentRef = useRef(argument)
  argumentRef.current = argument
  const { inputRef, flush, onInput, onKeyDown } = useUncontrolledCommit(argument.value, (value) => {
    onChange({ ...argumentRef.current, value })
  })

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 font-mono text-muted-foreground text-xs">{typeLabel}</span>
      <label htmlFor={inputId} className="sr-only">
        {`${label}: ${argumentName}`}
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        name={`method-argument-${argument.id}-value`}
        type={argument.kind === 'number' ? 'number' : 'text'}
        defaultValue={argument.value}
        onBlur={flush}
        onInput={onInput}
        onKeyDown={onKeyDown}
        data-param-name={argument.name}
        {...{ [ARG_INPUT_ATTR]: '' }}
        placeholder={argument.kind === 'string' ? t('methodExecutor.stringPlaceholder') : undefined}
        className="h-7 min-w-0 flex-1 px-2 font-mono text-xs md:text-xs"
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}

function kindLabel(kind: RuntimeArgument['kind'], t: (key: string) => string): string {
  switch (kind) {
    case 'string':
      return t('methodExecutor.string')
    case 'number':
      return t('methodExecutor.number')
    case 'boolean':
      return t('methodExecutor.boolean')
    case 'date':
      return t('methodExecutor.date')
    case 'custom':
      return t('methodExecutor.custom')
    case 'entity':
      return t('methodExecutor.entity')
    case 'entitysel':
      return t('methodExecutor.entitySelection')
  }
}

const ArgumentRow = memo(function ArgumentRow({
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
        'group relative rounded-md',
        'transition-colors duration-150',
        'hover:bg-muted/40',
        sortable.isDragging && 'z-10 bg-muted/60 shadow-sm'
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-1 py-1">
        <div className="flex items-center">
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

        <div className="min-w-0 overflow-x-auto">
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

        <div className="flex shrink-0 items-center gap-px opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
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

function CustomArgumentEditor({
  argument,
  onChange,
}: {
  argument: Extract<RuntimeArgument, { kind: 'custom' }>
  onChange: (argument: RuntimeArgument) => void
}) {
  const argumentRef = useRef(argument)
  argumentRef.current = argument
  const [draft, setDraft] = useState(argument.value)
  const draftRef = useRef(argument.value)
  draftRef.current = draft

  useEffect(() => {
    setDraft(argument.value)
    draftRef.current = argument.value
  }, [argument.value])

  const flush = useCallback(() => {
    const next = draftRef.current
    if (next === argumentRef.current.value) return
    onChange({ ...argumentRef.current, value: next })
  }, [onChange])

  useEffect(() => {
    pendingArgumentFlushes.add(flush)
    return () => {
      pendingArgumentFlushes.delete(flush)
      flush()
    }
  }, [flush])

  return (
    <div className="pr-1 pb-1 pl-7">
      <div className="overflow-hidden rounded-md bg-muted/30">
        <CodeEditor
          value={draft}
          onChange={(value) => {
            draftRef.current = value
            setDraft(value)
          }}
          height={72}
          showLineNumbers={false}
          onBlur={flush}
        />
      </div>
    </div>
  )
}

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
    <div className={cn('space-y-1.5 border-border/60 border-t pt-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="font-medium text-sm tracking-tight">{t('methodExecutor.arguments')}</h3>
          {argumentsList.length > 0 ? (
            <span className="rounded-sm bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground tabular-nums">
              {argumentsList.length}
            </span>
          ) : null}
          <p className="truncate text-muted-foreground text-xs">
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
            'border border-border/70 border-dashed bg-muted/20 px-2 py-1.5 text-left',
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
            <div className="rounded-lg bg-muted/25 p-0.5" data-runtime-arguments="">
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
