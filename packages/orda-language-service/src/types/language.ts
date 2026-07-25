import type { TextRange } from './diagnostics.ts'

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export enum CompletionItemKind {
  Field = 'field',
  Relation = 'relation',
  Keyword = 'keyword',
  Value = 'value',
  Operator = 'operator',
  Snippet = 'snippet',
}

export interface CompletionItem {
  /** Display label shown in the editor's completion list. */
  readonly label: string
  readonly kind: CompletionItemKind
  /** Short detail text (e.g. "string", "relatedEntity → Company"). */
  readonly detail?: string
  /** Full documentation / description. */
  readonly documentation?: string
  /** Text to insert when the item is accepted (defaults to label). */
  readonly insertText: string
  /**
   * When true, `insertText` is treated as a snippet (tab stops / placeholders).
   * Callers should enable snippet insert rules in the editor.
   */
  readonly isSnippet?: boolean
  /**
   * The range in the original query that will be replaced by insertText.
   * If absent the caller should insert at cursor position.
   */
  readonly range?: TextRange
  /** Sort priority — lower numbers sort first. */
  readonly sortOrder?: number
}

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

export interface MarkupContent {
  readonly value: string
}

export interface HoverInfo {
  readonly range: TextRange
  readonly contents: MarkupContent
}

// ---------------------------------------------------------------------------
// Signature Help
// ---------------------------------------------------------------------------

export interface ParameterInformation {
  readonly label: string
  readonly documentation?: string
}

export interface SignatureInformation {
  readonly label: string
  readonly documentation?: string
  readonly parameters: readonly ParameterInformation[]
}

export interface SignatureHelp {
  readonly signatures: readonly SignatureInformation[]
  /** Index of the active signature. */
  readonly activeSignature: number
  /** Index of the active parameter within the active signature. */
  readonly activeParameter: number
}

// ---------------------------------------------------------------------------
// Format options
// ---------------------------------------------------------------------------

export interface FormatOptions {
  /** Keyword case. Default: 'upper' */
  readonly keywordCase?: 'upper' | 'lower' | 'preserve'
  /** Normalise == and === to = and IS. Default: true */
  readonly normalizeOperators?: boolean
  /** Ensure single space around binary operators. Default: true */
  readonly spaceAroundOperators?: boolean
}
