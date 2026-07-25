/**
 * @4d/orda-language-service
 *
 * Editor-agnostic TypeScript language service for 4D ORDA query expressions.
 * Supports the queryString syntax used by DataClass.query() and EntitySelection.query().
 *
 * @example
 * ```ts
 * import { createLanguageService, buildCatalogIndex } from '@4d/orda-language-service'
 *
 * const svc = createLanguageService(catalogAllResponse, 'Employee')
 * const { ast, diagnostics } = svc.parse("salary > :1 AND manager.lastName = 'Smith'")
 * const completions = svc.complete("salary > :1 AND ", 18)
 * const hover = svc.hover("salary > :1", 0)
 * ```
 */

// --- High-level API ---
export { createLanguageService } from './language-service.ts'

// --- Standalone functions ---
export { parse } from './parser/parser.ts'
// --- Schema utilities ---
export {
  buildCatalogIndex,
  getAttribute,
  getAttributes,
  getDataClass,
  getRelatedDataclassName,
} from './schema/catalog-index.ts'
export type { ReachableAttribute } from './schema/schema-resolver.ts'
export { getReachableAttributes, resolveAttributePath } from './schema/schema-resolver.ts'
export type { AttributeCategory } from './semantic/type-resolver.ts'
// --- Semantic utilities ---
export { categoriseType } from './semantic/type-resolver.ts'
export { complete } from './services/completion-service.ts'
export { format } from './services/format-service.ts'
export { hover } from './services/hover-service.ts'
export { signature } from './services/signature-service.ts'
// --- Types: AST ---
export type {
  AnyASTNode,
  AttributeNode,
  AttributePlaceholderNode,
  BinaryLogicalNode,
  BooleanLiteralNode,
  CollectionLetter,
  CollectionLiteralNode,
  ComparatorKind,
  ConditionNode,
  DateLiteralNode,
  EvalNode,
  GroupNode,
  LogicalOperatorKind,
  NotNode,
  NullLiteralNode,
  NumberLiteralNode,
  OrderByItemNode,
  OrderByNode,
  PathSegment,
  PlaceholderNode,
  QueryNode,
  QueryRootNode,
  StringLiteralNode,
  ValueNode,
} from './types/ast.ts'
// AST type guards
export {
  isAttributeNode,
  isBinaryLogicalNode,
  isConditionNode,
  isEvalNode,
  isGroupNode,
  isNotNode,
  isOrderByNode,
  isPlaceholderNode,
  isQueryRootNode,
} from './types/ast.ts'
export type { Diagnostic, TextRange } from './types/diagnostics.ts'
// --- Types: diagnostics ---
export { DiagnosticCode, DiagnosticSeverity } from './types/diagnostics.ts'
export type {
  CompletionItem,
  FormatOptions,
  HoverInfo,
  MarkupContent,
  ParameterInformation,
  SignatureHelp,
  SignatureInformation,
} from './types/language.ts'

// --- Types: language service ---
export { CompletionItemKind } from './types/language.ts'
// --- Types: service interfaces ---
export type {
  CatalogIndex,
  LanguageService,
  ParseResult,
  ResolvedAttribute,
} from './types/service.ts'
export type { Token } from './types/tokens.ts'
// --- Types: tokens ---
export { makeToken, TokenKind } from './types/tokens.ts'
export { validate } from './validate.ts'
