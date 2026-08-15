import type { QueryExplainAccess, QueryExplainJoinOn, QueryExplainPredicate } from './types'

export type ParsedExplainStep = {
  access: QueryExplainAccess
  raw: string
  title: string
  table?: string
  tableInstance?: string
  joinOn?: QueryExplainJoinOn
  predicate?: QueryExplainPredicate
  children: ParsedExplainStep[]
}

const STEP_STARTER_RE =
  /Join on Table\s*:|Indexed query on Table\s*:|Sequential scan on Table\s*:/gi
const JOIN_HEAD_RE = /^Join on Table\s*:\s*([^:]+)\s*:\s*/i
const INDEX_HEAD_RE = /^Indexed query on Table\s*:\s*([^:]+)\s*(?::\s*)?/i
const SEQUENTIAL_HEAD_RE =
  /^Sequential scan on Table\s*:\s*([^:{]+?)\s*(?=(?:\s+with filter\b|:|$))/i
const FILTER_BRACE_RE = /\s+with filter\s*\{/i
const FILTER_COLON_RE = /\s+with filter\s*:/i
const OPERATOR_RE = /^(AND|OR|NOT|EXCEPT)$/i
const BOOLEAN_OPS = ['OR', 'EXCEPT', 'AND'] as const
const PREDICATE_RE = /^(.+?)\s*(==|!=|<=|>=|#|=|>|<|LIKE|begin)\s*(.*?)$/i
const TABLE_INSTANCE_RE = /^(.*?)(?:\((\d+)\))$/
const JUNK_TOKEN_RE = /^[()[\]{},.;]+$/

function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function braceDepthAt(text: string, index: number): number {
  let depth = 0
  for (let i = 0; i < index; i++) {
    const ch = text[i]
    if (ch === '{') depth += 1
    else if (ch === '}') depth = Math.max(0, depth - 1)
  }
  return depth
}

function matchingBrace(text: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function isTableInstanceOpen(text: string, index: number): boolean {
  if (text[index] !== '(' || index === 0) return false
  if (!/[A-Za-z0-9_]/.test(text[index - 1] ?? '')) return false
  return /^\d+\)/.test(text.slice(index + 1))
}

function isTableInstanceClose(text: string, index: number): boolean {
  if (text[index] !== ')' || index === 0 || !/\d/.test(text[index - 1] ?? '')) return false
  let i = index - 1
  while (i >= 0 && /\d/.test(text[i] ?? '')) i -= 1
  return i >= 0 && text[i] === '(' && i > 0 && /[A-Za-z0-9_]/.test(text[i - 1] ?? '')
}

function matchingGroupingParen(text: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' && !isTableInstanceOpen(text, i)) depth += 1
    else if (ch === ')' && !isTableInstanceClose(text, i)) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function isTopLevelIndex(text: string, index: number): boolean {
  let braces = 0
  let parens = 0
  for (let i = 0; i < index; i++) {
    const ch = text[i]
    if (ch === '{') braces += 1
    else if (ch === '}') braces = Math.max(0, braces - 1)
    else if (ch === '(' && !isTableInstanceOpen(text, i)) parens += 1
    else if (ch === ')' && !isTableInstanceClose(text, i)) parens = Math.max(0, parens - 1)
  }
  return braces === 0 && parens === 0
}

function isFullyWrappedInParens(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed[0] !== '(') return false
  return matchingGroupingParen(trimmed, 0) === trimmed.length - 1
}

function unwrapParens(text: string): string {
  let current = text.trim()
  while (current && isFullyWrappedInParens(current)) {
    current = current.slice(1, -1).trim()
  }
  return current
}

function isJunkToken(value: string): boolean {
  return JUNK_TOKEN_RE.test(value.trim())
}

function splitOnOperator(text: string, operator: string): string[] | null {
  const re = new RegExp(`\\b${operator}\\b`, 'gi')
  const hits: Array<{ index: number; length: number }> = []
  let match = re.exec(text)
  while (match) {
    if (isTopLevelIndex(text, match.index)) {
      hits.push({ index: match.index, length: match[0].length })
    }
    match = re.exec(text)
  }
  if (hits.length === 0) return null
  const parts: string[] = []
  let last = 0
  for (const hit of hits) {
    parts.push(text.slice(last, hit.index))
    last = hit.index + hit.length
  }
  parts.push(text.slice(last))
  const operands = parts.map((part) => part.trim()).filter((part) => part && !isJunkToken(part))
  return operands.length > 1 ? operands : null
}

function splitTopLevelBoolean(
  text: string
): { operator: (typeof BOOLEAN_OPS)[number]; operands: string[] } | null {
  for (const operator of BOOLEAN_OPS) {
    const operands = splitOnOperator(text, operator)
    if (operands) return { operator, operands }
  }
  return null
}

function stripJoinChunkTail(chunk: string): string {
  let current = chunk.replace(/\s*\)\s*(And|Or|Except)\s*\(\s*$/i, '').trimEnd()
  while (current.endsWith(')') && !isTableInstanceClose(current, current.length - 1)) {
    current = current.slice(0, -1).trimEnd()
  }
  return current.trim()
}

function findDepth0Starts(text: string): number[] {
  const starts: number[] = []
  const re = new RegExp(STEP_STARTER_RE.source, 'gi')
  let match = re.exec(text)
  while (match) {
    if (braceDepthAt(text, match.index) === 0) starts.push(match.index)
    match = re.exec(text)
  }
  return starts
}

export function parseTableName(raw: string): { table: string; tableInstance?: string } {
  const trimmed = collapseWs(raw)
  const match = trimmed.match(TABLE_INSTANCE_RE)
  if (match?.[1] && match[2]) {
    return { table: collapseWs(match[1]), tableInstance: match[2] }
  }
  return { table: trimmed }
}

export function parsePredicate(raw: string): QueryExplainPredicate | null {
  const trimmed = collapseWs(raw)
  if (!trimmed) return null
  const match = trimmed.match(PREDICATE_RE)
  if (!match?.[1] || !match[2]) return null
  return {
    attribute: collapseWs(match[1]),
    operator: match[2],
    value: collapseWs(match[3] ?? ''),
  }
}

export function parseJoinOn(raw: string): QueryExplainJoinOn | null {
  const trimmed = collapseWs(raw)
  if (!trimmed || trimmed.includes('==')) return null
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return null
  const left = collapseWs(trimmed.slice(0, eq))
  const right = collapseWs(trimmed.slice(eq + 1))
  if (!left || !right) return null
  return { left, right }
}

function shortAttribute(attribute: string, table?: string): string {
  const match = attribute.match(/^(.+?)(?:\(\d+\))?\.([^.]+)$/)
  if (!match?.[1] || !match[2]) return attribute
  if (table && collapseWs(match[1]).toLowerCase() === table.toLowerCase()) return match[2]
  return `${collapseWs(match[1])}.${match[2]}`
}

function sameJoin(a: ParsedExplainStep, b: ParsedExplainStep): boolean {
  return (
    a.access === 'join' &&
    b.access === 'join' &&
    a.table === b.table &&
    a.tableInstance === b.tableInstance &&
    a.joinOn?.left === b.joinOn?.left &&
    a.joinOn?.right === b.joinOn?.right
  )
}

function collapseDuplicateFilterJoin(step: ParsedExplainStep): ParsedExplainStep {
  const first = step.children[0]
  if (!first || !sameJoin(step, first)) return step
  return { ...step, children: [...first.children, ...step.children.slice(1)] }
}

function takeFilterSuffix(rest: string): {
  before: string
  braceInner?: string
  colonPredicate?: string
} {
  const braceMatch = rest.match(FILTER_BRACE_RE)
  const colonMatch = rest.match(FILTER_COLON_RE)
  const braceAt = braceMatch?.index
  const colonAt = colonMatch?.index
  const useBrace = braceAt != null && (colonAt == null || braceAt <= colonAt) && braceMatch
  if (useBrace && braceAt != null) {
    const open = rest.indexOf('{', braceAt)
    const close = matchingBrace(rest, open)
    const inner = close >= 0 ? rest.slice(open + 1, close) : rest.slice(open + 1)
    return { before: rest.slice(0, braceAt), braceInner: inner }
  }
  if (colonAt != null && colonMatch) {
    return {
      before: rest.slice(0, colonAt),
      colonPredicate: rest.slice(colonAt + colonMatch[0].length),
    }
  }
  return { before: rest }
}

function parseJoinChunk(chunk: string): ParsedExplainStep {
  const head = chunk.match(JOIN_HEAD_RE)
  const tableRaw = head?.[1] ? collapseWs(head[1]) : ''
  const rest = head ? chunk.slice(head[0].length) : chunk
  const { before, braceInner, colonPredicate } = takeFilterSuffix(rest)
  const { table, tableInstance } = parseTableName(tableRaw)
  const joinOn = parseJoinOn(before)
  const predicate = colonPredicate ? parsePredicate(colonPredicate) : undefined
  const children = braceInner ? parseDescriptionForest(braceInner) : []
  return collapseDuplicateFilterJoin({
    access: 'join',
    raw: collapseWs(chunk),
    title: table || 'Join',
    table: table || undefined,
    tableInstance,
    joinOn: joinOn ?? undefined,
    predicate: predicate ?? undefined,
    children,
  })
}

function parseIndexChunk(chunk: string): ParsedExplainStep {
  const head = chunk.match(INDEX_HEAD_RE)
  const tableRaw = head?.[1] ? collapseWs(head[1]) : ''
  const rest = head ? chunk.slice(head[0].length) : chunk
  const { before, braceInner, colonPredicate } = takeFilterSuffix(rest)
  const { table, tableInstance } = parseTableName(tableRaw)
  const predicate =
    parsePredicate(before) ?? (colonPredicate ? parsePredicate(colonPredicate) : null)
  const children = braceInner ? parseDescriptionForest(braceInner) : []
  return {
    access: 'index',
    raw: collapseWs(chunk),
    title: table || 'Index',
    table: table || undefined,
    tableInstance,
    predicate: predicate ?? undefined,
    children,
  }
}

function parseSequentialChunk(chunk: string): ParsedExplainStep {
  const head = chunk.match(SEQUENTIAL_HEAD_RE)
  const tableRaw = head?.[1] ? collapseWs(head[1]) : ''
  const rest = head ? chunk.slice(head[0].length) : chunk
  const { before, braceInner, colonPredicate } = takeFilterSuffix(rest)
  const { table, tableInstance } = parseTableName(tableRaw || before)
  const predicate = colonPredicate ? parsePredicate(colonPredicate) : parsePredicate(before)
  const children = braceInner ? parseDescriptionForest(braceInner) : []
  return {
    access: 'sequential',
    raw: collapseWs(chunk),
    title: table || 'Scan',
    table: table || undefined,
    tableInstance,
    predicate: predicate ?? undefined,
    children,
  }
}

function parsePlainChunk(chunk: string): ParsedExplainStep {
  const raw = collapseWs(chunk)
  if (OPERATOR_RE.test(raw)) {
    return {
      access: 'operator',
      raw,
      title: raw.toUpperCase(),
      children: [],
    }
  }
  const predicate = parsePredicate(raw)
  if (predicate) {
    const dotted = predicate.attribute.match(/^(.+?)(?:\((\d+)\))?\.([^.]+)$/)
    const table = dotted?.[1] ? collapseWs(dotted[1]) : undefined
    const tableInstance = dotted?.[2]
    return {
      access: 'filter',
      raw,
      title: shortAttribute(predicate.attribute, table),
      table,
      tableInstance,
      predicate,
      children: [],
    }
  }
  return {
    access: 'unknown',
    raw,
    title: raw || 'Step',
    children: [],
  }
}

function parseChunk(chunk: string): ParsedExplainStep | null {
  const trimmed = chunk.trim()
  if (!trimmed) return null
  if (/^Join on Table\s*:/i.test(trimmed)) return parseJoinChunk(trimmed)
  if (/^Indexed query on Table\s*:/i.test(trimmed)) return parseIndexChunk(trimmed)
  if (/^Sequential scan on Table\s*:/i.test(trimmed)) return parseSequentialChunk(trimmed)
  return parsePlainChunk(trimmed)
}

/** Split a 4D plan/path description (including concatenated joins) into a step forest. */
export function parseDescriptionForest(text: string): ParsedExplainStep[] {
  const source = unwrapParens(text)
  if (!source) return []

  const booleanSplit = splitTopLevelBoolean(source)
  if (booleanSplit) {
    const children = booleanSplit.operands.flatMap((operand) => parseDescriptionForest(operand))
    if (children.length === 1) return children
    if (children.length > 1) {
      return [
        {
          access: 'operator',
          raw: collapseWs(source),
          title: booleanSplit.operator,
          children,
        },
      ]
    }
  }

  const starts = findDepth0Starts(source)
  if (starts.length === 0) {
    const plain = parsePlainChunk(source)
    return plain ? [plain] : []
  }

  const steps: ParsedExplainStep[] = []
  const prefix = source.slice(0, starts[0]).trim()
  if (prefix && !isJunkToken(prefix)) {
    const leading = parsePlainChunk(prefix)
    if (leading) steps.push(leading)
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]
    if (start == null) continue
    const end = starts[i + 1] ?? source.length
    const parsed = parseChunk(stripJoinChunkTail(source.slice(start, end)))
    if (parsed) steps.push(parsed)
  }
  return steps
}

export function formatExplainIdentifier(value: string): string {
  return collapseWs(value.replace(/\(\d+\)/g, ''))
}

export function displayExplainAttribute(attribute: string, table?: string): string {
  return shortAttribute(formatExplainIdentifier(attribute), table)
}
