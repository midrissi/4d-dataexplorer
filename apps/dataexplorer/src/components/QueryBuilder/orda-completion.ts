import { CompletionItemKind } from '@4d/orda-language-service'
import type * as MonacoEditor from 'monaco-editor'

/**
 * Map a language-service {@link CompletionItemKind} to the equivalent Monaco
 * completion kind. Unknown kinds fall back to `Value`.
 */
export function mapOrdaCompletionKind(
  kind: CompletionItemKind,
  monaco: typeof MonacoEditor
): MonacoEditor.languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind
  switch (kind) {
    case CompletionItemKind.Field:
      return kinds.Field
    case CompletionItemKind.Relation:
      return kinds.Reference
    case CompletionItemKind.Keyword:
      return kinds.Keyword
    case CompletionItemKind.Operator:
      return kinds.Operator
    case CompletionItemKind.Snippet:
      return kinds.Snippet
    default:
      return kinds.Value
  }
}
