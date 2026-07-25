import type { AttributeType, DataClassAttribute } from '@4d/rest'
import { tokenize } from '../lexer/lexer.ts'
import {
  getAttribute,
  getAttributes,
  getDataClass,
  getRelatedDataclassName,
} from '../schema/catalog-index.ts'
import { categoriseType } from '../semantic/type-resolver.ts'
import type { CompletionItem } from '../types/language.ts'
import { CompletionItemKind } from '../types/language.ts'
import type { CatalogIndex } from '../types/service.ts'
import type { Token } from '../types/tokens.ts'
import { TokenKind } from '../types/tokens.ts'

// ---------------------------------------------------------------------------
// Completion cursor context
// ---------------------------------------------------------------------------

type CompletionContext =
  | { type: 'attribute'; dataclassName: string; prefix: string }
  | { type: 'relatedAttribute'; dataclassName: string; prefix: string }
  | { type: 'comparatorOrLogical' }
  | { type: 'value'; attrType: string | null }
  | { type: 'orderByAttribute'; dataclassName: string }
  | { type: 'orderByDirection' }
  | { type: 'logical' }
  | { type: 'unknown' }

// ---------------------------------------------------------------------------
// Completion keywords
// ---------------------------------------------------------------------------

const LOGICAL_KEYWORDS: CompletionItem[] = [
  { label: 'AND', kind: CompletionItemKind.Keyword, insertText: 'AND ', sortOrder: 1 },
  { label: 'OR', kind: CompletionItemKind.Keyword, insertText: 'OR ', sortOrder: 2 },
]

const NOT_KEYWORD: CompletionItem = {
  label: 'NOT',
  kind: CompletionItemKind.Keyword,
  detail: 'Negate an expression',
  insertText: 'NOT($1)',
  isSnippet: true,
  sortOrder: 20,
}

const DIRECTION_KEYWORDS: CompletionItem[] = [
  { label: 'ASC', kind: CompletionItemKind.Keyword, insertText: 'ASC', sortOrder: 1 },
  { label: 'DESC', kind: CompletionItemKind.Keyword, insertText: 'DESC', sortOrder: 2 },
]

// ---------------------------------------------------------------------------
// Helper: attribute → completion item
// ---------------------------------------------------------------------------

function attrToCompletion(attr: DataClassAttribute, dataclassName: string): CompletionItem {
  const isRelation = attr.kind === 'relatedEntity' || attr.kind === 'relatedEntities'
  const kind = isRelation ? CompletionItemKind.Relation : CompletionItemKind.Field
  const detail = isRelation ? `${attr.kind} → ${attr.type}` : attr.type
  const docs: string[] = []
  if (attr.indexed) docs.push('indexed')
  if (attr.unique) docs.push('unique')
  if (attr.readOnly) docs.push('readOnly')
  if (attr.identifying) docs.push('primaryKey')

  return {
    label: attr.name,
    kind,
    detail: `(${dataclassName}) ${detail}`,
    documentation: docs.length > 0 ? docs.join(' · ') : undefined,
    insertText: isRelation ? `${attr.name}.` : attr.name,
    // Fields after snippets (0–6); relations after fields.
    sortOrder: isRelation ? 40 : 30,
  }
}

