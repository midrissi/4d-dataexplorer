# @4d/orda-language-service

Editor-agnostic TypeScript language service for 4D ORDA query expressions.

It provides:
- Parsing and diagnostics
- Semantic validation against your catalog schema
- Contextual completion
- Hover details
- Signature help for placeholders
- Query formatting

## Install

This package is part of this monorepo. Add it to your app package dependencies:

```json
{
  "dependencies": {
    "@4d/orda-language-service": "workspace:*",
    "@4d/rest": "workspace:*"
  }
}
```

Then install workspace dependencies from the repository root:

```bash
bun install
```

## Quick Start

```ts
import type { CatalogAllResponse } from '@4d/rest'
import { createLanguageService } from '@4d/orda-language-service'

const catalog: CatalogAllResponse = await getCatalogSomehow()
const service = createLanguageService(catalog, 'Users')

const query = "age >= :1 AND active = true order by lastName asc"

const parse = service.parse(query)
const diagnostics = service.validate(query)
const completions = service.complete('age >= :1 AND ', 'age >= :1 AND '.length)
const hover = service.hover('manager.lastName = :1', 2)
const signature = service.signature('age >= :1', 8)
const formatted = service.format(query)
const resolved = service.resolve('manager.lastName')
```

## API Surface

`createLanguageService(catalog, dataclassName)` returns an object with:
- `parse(query)` -> `{ ast, diagnostics }`
- `validate(query)` -> semantic + syntax diagnostics
- `complete(query, offset)` -> completion items at cursor offset
- `hover(query, offset)` -> hover content at cursor offset
- `signature(query, offset)` -> placeholder signature help
- `format(query, options?)` -> normalized query string
- `resolve(attributePath)` -> resolved attribute info from the schema

Offsets are zero-based string offsets in the query text.

## Monaco + React Example

This example uses `@monaco-editor/react` and wires validation, completion, and hover to ORDA language service.

```tsx
import { useMemo, useRef, useEffect } from 'react'
import Editor, { useMonaco, type Monaco } from '@monaco-editor/react'
import type * as MonacoNS from 'monaco-editor'
import type { CatalogAllResponse } from '@4d/rest'
import {
  createLanguageService,
  DiagnosticSeverity,
  CompletionItemKind,
  type CompletionItem,
} from '@4d/orda-language-service'

type Props = {
  dataclassName: string
  catalog: CatalogAllResponse
  value: string
  onChange: (next: string) => void
}

const LANGUAGE_ID = 'orda-query'

export function OrdaQueryEditor({ dataclassName, catalog, value, onChange }: Props) {
  const monaco = useMonaco()
  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null)

  const service = useMemo(() => {
    return createLanguageService(catalog, dataclassName)
  }, [catalog, dataclassName])

  useEffect(() => {
    if (!monaco) return

    monaco.languages.register({ id: LANGUAGE_ID })

    const completionProvider = monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      triggerCharacters: ['.', ' ', ':'],
      provideCompletionItems(model, position) {
        const query = model.getValue()
        const offset = model.getOffsetAt(position)
        const items = service.complete(query, offset)

        return {
          suggestions: items.map((item) => toMonacoCompletion(monaco, model, position, item)),
        }
      },
    })

    const hoverProvider = monaco.languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover(model, position) {
        const query = model.getValue()
        const offset = model.getOffsetAt(position)
        const info = service.hover(query, offset)
        if (!info) return null

        return {
          range: toMonacoRangeFromOffsets(model, info.range.start, info.range.end),
          contents: [{ value: info.contents.value }],
        }
      },
    })

    return () => {
      completionProvider.dispose()
      hoverProvider.dispose()
    }
  }, [monaco, service])

  const validateAndMark = (editor: MonacoNS.editor.IStandaloneCodeEditor) => {
    if (!monaco) return
    const model = editor.getModel()
    if (!model) return

    const diagnostics = service.validate(model.getValue())
    const markers: MonacoNS.editor.IMarkerData[] = diagnostics.map((d) => {
      const start = model.getPositionAt(d.range.start)
      const end = model.getPositionAt(d.range.end)

      return {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
        message: d.message,
        code: String(d.code),
        severity: toMonacoSeverity(monaco, d.severity),
      }
    })

    monaco.editor.setModelMarkers(model, 'orda-language-service', markers)
  }

  return (
    <Editor
      height="360px"
      defaultLanguage={LANGUAGE_ID}
      value={value}
      onMount={(editor) => {
        editorRef.current = editor
        validateAndMark(editor)
      }}
      onChange={(next) => {
        const text = next ?? ''
        onChange(text)
        if (editorRef.current) validateAndMark(editorRef.current)
      }}
      options={{
        minimap: { enabled: false },
        wordWrap: 'on',
      }}
    />
  )
}

function toMonacoSeverity(monaco: Monaco, severity: DiagnosticSeverity) {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return monaco.MarkerSeverity.Error
    case DiagnosticSeverity.Warning:
      return monaco.MarkerSeverity.Warning
    case DiagnosticSeverity.Information:
      return monaco.MarkerSeverity.Info
    case DiagnosticSeverity.Hint:
      return monaco.MarkerSeverity.Hint
    default:
      return monaco.MarkerSeverity.Info
  }
}

function toMonacoRangeFromOffsets(
  model: MonacoNS.editor.ITextModel,
  startOffset: number,
  endOffset: number
) {
  const start = model.getPositionAt(startOffset)
  const end = model.getPositionAt(endOffset)

  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  }
}

function toMonacoCompletion(
  monaco: Monaco,
  model: MonacoNS.editor.ITextModel,
  position: MonacoNS.Position,
  item: CompletionItem
): MonacoNS.languages.CompletionItem {
  const range = item.range
    ? toMonacoRangeFromOffsets(model, item.range.start, item.range.end)
    : {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      }

  return {
    label: item.label,
    detail: item.detail,
    documentation: item.documentation,
    insertText: item.insertText,
    range,
    sortText: String(item.sortOrder ?? 999).padStart(3, '0'),
    kind: toMonacoCompletionKind(monaco, item.kind),
  }
}

function toMonacoCompletionKind(monaco: Monaco, kind: CompletionItemKind) {
  switch (kind) {
    case CompletionItemKind.Field:
      return monaco.languages.CompletionItemKind.Field
    case CompletionItemKind.Relation:
      return monaco.languages.CompletionItemKind.Reference
    case CompletionItemKind.Keyword:
      return monaco.languages.CompletionItemKind.Keyword
    case CompletionItemKind.Value:
      return monaco.languages.CompletionItemKind.Value
    case CompletionItemKind.Operator:
      return monaco.languages.CompletionItemKind.Operator
    default:
      return monaco.languages.CompletionItemKind.Text
  }
}
```

## Notes

- The service is dataclass-scoped. Create one service per active dataclass.
- Recreate the service when catalog metadata changes.
- Use `format(query)` for save-time normalization, not on every keystroke.
