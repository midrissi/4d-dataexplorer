import { Button, cn } from '@4d/ui'
import {
  Braces,
  Brackets,
  Calendar,
  Check,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleDot,
  Copy,
  FunctionSquare,
  Hash,
  Link2,
  Quote,
  ToggleLeft,
  TriangleAlert,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import {
  BinaryObjectViewer,
  isPrivateBinaryObject,
  PRIVATE_BINARY_OBJECT_KEY,
} from '~/components/BinaryObjectViewer'
import { DecodedBinaryPanel } from '~/components/DecodedBinary/DecodedBinaryPanel'
import { isDecodedBinaryObject } from '~/components/DecodedBinary/types'
import { useTranslation } from '~/i18n'

type ObjectTreeProps = {
  value: unknown
  label?: string
  depth?: number
  ancestors?: ReadonlySet<object>
  defaultOpen?: boolean
}

type ValueKind =
  | 'null'
  | 'undefined'
  | 'string'
  | 'number'
  | 'boolean'
  | 'symbol'
  | 'function'
  | 'array'
  | 'object'
  | 'date'
  | 'error'
  | 'map'
  | 'set'
  | 'circular'

function kindOf(value: unknown, circular = false): ValueKind {
  if (circular) return 'circular'
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number' || typeof value === 'bigint') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'symbol') return 'symbol'
  if (typeof value === 'function') return 'function'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'
  if (value instanceof Error) return 'error'
  if (value instanceof Map) return 'map'
  if (value instanceof Set) return 'set'
  return 'object'
}

function KindIcon({ kind }: { kind: ValueKind }) {
  const className = 'h-3 w-3 shrink-0'
  switch (kind) {
    case 'array':
      return <Brackets className={cn(className, 'text-amber-500')} />
    case 'object':
    case 'map':
      return <Braces className={cn(className, 'text-sky-500')} />
    case 'set':
      return <CircleDot className={cn(className, 'text-sky-500')} />
    case 'string':
      return <Quote className={cn(className, 'text-emerald-600')} />
    case 'number':
      return <Hash className={cn(className, 'text-blue-500')} />
    case 'boolean':
      return <ToggleLeft className={cn(className, 'text-violet-500')} />
    case 'date':
      return <Calendar className={cn(className, 'text-cyan-600')} />
    case 'error':
      return <TriangleAlert className={cn(className, 'text-destructive')} />
    case 'function':
      return <FunctionSquare className={cn(className, 'text-sky-600')} />
    case 'circular':
      return <Link2 className={cn(className, 'text-muted-foreground')} />
    default:
      return <CircleDot className={cn(className, 'text-muted-foreground')} />
  }
}

function primitiveValue(value: unknown): { text: string; className: string } {
  if (value === null) return { text: 'null', className: 'text-rose-500' }
  if (value === undefined) return { text: 'undefined', className: 'text-muted-foreground/80' }
  if (typeof value === 'string')
    return { text: JSON.stringify(value), className: 'text-emerald-600 dark:text-emerald-400' }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return { text: String(value), className: 'text-blue-500 dark:text-blue-400' }
  }
  if (typeof value === 'boolean')
    return { text: String(value), className: 'text-violet-500 dark:text-violet-400' }
  if (typeof value === 'symbol') return { text: String(value), className: 'text-amber-600' }
  if (typeof value === 'function') {
    return {
      text: `[Function${value.name ? `: ${value.name}` : ''}]`,
      className: 'text-sky-600',
    }
  }
  return { text: String(value), className: 'text-foreground' }
}

function objectSummary(value: object): { title: string; preview?: string; count?: number } {
  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 3)
      .map((item) => {
        if (item === null) return 'null'
        if (typeof item === 'string')
          return JSON.stringify(item.length > 24 ? `${item.slice(0, 24)}…` : item)
        if (typeof item === 'object') return Array.isArray(item) ? `Array(${item.length})` : '{…}'
        return String(item)
      })
      .join(', ')
    return {
      title: `Array(${value.length})`,
      preview: value.length > 0 ? `[${preview}${value.length > 3 ? ', …' : ''}]` : '[]',
      count: value.length,
    }
  }
  if (value instanceof Date) return { title: value.toISOString() }
  if (value instanceof Error) return { title: `${value.name}: ${value.message}` }
  if (value instanceof Map) return { title: `Map(${value.size})`, count: value.size }
  if (value instanceof Set) return { title: `Set(${value.size})`, count: value.size }

  const entries = Object.entries(value)
  const preview = entries
    .slice(0, 3)
    .map(([key]) => key)
    .join(', ')
  const named =
    value.constructor?.name && value.constructor.name !== 'Object'
      ? value.constructor.name
      : 'Object'
  return {
    title: named,
    preview: entries.length > 0 ? `{ ${preview}${entries.length > 3 ? ', …' : ''} }` : '{}',
    count: entries.length,
  }
}