function nextPlaceholderIndex(query: string): number {
  let max = 0
  for (const match of query.matchAll(/:(\d+)\b/g)) {
    const n = Number.parseInt(match[1] ?? '0', 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

function placeholderItem(index: number, sortOrder = 0): CompletionItem {
  return {
    label: `:${index}`,
    kind: CompletionItemKind.Value,
    detail: 'Indexed placeholder',
    documentation: 'Bound a parameter value below the filter editor',
    insertText: `:${index}`,
    sortOrder,
  }
}

function nullItem(sortOrder: number): CompletionItem {
  return {
    label: 'null',
    kind: CompletionItemKind.Value,
    insertText: 'null',
    sortOrder,
  }
}

/** Type-aware RHS suggestions after a comparator. */
function valueCompletions(attrType: string | null, query: string): CompletionItem[] {
  const ph = nextPlaceholderIndex(query)
  const category = attrType ? categoriseType(attrType as AttributeType) : 'other'

  switch (category) {
    case 'bool':
      return [
        { label: 'true', kind: CompletionItemKind.Value, insertText: 'true', sortOrder: 0 },
        { label: 'false', kind: CompletionItemKind.Value, insertText: 'false', sortOrder: 1 },
        nullItem(2),
        placeholderItem(ph, 3),
      ]
    case 'number':
      return [
        placeholderItem(ph, 0),
        {
          label: '0',
          kind: CompletionItemKind.Snippet,
          detail: 'Number literal',
          insertText: `\${1:0}`,
          isSnippet: true,
          sortOrder: 1,
        },
        nullItem(2),
      ]
    case 'string':
      return [
        placeholderItem(ph, 0),
        {
          label: "''",
          kind: CompletionItemKind.Snippet,
          detail: 'String literal',
          insertText: `'\${1}'`,
          isSnippet: true,
          sortOrder: 1,
        },
        {
          label: "'…@'",
          kind: CompletionItemKind.Snippet,
          detail: 'Starts with (wildcard)',
          insertText: `'\${1}@'`,
          isSnippet: true,
          sortOrder: 2,
        },
        nullItem(3),
      ]
    case 'date':
      return [
        placeholderItem(ph, 0),
        {
          label: '"YYYY-MM-DD"',
          kind: CompletionItemKind.Snippet,
          detail: 'Date literal',
          insertText: `"\${1:2024-01-01}"`,
          isSnippet: true,
          sortOrder: 1,
        },
        nullItem(2),
      ]
    case 'object':
      return [placeholderItem(ph, 0), nullItem(1)]
    default:
      return [placeholderItem(ph, 0), nullItem(1)]
  }
}

/** Starter / pattern snippets when completing attributes (sorted first). */
function attributeSnippets(prefix: string): CompletionItem[] {
  if (prefix) return []
  return [
    {
      label: 'attribute = :n',
      kind: CompletionItemKind.Snippet,
      detail: 'Equality with placeholder',
      documentation: 'Insert a comparison bound to a filter parameter',
      insertText: `\${1:attribute} = :\${2:1}`,
      isSnippet: true,
      sortOrder: 0,
    },
    {
      label: "attribute = '…'",
      kind: CompletionItemKind.Snippet,
      detail: 'Equality with string literal',
      insertText: `\${1:attribute} = '\${2:value}'`,
      isSnippet: true,
      sortOrder: 1,
    },
    {
      label: 'attribute IN :n',
      kind: CompletionItemKind.Snippet,
      detail: 'IN with placeholder collection',
      documentation: 'Pass an array as the matching filter parameter',
      insertText: `\${1:attribute} IN :\${2:1}`,
      isSnippet: true,
      sortOrder: 2,
    },
    {
      label: 'attribute > :n AND < :n',
      kind: CompletionItemKind.Snippet,
      detail: 'Numeric / date range',
      insertText: `\${1:attribute} >= :\${2:1} AND \${1:attribute} <= :\${3:2}`,
      isSnippet: true,
      sortOrder: 3,
    },
    {
      label: '… AND …',
      kind: CompletionItemKind.Snippet,
      detail: 'Two conditions',
      insertText: `\${1:attribute} = :\${2:1} AND \${3:attribute} = :\${4:2}`,
      isSnippet: true,
      sortOrder: 4,
    },
    {
      label: '… order by …',
      kind: CompletionItemKind.Snippet,
      detail: 'Filter + sort',
      insertText: `\${1:attribute} = :\${2:1} order by \${3:attribute} \${4|ASC,DESC|}`,
      isSnippet: true,
      sortOrder: 5,
    },
    {
      label: 'NOT(…)',
      kind: CompletionItemKind.Snippet,
      detail: 'Negated condition',
      insertText: `NOT(\${1:attribute} = :\${2:1})`,
      isSnippet: true,
      sortOrder: 6,
    },
  ]
}

// ---------------------------------------------------------------------------
// Determine cursor context
// ---------------------------------------------------------------------------

function inferContext(
  tokens: Token[],
  offset: number,
  dataclassName: string,
  index: CatalogIndex
): CompletionContext {
  // Consider only real tokens before the cursor. Keeping EOF here causes
  // end-of-query completions to incorrectly fall back to attribute context.
  const before = tokens.filter((t) => t.kind !== TokenKind.EOF && t.end <= offset)
  const last = before[before.length - 1]
  const prev = before[before.length - 2]

  if (!last) {
    return { type: 'attribute', dataclassName, prefix: '' }
  }

  // Inside ORDER BY
  const inOrderBy = isInsideOrderBy(tokens, offset)
  if (inOrderBy) {
    if (last.kind === TokenKind.Asc || last.kind === TokenKind.Desc) {
      return { type: 'orderByDirection' }
    }
    if (last.kind === TokenKind.Comma) {
      return { type: 'orderByAttribute', dataclassName }
    }
    if (last.kind === TokenKind.Identifier) {
      if (last.text.toLowerCase() === 'order' || last.text.toLowerCase() === 'by') {
        return { type: 'orderByAttribute', dataclassName }
      }
      return { type: 'orderByDirection' }
    }
    return { type: 'orderByAttribute', dataclassName }
  }

  // After a dot — attribute traversal
  if (last.kind === TokenKind.Dot) {
    // Walk back to find the full attribute path up to this dot
    const relatedDcName = resolvePartialPath(before, dataclassName, index)
    return {
      type: 'relatedAttribute',
      dataclassName: relatedDcName ?? dataclassName,
      prefix: '',
    }
  }

  // Partial identifier after dot
  if (last.kind === TokenKind.Identifier && prev?.kind === TokenKind.Dot) {
    const relatedDcName = resolvePartialPath(before.slice(0, -1), dataclassName, index)
    return {
      type: 'relatedAttribute',
      dataclassName: relatedDcName ?? dataclassName,
      prefix: last.text,
    }
  }

  // After a comparator — value context
  const isComparator = (k: TokenKind) =>
    k === TokenKind.Equal ||
    k === TokenKind.StrictEqual ||
    k === TokenKind.NotEqual ||
    k === TokenKind.StrictNotEqual ||
    k === TokenKind.LessThan ||
    k === TokenKind.GreaterThan ||
    k === TokenKind.LessThanOrEqual ||
    k === TokenKind.GreaterThanOrEqual ||
    k === TokenKind.In ||
    k === TokenKind.Contains

  if (last && isComparator(last.kind)) {
    // Resolve the attribute type for better value hints
    const attrType = resolveAttrTypeBeforeComparator(before.slice(0, -1), dataclassName, index)
    return { type: 'value', attrType }
  }

  // After a value (literal or placeholder) → offer logical operators
  const isValue = (k: TokenKind) =>
    k === TokenKind.String ||
    k === TokenKind.Number ||
    k === TokenKind.Boolean ||
    k === TokenKind.Date ||
    k === TokenKind.Null ||
    k === TokenKind.Placeholder ||
    k === TokenKind.RParen

  if (last && isValue(last.kind)) {
    return { type: 'logical' }
  }

  // After a logical operator → new attribute
  if (last.kind === TokenKind.And || last.kind === TokenKind.Or) {
    return { type: 'attribute', dataclassName, prefix: '' }
  }

  // Partial identifier at attribute position
  if (last.kind === TokenKind.Identifier) {
    return { type: 'attribute', dataclassName, prefix: last.text }
  }

  return { type: 'unknown' }
}

function isInsideOrderBy(tokens: Token[], offset: number): boolean {
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i]
    const next = tokens[i + 1]
    if (
      t.end <= offset &&
      t.kind === TokenKind.Identifier &&
      t.text.toLowerCase() === 'order' &&
      next.kind === TokenKind.Identifier &&
      next.text.toLowerCase() === 'by'
    ) {
      return true
    }
  }
  return false
}

/** Walk backwards to resolve the dataclass at the end of a partial dotted path */
function resolvePartialPath(
  before: Token[],
  dataclassName: string,
  index: CatalogIndex
): string | null {
  // Collect the chain of identifiers before the last dot
  const chain: string[] = []
  for (let i = before.length - 1; i >= 0; i--) {
    const t = before[i]
    if (t.kind === TokenKind.Identifier || t.kind === TokenKind.Asc || t.kind === TokenKind.Desc) {
      chain.unshift(t.text)
    } else if (t.kind === TokenKind.Dot) {
    } else {
      break
    }
  }

  // Walk the chain through the schema
  let currentDc = dataclassName
  for (const seg of chain) {
    const attr = getAttribute(currentDc, seg, index)
    if (!attr) return null
    const related = getRelatedDataclassName(currentDc, seg, index)
    if (!related) return null
    const relDc = getDataClass(related, index)
    if (!relDc) return null
    currentDc = relDc.name
  }
  return currentDc
}

function resolveAttrTypeBeforeComparator(
  tokensBeforeOp: Token[],
  dataclassName: string,
  index: CatalogIndex
): string | null {
  // Find last attribute path
  const chain: string[] = []
  for (let i = tokensBeforeOp.length - 1; i >= 0; i--) {
    const t = tokensBeforeOp[i]
    if (t.kind === TokenKind.Identifier) chain.unshift(t.text)
    else if (t.kind === TokenKind.Dot) continue
    else break
  }

  let currentDc = dataclassName
  let lastAttr = null
  for (let i = 0; i < chain.length; i++) {
    const attr = getAttribute(currentDc, chain[i], index)
    if (!attr) return null
    if (i === chain.length - 1) {
      lastAttr = attr
    } else {
      const related = getRelatedDataclassName(currentDc, chain[i], index)
      if (!related) return null
      const relDc = getDataClass(related, index)
      if (!relDc) return null
      currentDc = relDc.name
    }
  }
  return lastAttr?.type ?? null
}

// ---------------------------------------------------------------------------
// Build completions from context
// ---------------------------------------------------------------------------

function buildCompletions(
  ctx: CompletionContext,
  index: CatalogIndex,
  query: string
): CompletionItem[] {
  switch (ctx.type) {
    case 'attribute': {
      const items: CompletionItem[] = []
      // Snippets first so they stay visible above a long attribute list.
      items.push(...attributeSnippets(ctx.prefix))
      const dc = getDataClass(ctx.dataclassName, index)
      if (dc) {
        for (const attr of getAttributes(ctx.dataclassName, index)) {
          const item = attrToCompletion(attr, dc.name)
          if (!ctx.prefix || attr.name.toLowerCase().startsWith(ctx.prefix.toLowerCase())) {
            items.push(item)
          }
        }
      }
      items.push(NOT_KEYWORD)
      return items
    }

    case 'relatedAttribute': {
      const attrs = getAttributes(ctx.dataclassName, index)
      return attrs
        .filter((a) => !ctx.prefix || a.name.toLowerCase().startsWith(ctx.prefix.toLowerCase()))
        .map((a) => attrToCompletion(a, ctx.dataclassName))
    }

    case 'value':
      return valueCompletions(ctx.attrType, query)

    case 'logical':
      return [...LOGICAL_KEYWORDS]

    case 'orderByAttribute': {
      const attrs = getAttributes(ctx.dataclassName, index)
      return attrs.map((a) => attrToCompletion(a, ctx.dataclassName))
    }

    case 'orderByDirection':
      return [...DIRECTION_KEYWORDS]
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return context-aware completion items for `query` at `offset`.
 */
export function complete(
  query: string,
  offset: number,
  index: CatalogIndex,
  dataclassName: string
): readonly CompletionItem[] {
  const tokens = tokenize(query)
  const ctx = inferContext(tokens, offset, dataclassName, index)
  return buildCompletions(ctx, index, query)
}
