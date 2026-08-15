import { parseDescriptionForest, type ParsedExplainStep } from './parse-description'
import type {
  QueryExplainAccess,
  QueryExplainKind,
  QueryExplainNode,
  QueryExplainSummary,
} from './types'

const OPERATOR_KEY_RE = /^(and|or|not|except)$/i
const INDEX_RE = /\bindex(?:ed)?\b/i
const SEQUENTIAL_RE = /\bsequential\b/i
const JOIN_RE = /\bjoin on table\b/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function detectQueryExplainAccess(label: string): QueryExplainAccess {
  const trimmed = label.trim()
  if (!trimmed) return 'unknown'
  if (OPERATOR_KEY_RE.test(trimmed) || /^(and|or|not|except)$/i.test(trimmed)) return 'operator'
  if (JOIN_RE.test(trimmed)) return 'join'
  if (INDEX_RE.test(trimmed)) return 'index'
  if (SEQUENTIAL_RE.test(trimmed)) return 'sequential'
  const forest = parseDescriptionForest(trimmed)
  if (forest.length === 1 && forest[0]) return forest[0].access
  return 'unknown'
}

function operatorLabel(key: string): string {
  const upper = key.toUpperCase()
  if (upper === 'AND' || upper === 'OR' || upper === 'NOT' || upper === 'EXCEPT') return upper
  return key
}

function readTime(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function readRecords(value: unknown): number | undefined {
  return readTime(value)
}

let nextId = 0
function allocId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

function parsedToNode(
  kind: QueryExplainKind,
  step: ParsedExplainStep,
  extra?: Partial<QueryExplainNode>
): QueryExplainNode {
  return {
    id: extra?.id ?? allocId(kind),
    kind,
    access: extra?.access ?? step.access,
    label: extra?.label ?? step.raw,
    title: extra?.title ?? step.title,
    table: extra?.table ?? step.table,
    tableInstance: extra?.tableInstance ?? step.tableInstance,
    joinOn: extra?.joinOn ?? step.joinOn,
    predicate: extra?.predicate ?? step.predicate,
    timeMs: extra?.timeMs,
    recordsFound: extra?.recordsFound,
    children:
      extra?.children ??
      step.children.map((child) => parsedToNode(kind, child)),
  }
}

function wrap(
  kind: QueryExplainKind,
  label: string,
  extra?: Partial<QueryExplainNode>
): QueryExplainNode {
  const trimmed = label.trim() || (kind === 'plan' ? 'Plan' : 'Path')
  const existingChildren = extra?.children
  const forest = parseDescriptionForest(trimmed)
  const parsed = forest.length === 1 ? forest[0] : null

  if (parsed && (!existingChildren || existingChildren.length === 0)) {
    return parsedToNode(kind, parsed, {
      ...extra,
      label: trimmed,
      children: parsed.children.length > 0 ? undefined : existingChildren,
    })
  }

  if (parsed) {
    return parsedToNode(kind, parsed, {
      ...extra,
      label: trimmed,
      children: existingChildren,
    })
  }

  if (forest.length > 1 && (!existingChildren || existingChildren.length === 0)) {
    return {
      id: extra?.id ?? allocId(kind),
      kind,
      access: extra?.access ?? 'operator',
      label: trimmed,
      title: extra?.title ?? (kind === 'plan' ? 'Plan' : 'Path'),
      timeMs: extra?.timeMs,
      recordsFound: extra?.recordsFound,
      children: forest.map((step) => parsedToNode(kind, step)),
    }
  }

  const access = extra?.access ?? detectQueryExplainAccess(trimmed)
  return {
    id: extra?.id ?? allocId(kind),
    kind,
    access,
    label: trimmed,
    title: extra?.title ?? trimmed,
    timeMs: extra?.timeMs,
    recordsFound: extra?.recordsFound,
    children: existingChildren ?? [],
  }
}

function fromUnknownArray(
  kind: QueryExplainKind,
  items: unknown[],
  parentLabel: string
): QueryExplainNode[] {
  const children: QueryExplainNode[] = []
  for (const item of items) {
    const node = fromUnknown(kind, item)
    if (node) children.push(node)
  }
  if (children.length === 1 && !parentLabel) return children
  return children
}

function fromUnknown(kind: QueryExplainKind, value: unknown): QueryExplainNode | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return wrap(kind, String(value))
  }
  if (Array.isArray(value)) {
    const children = fromUnknownArray(kind, value, '')
    if (children.length === 0) return null
    if (children.length === 1) return children[0] ?? null
    return wrap(kind, 'AND', { access: 'operator', children })
  }
  if (!isRecord(value)) return null

  const operatorEntry = Object.entries(value).find(
    ([key, child]) => OPERATOR_KEY_RE.test(key) && Array.isArray(child)
  )
  if (operatorEntry) {
    const [key, child] = operatorEntry
    const children = fromUnknownArray(kind, child as unknown[], key)
    return wrap(kind, operatorLabel(key), { access: 'operator', children })
  }

  const itemLabel = typeof value.item === 'string' ? value.item : ''
  const description = typeof value.description === 'string' ? value.description : ''
  const label = description || itemLabel

  const subquery = Array.isArray(value.subquery) ? value.subquery : null
  const steps = Array.isArray(value.steps) ? value.steps : null
  const nestedChildren: QueryExplainNode[] = []
  if (subquery) nestedChildren.push(...fromUnknownArray(kind, subquery, label))
  if (steps) nestedChildren.push(...fromUnknownArray(kind, steps, label))

  if (!label && nestedChildren.length === 1) return nestedChildren[0] ?? null
  if (!label && nestedChildren.length > 1) {
    return wrap(kind, kind === 'path' ? 'Path' : 'Plan', { children: nestedChildren })
  }
  if (!label && nestedChildren.length === 0) return null

  return wrap(kind, label, {
    timeMs: readTime(value.time),
    recordsFound: readRecords(value.recordsfounds ?? value.recordsFound),
    children: nestedChildren,
  })
}

export function normalizeQueryPlan(plan: unknown): QueryExplainNode | null {
  nextId = 0
  return fromUnknown('plan', plan)
}

export function normalizeQueryPath(path: unknown): QueryExplainNode | null {
  nextId = 0
  return fromUnknown('path', path)
}

function walk(node: QueryExplainNode, visit: (n: QueryExplainNode) => void): void {
  visit(node)
  for (const child of node.children) walk(child, visit)
}

export function summarizeQueryExplain(root: QueryExplainNode | null): QueryExplainSummary {
  if (!root) {
    return {
      timeMs: null,
      recordsFound: null,
      indexCount: 0,
      sequentialCount: 0,
      joinCount: 0,
      stepCount: 0,
    }
  }

  let indexCount = 0
  let sequentialCount = 0
  let joinCount = 0
  let stepCount = 0
  let maxTime = root.timeMs
  walk(root, (node) => {
    if (node.access === 'index') indexCount += 1
    else if (node.access === 'sequential') sequentialCount += 1
    else if (node.access === 'join') joinCount += 1
    if (node.access !== 'operator') stepCount += 1
    if (node.timeMs != null && (maxTime == null || node.timeMs > maxTime)) maxTime = node.timeMs
  })

  return {
    timeMs: root.timeMs ?? maxTime ?? null,
    recordsFound: root.recordsFound ?? null,
    indexCount,
    sequentialCount,
    joinCount,
    stepCount,
  }
}

export function maxQueryExplainTime(root: QueryExplainNode | null): number {
  if (!root) return 0
  let max = 0
  walk(root, (node) => {
    if (node.timeMs != null && node.timeMs > max) max = node.timeMs
  })
  return max
}
