import { cn } from '@4d/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type JSX, useState } from 'react'

/**
 * Recursively renders objects and arrays as a proper tree view with
 * consistent fixed indentation, vertical guide lines, and syntax highlighting.
 *
 * Features:
 * - Color-coded primitives (strings, numbers, booleans, null/undefined)
 * - Fixed-step indentation per depth with vertical connector lines
 * - Key/value pairs on a single row when the value is primitive
 * - Truncation indicators ("… +N more")
 * - Max depth limit (default 5) to prevent performance issues
 * - 60-char string truncation for long text
 */
export function ObjectTreeView({
  value,
  depth = 0,
  maxDepth = 5,
}: {
  value: unknown
  depth?: number
  maxDepth?: number
}): JSX.Element {
  return <TreeNode value={value} depth={depth} maxDepth={maxDepth} />
}

function isContainer(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function PrimitiveValue({ value }: { value: unknown }): JSX.Element {
  if (value === null) return <span className="text-sky-500">null</span>
  if (value === undefined) return <span className="text-sky-500">undefined</span>
  if (typeof value === 'boolean')
    return <span className="font-semibold text-amber-500">{String(value)}</span>
  if (typeof value === 'number') return <span className="text-orange-500">{value}</span>
  if (typeof value === 'string') {
    const truncated = value.length > 60 ? `${value.slice(0, 60)}…` : value
    return <span className="text-emerald-500">&quot;{truncated}&quot;</span>
  }
  return <span className="text-foreground">{String(value)}</span>
}

function TreeNode({
  label,
  value,
  depth,
  maxDepth,
}: {
  label?: React.ReactNode
  value: unknown
  depth: number
  maxDepth: number
}): JSX.Element {
  // Leaf: primitive value (optionally prefixed by its key/index label)
  if (!isContainer(value)) {
    return (
      <div className="flex items-baseline gap-1 py-px font-mono text-xs leading-relaxed">
        {label}
        <PrimitiveValue value={value} />
      </div>
    )
  }

  if (depth > maxDepth) {
    return (
      <div className="flex items-baseline gap-1 py-px font-mono text-xs leading-relaxed">
        {label}
        <span className="text-muted-foreground italic">…</span>
      </div>
    )
  }

  return <ContainerNode label={label} value={value} depth={depth} maxDepth={maxDepth} />
}

function ContainerNode({
  label,
  value,
  depth,
  maxDepth,
}: {
  label?: React.ReactNode
  value: object
  depth: number
  maxDepth: number
}): JSX.Element {
  const isArray = Array.isArray(value)
  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value)
  const visible = entries.slice(0, 5)
  const hidden = entries.length - visible.length

  // Collapsed by default; only the root node (depth 0) starts expanded.
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = entries.length > 0

  return (
    <div className="font-mono text-xs leading-relaxed">
      {/* Node header: clickable chevron + label + type/count summary */}
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((e) => !e)}
        className={cn(
          'flex w-full items-center gap-1 py-px text-left',
          hasChildren ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
        )}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="h-3 w-3 flex-shrink-0" />
        )}
        {label}
        <span className={isArray ? 'font-semibold text-sky-600' : 'font-semibold text-violet-600'}>
          {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
        </span>
      </button>

      {/* Children indented one fixed step with a vertical guide line */}
      {hasChildren && expanded && (
        <div className="ml-1 border-border/60 border-l pl-2">
          {visible.map(([k, v]) => (
            <TreeNode
              key={k}
              label={
                <span
                  className={isArray ? 'text-muted-foreground' : 'font-medium text-fuchsia-500'}
                >
                  {k}:
                </span>
              }
              value={v}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ))}
          {hidden > 0 && <div className="py-px text-amber-500 italic">… +{hidden} more</div>}
        </div>
      )}
    </div>
  )
}