function entriesFor(value: object): Array<[string, unknown]> {
  try {
    if (value instanceof Error) {
      return [
        ['name', value.name],
        ['message', value.message],
        ['stack', value.stack],
        ...Object.entries(value),
      ]
    }
    if (value instanceof Map) {
      return [...value.entries()].map(([key, item], index) => [`${index}: ${String(key)}`, item])
    }
    if (value instanceof Set) {
      return [...value.values()].map((item, index) => [String(index), item])
    }
    return Object.entries(value)
  } catch (error) {
    return [['[[Inspection error]]', error instanceof Error ? error.message : String(error)]]
  }
}

function copyText(value: unknown): string {
  try {
    return typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? String(value))
  } catch {
    return String(value)
  }
}

function CopyButton({ value }: { value: unknown }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
      onClick={(event) => {
        event.stopPropagation()
        void navigator.clipboard.writeText(copyText(value)).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
      aria-label={copied ? t('console.copied') : t('console.copyValue')}
      title={copied ? t('console.copied') : t('console.copyValue')}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function TreeRow({
  expandable,
  open,
  onToggle,
  kind,
  label,
  children,
  value,
}: {
  expandable?: boolean
  open?: boolean
  onToggle?: () => void
  kind: ValueKind
  label?: string
  children: ReactNode
  value: unknown
}) {
  return (
    <div className="group/row inline-flex max-w-full items-center gap-0.5 rounded-sm py-px hover:bg-muted/40">
      {expandable && onToggle ? (
        <button
          type="button"
          className="inline-flex min-w-0 max-w-full flex-1 items-center gap-0.5 text-left"
          onClick={onToggle}
          aria-expanded={open}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-90'
            )}
          />
          <KindIcon kind={kind} />
          {label !== undefined ? (
            <span className="mr-0.5 shrink-0 font-medium text-sky-700 dark:text-sky-300">
              {label}
            </span>
          ) : null}
          {label !== undefined ? <span className="mr-0.5 text-muted-foreground/60">:</span> : null}
          <span className="min-w-0 truncate">{children}</span>
        </button>
      ) : (
        <span className="inline-flex min-w-0 max-w-full flex-1 items-center gap-0.5">
          <span className="inline-block w-3 shrink-0" />
          <KindIcon kind={kind} />
          {label !== undefined ? (
            <span className="mr-0.5 shrink-0 font-medium text-sky-700 dark:text-sky-300">
              {label}
            </span>
          ) : null}
          {label !== undefined ? <span className="mr-0.5 text-muted-foreground/60">:</span> : null}
          <span className="min-w-0 truncate">{children}</span>
        </span>
      )}
      <CopyButton value={value} />
    </div>
  )
}

export function ConsoleValue({ value }: { value: unknown }) {
  if (value !== null && typeof value === 'object') {
    return <ObjectTree value={value} />
  }
  const display = primitiveValue(value)
  return (
    <TreeRow kind={kindOf(value)} value={value}>
      <span className={display.className}>{display.text}</span>
    </TreeRow>
  )
}

export function ObjectTree({
  value,
  label,
  depth = 0,
  ancestors = new Set(),
  defaultOpen = false,
}: ObjectTreeProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)

  if (value === null || typeof value !== 'object') {
    const display = primitiveValue(value)
    return (
      <div className={cn(depth > 0 && 'ml-2 border-border/40 border-l pl-1.5')}>
        <TreeRow kind={kindOf(value)} label={label} value={value}>
          <span className={display.className}>{display.text}</span>
        </TreeRow>
      </div>
    )
  }

  // 4D private binary object — same dedicated viewer as EntityViewer tree fields.
  if (isPrivateBinaryObject(value)) {
    return (
      <div className={cn('space-y-1 py-0.5', depth > 0 && 'ml-2 border-border/40 border-l pl-1.5')}>
        {label !== undefined ? (
          <div className="group/row inline-flex max-w-full items-center gap-0.5 rounded-sm py-px">
            <span className="inline-block w-3 shrink-0" />
            <KindIcon kind="object" />
            <span className="mr-0.5 shrink-0 font-medium text-sky-700 dark:text-sky-300">
              {label}
            </span>
            <CopyButton value={value} />
          </div>
        ) : null}
        <BinaryObjectViewer
          base64={value[PRIVATE_BINARY_OBJECT_KEY]}
          name={label ?? PRIVATE_BINARY_OBJECT_KEY}
          defaultExpanded={depth === 0}
        />
      </div>
    )
  }

  // Already-decoded 4D class payload nested inside a JSON object tree.
  if (isDecodedBinaryObject(value)) {
    return (
      <div className={cn('space-y-1 py-0.5', depth > 0 && 'ml-2 border-border/40 border-l pl-1.5')}>
        {label !== undefined ? (
          <div className="group/row inline-flex max-w-full items-center gap-0.5 rounded-sm py-px">
            <span className="inline-block w-3 shrink-0" />
            <KindIcon kind="object" />
            <span className="mr-0.5 shrink-0 font-medium text-sky-700 dark:text-sky-300">
              {label}
            </span>
            <span className="rounded bg-muted/80 px-1 py-px font-mono text-[10px] text-muted-foreground">
              {value.__class}
            </span>
            <CopyButton value={value} />
          </div>
        ) : null}
        <DecodedBinaryPanel decoded={value} />
      </div>
    )
  }

  if (ancestors.has(value)) {
    return (
      <div className={cn(depth > 0 && 'ml-2 border-border/40 border-l pl-1.5')}>
        <TreeRow kind="circular" label={label} value="[Circular]">
          <span className="text-muted-foreground italic">[Circular]</span>
        </TreeRow>
      </div>
    )
  }

  const entries = entriesFor(value)
  const childAncestors = new Set(ancestors)
  childAncestors.add(value)
  const summary = objectSummary(value)
  const kind = kindOf(value)

  return (
    <div className={cn(depth > 0 && 'ml-2 border-border/40 border-l pl-1.5')}>
      <TreeRow
        expandable
        open={open}
        onToggle={() => setOpen((current) => !current)}
        kind={kind}
        label={label}
        value={value}
      >
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="font-medium text-muted-foreground">{summary.title}</span>
          {summary.count !== undefined ? (
            <span className="rounded bg-muted/80 px-1 py-px font-sans text-[10px] text-muted-foreground tabular-nums">
              {summary.count}
            </span>
          ) : null}
          {!open && summary.preview ? (
            <span className="truncate text-muted-foreground/70">{summary.preview}</span>
          ) : null}
        </span>
      </TreeRow>

      {open ? (
        <div className="fade-in-0 slide-in-from-top-1 animate-in duration-150">
          {entries.length > 0 ? (
            entries.map(([key, item]) => (
              <ObjectTree
                key={key}
                value={item}
                label={key}
                depth={depth + 1}
                ancestors={childAncestors}
                defaultOpen={defaultOpen}
              />
            ))
          ) : (
            <div className="ml-3 py-px text-muted-foreground/70 italic">
              {t('console.emptyObject')}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

type JsonTreePreviewProps = {
  value: unknown
  label?: string
  className?: string
  /** Extra classes for the scrollable tree area (e.g. max-height in forms). */
  contentClassName?: string
}

/** Console-style expandable JSON tree with expand/collapse toolbar. */
export function JsonTreePreview({
  value,
  label,
  className,
  contentClassName,
}: JsonTreePreviewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [epoch, setEpoch] = useState(0)

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-muted/10', className)}>
      <div className="flex shrink-0 items-center gap-0.5 border-border/50 border-b px-1.5 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
          onClick={() => {
            setExpanded(true)
            setEpoch((n) => n + 1)
          }}
        >
          <ChevronsUpDown className="h-3 w-3" />
          {t('console.expandAll')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground"
          onClick={() => {
            setExpanded(false)
            setEpoch((n) => n + 1)
          }}
        >
          <ChevronsDownUp className="h-3 w-3" />
          {t('console.collapseAll')}
        </Button>
      </div>
      <div
        className={cn('min-h-0 flex-1 overflow-auto px-2 py-1 font-mono text-xs', contentClassName)}
      >
        <ObjectTree key={epoch} label={label} value={value} defaultOpen={expanded} />
      </div>
    </div>
  )
}
