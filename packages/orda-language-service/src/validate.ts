import { parse } from './parser/parser.ts'
import { checkTypes } from './semantic/type-checker.ts'
import type { Diagnostic } from './types/diagnostics.ts'
import type { CatalogIndex } from './types/service.ts'

/**
 * Full validation: combines syntax diagnostics from the parser with
 * semantic diagnostics from the type checker.
 *
 * @param query       Raw ORDA query string
 * @param index       Pre-built catalog index
 * @param dataclassName  Dataclass context for attribute resolution
 */
export function validate(
  query: string,
  index: CatalogIndex,
  dataclassName: string
): readonly Diagnostic[] {
  const { ast, diagnostics: syntaxDiags } = parse(query)
  const semanticDiags = checkTypes(ast, dataclassName, index)
  return [...syntaxDiags, ...semanticDiags]
}
