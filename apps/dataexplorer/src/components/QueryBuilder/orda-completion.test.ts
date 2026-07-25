import { describe, expect, it } from 'bun:test'
import { CompletionItemKind } from '@4d/orda-language-service'
import type * as MonacoEditor from 'monaco-editor'
import { mapOrdaCompletionKind } from './orda-completion'

const monaco = {
  languages: {
    CompletionItemKind: {
      Field: 'Field',
      Reference: 'Reference',
      Keyword: 'Keyword',
      Operator: 'Operator',
      Value: 'Value',
      Snippet: 'Snippet',
    },
  },
} as unknown as typeof MonacoEditor

describe('mapOrdaCompletionKind', () => {
  it('maps Field to Field', () => {
    expect(mapOrdaCompletionKind(CompletionItemKind.Field, monaco)).toBe(
      monaco.languages.CompletionItemKind.Field
    )
  })

  it('maps Relation to Reference', () => {
    expect(mapOrdaCompletionKind(CompletionItemKind.Relation, monaco)).toBe(
      monaco.languages.CompletionItemKind.Reference
    )
  })

  it('maps Keyword to Keyword', () => {
    expect(mapOrdaCompletionKind(CompletionItemKind.Keyword, monaco)).toBe(
      monaco.languages.CompletionItemKind.Keyword
    )
  })

  it('maps Operator to Operator', () => {
    expect(mapOrdaCompletionKind(CompletionItemKind.Operator, monaco)).toBe(
      monaco.languages.CompletionItemKind.Operator
    )
  })

  it('maps Value and Snippet', () => {
    expect(mapOrdaCompletionKind(CompletionItemKind.Value, monaco)).toBe(
      monaco.languages.CompletionItemKind.Value
    )
    expect(mapOrdaCompletionKind(CompletionItemKind.Snippet, monaco)).toBe(
      monaco.languages.CompletionItemKind.Snippet
    )
  })
})
