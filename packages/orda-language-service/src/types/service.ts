import type { DataClass, DataClassAttribute } from '@4d/rest'
import type { QueryRootNode } from './ast.ts'
import type { Diagnostic } from './diagnostics.ts'
import type { CompletionItem, FormatOptions, HoverInfo, SignatureHelp } from './language.ts'

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

/**
 * Pre-built index over a CatalogAllResponse for O(1) lookups.
 */
export interface CatalogIndex {
  /**
   * Dataclass by lower-cased name.
   * Key: `dataClassName.toLowerCase()`
   */
  readonly dataclasses: ReadonlyMap<string, DataClass>
  /**
   * Attribute lookup by dataclass name + attribute name.
   * Key: `${dataclassNameLower}.${attrNameLower}`
   */
  readonly attributes: ReadonlyMap<string, DataClassAttribute>
  /**
   * Quick relation map: given a dataclass + attribute, what dataclass does it relate to?
   * Key: `${dataclassNameLower}.${attrNameLower}` → related dataclass name (original casing)
   */
  readonly relations: ReadonlyMap<string, string>
}

/**
 * Result of resolving an attribute path against the schema.
 */
export interface ResolvedAttribute {
  readonly attribute: DataClassAttribute
  readonly dataclass: DataClass
  /** How many dot-segments deep this attribute lives. */
  readonly depth: number
}

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface ParseResult {
  readonly ast: QueryRootNode
  readonly diagnostics: readonly Diagnostic[]
}

// ---------------------------------------------------------------------------
// LanguageService interface
// ---------------------------------------------------------------------------

/**
 * Stateful language service bound to a specific dataclass and catalog.
 * Construct with `createLanguageService()`.
 */
export interface LanguageService {
  /**
   * Parse a raw query string into an AST + syntax diagnostics.
   */
  parse(query: string): ParseResult

  /**
   * Full validation: syntax + semantic diagnostics.
   */
  validate(query: string): readonly Diagnostic[]

  /**
   * Context-aware completion items at `offset` in `query`.
   */
  complete(query: string, offset: number): readonly CompletionItem[]

  /**
   * Hover information for the token at `offset` in `query`.
   */
  hover(query: string, offset: number): HoverInfo | null

  /**
   * Signature help (active parameter index) at `offset` in `query`.
   */
  signature(query: string, offset: number): SignatureHelp | null

  /**
   * Format / pretty-print a query string.
   */
  format(query: string, options?: FormatOptions): string

  /**
   * Resolve a dot-separated attribute path in the context of this service's dataclass.
   */
  resolve(attributePath: string): ResolvedAttribute | null
}
