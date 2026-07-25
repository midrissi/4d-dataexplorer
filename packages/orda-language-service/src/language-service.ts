import type { CatalogAllResponse } from '@4d/rest'
import { parse } from './parser/parser.ts'
import { buildCatalogIndex } from './schema/catalog-index.ts'
import { resolveAttributePath } from './schema/schema-resolver.ts'
import { complete } from './services/completion-service.ts'
import { format } from './services/format-service.ts'
import { hover } from './services/hover-service.ts'
import { signature } from './services/signature-service.ts'
import type { Diagnostic } from './types/diagnostics.ts'
import type { CompletionItem, FormatOptions, HoverInfo, SignatureHelp } from './types/language.ts'
import type {
  CatalogIndex,
  LanguageService,
  ParseResult,
  ResolvedAttribute,
} from './types/service.ts'
import { validate } from './validate.ts'

/**
 * Create a stateful `LanguageService` bound to a specific dataclass and catalog.
 *
 * The catalog index is built once and reused across all service calls.
 *
 * @example
 * ```ts
 * const svc = createLanguageService(catalogResponse, 'Employee')
 * const diagnostics = svc.validate("salary > :1 and manager.lastName = 'Smith'")
 * const completions = svc.complete("salary > :1 and ", 18)
 * ```
 */
export function createLanguageService(
  catalog: CatalogAllResponse,
  dataclassName: string
): LanguageService {
  const index: CatalogIndex = buildCatalogIndex(catalog)

  return {
    parse(query: string): ParseResult {
      return parse(query)
    },

    validate(query: string): readonly Diagnostic[] {
      return validate(query, index, dataclassName)
    },

    complete(query: string, offset: number): readonly CompletionItem[] {
      return complete(query, offset, index, dataclassName)
    },

    hover(query: string, offset: number): HoverInfo | null {
      return hover(query, offset, index, dataclassName)
    },

    signature(query: string, offset: number): SignatureHelp | null {
      return signature(query, offset)
    },

    format(query: string, options?: FormatOptions): string {
      return format(query, options)
    },

    resolve(attributePath: string): ResolvedAttribute | null {
      return resolveAttributePath(attributePath, dataclassName, index)
    },
  }
}
