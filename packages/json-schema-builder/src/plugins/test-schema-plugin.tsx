import { CodeEditor } from '@4d/ui'
import Ajv from 'ajv/dist/2020'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import type * as Monaco from 'monaco-editor'
import * as React from 'react'
import { useSchemaBuilderContext, useSchemaBuilderI18n } from '../components/schema-builder'
import { getEditorLabels } from '../i18n'
import type { JSONSchemaRoot, SchemaBuilderPlugin, SchemaBuilderPluginProps } from '../types'
import { getSchemaCompletions } from './schema-json-completer'

const ajv = new Ajv({ allErrors: true })

type EditorAnnotation = { row: number; column: number; text: string; type?: 'error' | 'warning' }

function indexToRowColumn(text: string, index: number): { row: number; column: number } {
  const before = text.slice(0, Math.min(index, text.length))
  const lastNewline = before.lastIndexOf('\n')
  return {
    row: (before.match(/\n/g) ?? []).length,
    column: lastNewline === -1 ? before.length : before.length - lastNewline - 1,
  }
}

function getParseErrorPosition(error: unknown, text: string): { row: number; column: number } {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/at position (\d+)/i)
  if (match) {
    const pos = Number.parseInt(match[1], 10)
    return indexToRowColumn(text, pos)
  }
  return { row: 0, column: 0 }
}

/** Find approximate position of a JSON path in source (e.g. "" -> start, "/name" -> key "name"). */
function getPathPosition(text: string, instancePath: string): { row: number; column: number } {
  if (!instancePath) return { row: 0, column: 0 }
  const segments = instancePath.split('/').filter(Boolean)
  if (segments.length === 0) return { row: 0, column: 0 }
  const lastSegment = segments[segments.length - 1]
  const keyPattern = new RegExp(`"${lastSegment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`, 'g')
  const match = keyPattern.exec(text)
  if (match) return indexToRowColumn(text, match.index)
  return indexToRowColumn(text, 0)
}

const DEFAULT_EXAMPLE = '{\n  \n}'

