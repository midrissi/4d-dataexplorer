import type { TextRange } from './diagnostics.ts'

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** A collection letter used in 4D collection path syntax, e.g. `[a]`. */
export type CollectionLetter = string // single letter a-z

/**
 * Comparator operator kinds, normalised from their various textual forms.
 */
export type ComparatorKind =
  | '=' // = or ==
  | '===' // === or IS
  | '#' // # or !=
  | '!==' // !== or IS NOT
  | '<'
  | '>'
  | '<='
  | '>='
  | 'IN'
  | '%'

export type LogicalOperatorKind = 'AND' | 'OR'

// ---------------------------------------------------------------------------
// Value nodes
// ---------------------------------------------------------------------------

export interface StringLiteralNode {
  readonly kind: 'StringLiteral'
  readonly value: string
  readonly raw: string
  readonly range: TextRange
}

export interface NumberLiteralNode {
  readonly kind: 'NumberLiteral'
  readonly value: number
  readonly range: TextRange
}

export interface BooleanLiteralNode {
  readonly kind: 'BooleanLiteral'
  readonly value: boolean
  readonly range: TextRange
}

export interface DateLiteralNode {
  readonly kind: 'DateLiteral'
  /** ISO date string YYYY-MM-DD */
  readonly value: string
  readonly range: TextRange
}

export interface NullLiteralNode {
  readonly kind: 'NullLiteral'
  readonly range: TextRange
}

export interface CollectionLiteralNode {
  readonly kind: 'CollectionLiteral'
  readonly elements: readonly ValueNode[]
  readonly range: TextRange
}

export type ValueNode =
  | StringLiteralNode
  | NumberLiteralNode
  | BooleanLiteralNode
  | DateLiteralNode
  | NullLiteralNode
  | CollectionLiteralNode
  | PlaceholderNode

// ---------------------------------------------------------------------------
// Attribute / placeholder nodes
// ---------------------------------------------------------------------------

/**
 * A single segment of an attribute path.
 * May carry a collection iterator letter (`[a]`).
 */
export interface PathSegment {
  readonly kind: 'PathSegment'
  readonly name: string
  /** Collection iterator letter immediately following this segment, e.g. "a" from `[a]`. */
  readonly collectionLetter: CollectionLetter | null
  readonly range: TextRange
}

/**
 * An attribute path reference in a condition (left-hand side or ORDER BY item).
 * Examples: `firstName`, `employer.name`, `hobbies[a].name`
 */
export interface AttributeNode {
  readonly kind: 'Attribute'
  readonly segments: readonly PathSegment[]
  readonly range: TextRange
}

/**
 * A placeholder used in attribute position (`:1`, `:attName`).
 */
export interface AttributePlaceholderNode {
  readonly kind: 'AttributePlaceholder'
  /** Indexed placeholder index (1-based) if numeric, else undefined. */
  readonly index?: number
  /** Named placeholder key if named, else undefined. */
  readonly name?: string
  readonly range: TextRange
}

/**
 * A placeholder used in value position (`:1`, `:name`, `:name.subprop`).
 */
export interface PlaceholderNode {
  readonly kind: 'Placeholder'
  readonly index?: number
  readonly name?: string
  /** Sub-property path for named object placeholders like `:settings.userId` */
  readonly subPath: readonly string[]
  readonly range: TextRange
}

// ---------------------------------------------------------------------------
// Condition node
// ---------------------------------------------------------------------------

export interface ConditionNode {
  readonly kind: 'Condition'
  readonly left: AttributeNode | AttributePlaceholderNode
  readonly operator: ComparatorKind
  readonly operatorRange: TextRange
  readonly right: ValueNode
  readonly range: TextRange
}

// ---------------------------------------------------------------------------
// Logical nodes
// ---------------------------------------------------------------------------

export interface BinaryLogicalNode {
  readonly kind: 'BinaryLogical'
  readonly operator: LogicalOperatorKind
  readonly operatorRange: TextRange
  readonly left: QueryNode
  readonly right: QueryNode
  readonly range: TextRange
}

export interface NotNode {
  readonly kind: 'Not'
  readonly operand: QueryNode
  readonly range: TextRange
}

export interface GroupNode {
  readonly kind: 'Group'
  readonly inner: QueryNode
  readonly range: TextRange
}

// ---------------------------------------------------------------------------
// eval() node
// ---------------------------------------------------------------------------

export interface EvalNode {
  readonly kind: 'Eval'
  /** The raw formula string inside eval(…). Treated as opaque. */
  readonly formula: string
  readonly range: TextRange
}

// ---------------------------------------------------------------------------
// ORDER BY
// ---------------------------------------------------------------------------

export interface OrderByItemNode {
  readonly kind: 'OrderByItem'
  readonly attribute: AttributeNode | AttributePlaceholderNode
  readonly direction: 'asc' | 'desc'
  readonly range: TextRange
}

export interface OrderByNode {
  readonly kind: 'OrderBy'
  readonly items: readonly OrderByItemNode[]
  readonly range: TextRange
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * The root AST node for a parsed query string.
 */
export interface QueryRootNode {
  readonly kind: 'QueryRoot'
  /** Main filter expression (may be null for empty/whitespace-only input). */
  readonly filter: QueryNode | null
  /** Optional ORDER BY clause. */
  readonly orderBy: OrderByNode | null
  readonly range: TextRange
}

/**
 * Union of all non-root query expression nodes.
 */
export type QueryNode = ConditionNode | BinaryLogicalNode | NotNode | GroupNode | EvalNode

/**
 * Union of every possible AST node.
 */
export type AnyASTNode =
  | QueryRootNode
  | QueryNode
  | OrderByNode
  | OrderByItemNode
  | AttributeNode
  | AttributePlaceholderNode
  | PlaceholderNode
  | ValueNode
  | PathSegment

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isAttributeNode(n: AnyASTNode): n is AttributeNode {
  return n.kind === 'Attribute'
}
export function isConditionNode(n: AnyASTNode): n is ConditionNode {
  return n.kind === 'Condition'
}
export function isBinaryLogicalNode(n: AnyASTNode): n is BinaryLogicalNode {
  return n.kind === 'BinaryLogical'
}
export function isNotNode(n: AnyASTNode): n is NotNode {
  return n.kind === 'Not'
}
export function isGroupNode(n: AnyASTNode): n is GroupNode {
  return n.kind === 'Group'
}
export function isPlaceholderNode(n: AnyASTNode): n is PlaceholderNode {
  return n.kind === 'Placeholder'
}
export function isEvalNode(n: AnyASTNode): n is EvalNode {
  return n.kind === 'Eval'
}
export function isOrderByNode(n: AnyASTNode): n is OrderByNode {
  return n.kind === 'OrderBy'
}
export function isQueryRootNode(n: AnyASTNode): n is QueryRootNode {
  return n.kind === 'QueryRoot'
}