function TestSchemaPluginComponent(props: SchemaBuilderPluginProps) {
  const { getRootForOutput, onChange, getPluginData, setPluginData } = useSchemaBuilderContext()
  const t = useSchemaBuilderI18n()
  const editorLabels = React.useMemo(() => getEditorLabels(t), [t])
  const { pluginId, editorPrefs, onEditorPrefsChange } = props
  const [schemaText, setSchemaText] = React.useState(() =>
    JSON.stringify(getRootForOutput(), null, 2)
  )
  const [exampleText, setExampleText] = React.useState(() => {
    if (pluginId) {
      const saved = getPluginData(pluginId)
      if (typeof saved.exampleText === 'string' && saved.exampleText.trim() !== '') {
        return saved.exampleText
      }
    }
    return DEFAULT_EXAMPLE
  })
  const [validationResult, setValidationResult] = React.useState<
    { valid: true } | { valid: false; errors: Array<{ instancePath: string; message?: string }> }
  >({ valid: true })
  const [schemaAnnotations, setSchemaAnnotations] = React.useState<EditorAnnotation[]>([])
  const [exampleAnnotations, setExampleAnnotations] = React.useState<EditorAnnotation[]>([])

  const schemaTextRef = React.useRef(schemaText)
  const exampleTextRef = React.useRef(exampleText)
  const exampleModelRef = React.useRef<Monaco.editor.ITextModel | null>(null)
  const schemaCompletionDisposableRef = React.useRef<Monaco.IDisposable | null>(null)
  schemaTextRef.current = schemaText
  exampleTextRef.current = exampleText

  React.useEffect(() => {
    return () => {
      schemaCompletionDisposableRef.current?.dispose()
      schemaCompletionDisposableRef.current = null
    }
  }, [])

  const registerSchemaCompletion = React.useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      schemaCompletionDisposableRef.current?.dispose()
      const model = editor.getModel()
      if (!model) return
      exampleModelRef.current = model
      schemaCompletionDisposableRef.current = monaco.languages.registerCompletionItemProvider(
        'json',
        {
          triggerCharacters: ['"', ':'],
          provideCompletionItems(model, position) {
            if (model !== exampleModelRef.current) return { suggestions: [] }
            const text = model.getValue()
            const row = position.lineNumber - 1
            const column = position.column - 1
            const completions = getSchemaCompletions(schemaTextRef.current, text, row, column)
            const word = model.getWordUntilPosition(position)
            const range: Monaco.IRange = {
              startLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: word.endColumn,
            }
            const suggestions: Monaco.languages.CompletionItem[] = completions.map((c) => ({
              label: c.caption ?? c.value.replace(/^"|"$/g, ''),
              insertText: c.value,
              kind: monaco.languages.CompletionItemKind.Property,
              detail: c.meta,
              range,
            }))
            return { suggestions }
          },
        }
      )
    },
    []
  )

  React.useEffect(() => {
    setSchemaText(JSON.stringify(getRootForOutput(), null, 2))
  }, [getRootForOutput])

  React.useEffect(() => {
    if (pluginId) setPluginData(pluginId, { exampleText })
  }, [pluginId, exampleText, setPluginData])

  const runValidation = React.useCallback(() => {
    const trimmedSchema = schemaText.trim()
    const trimmedExample = exampleText.trim()
    let schema: unknown
    let data: unknown

    try {
      schema = JSON.parse(trimmedSchema)
    } catch (schemaErr) {
      const pos = getParseErrorPosition(schemaErr, trimmedSchema)
      setSchemaAnnotations([
        { row: pos.row, column: pos.column, text: 'Schema is not valid JSON', type: 'error' },
      ])
      setExampleAnnotations([])
      setValidationResult({
        valid: false,
        errors: [{ instancePath: '', message: 'Schema is not valid JSON' }],
      })
      return
    }

    try {
      data = JSON.parse(trimmedExample)
    } catch (exampleErr) {
      const pos = getParseErrorPosition(exampleErr, trimmedExample)
      setSchemaAnnotations([])
      setExampleAnnotations([
        { row: pos.row, column: pos.column, text: 'Example is not valid JSON', type: 'error' },
      ])
      setValidationResult({
        valid: false,
        errors: [{ instancePath: '', message: 'Example is not valid JSON' }],
      })
      return
    }

    if (schema === null || typeof schema !== 'object') {
      setSchemaAnnotations([
        { row: 0, column: 0, text: 'Schema must be a JSON object', type: 'error' },
      ])
      setExampleAnnotations([])
      setValidationResult({
        valid: false,
        errors: [{ instancePath: '', message: 'Schema must be a JSON object' }],
      })
      return
    }

    setSchemaAnnotations([])

    try {
      const validate = ajv.compile(schema as object)
      const valid = validate(data)
      if (valid) {
        setExampleAnnotations([])
        setValidationResult({ valid: true })
      } else {
        const errors = (validate.errors ?? []).map((e) => ({
          instancePath: e.instancePath ?? '',
          message: e.message ?? undefined,
        }))
        setExampleAnnotations(
          errors.map((e) => {
            const pos = getPathPosition(trimmedExample, e.instancePath)
            return {
              row: pos.row,
              column: pos.column,
              text: e.message ?? 'Invalid',
              type: 'error' as const,
            }
          })
        )
        setValidationResult({ valid: false, errors })
      }
    } catch (err) {
      setExampleAnnotations([
        {
          row: 0,
          column: 0,
          text: err instanceof Error ? err.message : 'Validation failed',
          type: 'error',
        },
      ])
      setValidationResult({
        valid: false,
        errors: [
          { instancePath: '', message: err instanceof Error ? err.message : 'Validation failed' },
        ],
      })
    }
  }, [schemaText, exampleText])

  React.useEffect(() => {
    runValidation()
  }, [runValidation])

  const commitSchema = React.useCallback(() => {
    const trimmed = schemaText.trim()
    if (!trimmed) return
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed !== null && typeof parsed === 'object') {
        onChange(parsed as JSONSchemaRoot)
      }
    } catch {
      // keep current text
    }
  }, [schemaText, onChange])

  const exampleSchema = React.useMemo(() => {
    const trimmed = schemaText.trim()
    if (!trimmed) return undefined
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : undefined
    } catch {
      return undefined
    }
  }, [schemaText])

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
        <div className="flex min-h-0 flex-col gap-1">
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Schema
          </span>
          <div className="min-h-[280px] w-full overflow-hidden rounded-md bg-muted/10">
            <CodeEditor
              path="schema.json"
              language="json"
              value={schemaText}
              onChange={setSchemaText}
              onBlur={commitSchema}
              height="280px"
              fontSize={12}
              showLineNumbers
              annotations={schemaAnnotations}
              toolbar
              labels={editorLabels}
              editorPrefs={editorPrefs}
              onEditorPrefsChange={onEditorPrefsChange}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-1">
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Example to test
          </span>
          <div className="min-h-[280px] w-full overflow-hidden rounded-md bg-muted/10">
            <CodeEditor
              language="json"
              value={exampleText}
              onChange={setExampleText}
              height="280px"
              fontSize={12}
              showLineNumbers
              annotations={exampleAnnotations}
              onMount={registerSchemaCompletion}
              toolbar
              labels={editorLabels}
              schema={exampleSchema}
              editorPrefs={editorPrefs}
              onEditorPrefsChange={onEditorPrefsChange}
            />
          </div>
        </div>
      </div>
      <div
        className={
          validationResult.valid
            ? 'shrink-0 overflow-hidden rounded-sm border border-green-500/20 bg-green-500/5'
            : 'shrink-0 overflow-hidden rounded-sm border border-destructive/20 bg-destructive/5'
        }
      >
        {validationResult.valid ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-green-500/15">
              <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-green-700 text-xs dark:text-green-300">Valid</p>
              <p className="text-[11px] text-green-600/80 dark:text-green-400/80">
                Example matches the schema
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-destructive/10 border-b px-2 py-1.5">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-destructive/15">
                <XCircle className="size-3.5 text-destructive" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-destructive text-xs">Validation failed</p>
                <p className="text-[11px] text-muted-foreground">
                  {validationResult.errors.length} error
                  {validationResult.errors.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
            <ol className="flex max-h-32 list-none flex-col gap-1 overflow-y-auto p-1.5">
              {(() => {
                // Build stable, unique keys even when the same error repeats.
                const seen = new Map<string, number>()
                return validationResult.errors.map((e, i) => {
                  const base = `${e.instancePath}-${e.message ?? ''}`
                  const occurrence = seen.get(base) ?? 0
                  seen.set(base, occurrence + 1)
                  const key = occurrence === 0 ? base : `${base}#${occurrence}`
                  return (
                    <li
                      key={key}
                      className="flex items-start gap-2 rounded-sm border-destructive/50 border-l-2 bg-background/50 px-2 py-1"
                    >
                      <span
                        className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-destructive/10 font-mono font-semibold text-[10px] text-destructive tabular-nums"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {e.instancePath ? (
                          <div className="font-mono text-[11px] text-muted-foreground">
                            <span className="text-foreground/70">{e.instancePath}</span>
                          </div>
                        ) : null}
                        <p className="text-foreground text-xs leading-snug">
                          {e.message ?? 'Invalid'}
                        </p>
                      </div>
                      <AlertCircle
                        className="mt-0.5 size-3.5 shrink-0 text-destructive/70"
                        aria-hidden
                      />
                    </li>
                  )
                })
              })()}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

export const testSchemaPlugin: SchemaBuilderPlugin = {
  id: 'test-schema',
  tabLabel: 'Test schema',
  tabContent: TestSchemaPluginComponent,
}
