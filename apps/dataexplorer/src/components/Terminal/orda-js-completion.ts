import { createLanguageService, type LanguageService } from '@4d/orda-language-service'
import type { CatalogAllResponse } from '@4d/rest'
import type * as MonacoEditor from 'monaco-editor'
import { mapOrdaCompletionKind } from '~/components/QueryBuilder/orda-completion'
import { isAssistantExposedMethod } from '~/lib/assistant-exposed-method'
import type { MethodMeta } from '~/lib/terminal'

/** Monaco snippet placeholder — built without template literals so `${…}` stays literal. */
function snip(parts: TemplateStringsArray, ...holes: string[]): string {
  let out = parts[0] ?? ''
  for (let i = 0; i < holes.length; i++) {
    out += holes[i] + (parts[i + 1] ?? '')
  }
  return out
}

const P1 = '${1:'
const P2 = '${2:'
const P3 = '${3:'
const CLOSE = '}'

type MethodSuggest = {
  label: string
  insertText: string
  snippet?: boolean
  detail: string
  kind?: 'method' | 'function' | 'class'
}

const DATACLASS_BUILTINS: MethodSuggest[] = [
  { label: 'all', insertText: 'all()', detail: 'Query all entities' },
  {
    label: 'query',
    insertText: snip`query(${P1}filter${CLOSE}${P2}, ${P3}params${CLOSE}${CLOSE})`,
    snippet: true,
    detail: 'query(filter, ...params)',
  },
  {
    label: 'get',
    insertText: snip`get(${P1}key${CLOSE})`,
    snippet: true,
    detail: 'get(key)',
  },
  {
    label: 'entity',
    insertText: snip`entity(${P1}key${CLOSE})`,
    snippet: true,
    detail: 'entity(key) — call entity methods',
  },
  {
    label: 'sel',
    insertText: snip`sel(${P1}entitySetId${CLOSE})`,
    snippet: true,
    detail: 'sel(entitySetId) — call selection methods',
  },
]

const QUERY_METHODS: MethodSuggest[] = [
  {
    label: 'select',
    insertText: snip`select(${P1}attributes${CLOSE})`,
    snippet: true,
    detail: 'select(...attributes)',
  },
  {
    label: 'orderBy',
    insertText: snip`orderBy(${P1}attribute${CLOSE})`,
    snippet: true,
    detail: 'orderBy(attribute, direction?)',
  },
  {
    label: 'expand',
    insertText: snip`expand(${P1}relation${CLOSE})`,
    snippet: true,
    detail: 'expand(...relations)',
  },
  { label: 'top', insertText: snip`top(${P1}n${CLOSE})`, snippet: true, detail: 'top(n)' },
  { label: 'skip', insertText: snip`skip(${P1}n${CLOSE})`, snippet: true, detail: 'skip(n)' },
  { label: 'first', insertText: 'first()', detail: 'first()' },
  { label: 'toCollection', insertText: 'toCollection()', detail: 'toCollection()' },
  { label: 'count', insertText: 'count()', detail: 'count()' },
]

const ENTITY_BUILTINS: MethodSuggest[] = [
  {
    label: 'select',
    insertText: snip`select(${P1}attributes${CLOSE})`,
    snippet: true,
    detail: 'select(...attributes)',
  },
  { label: 'getKey', insertText: 'getKey()', detail: 'getKey()' },
]

function textBefore(
  model: MonacoEditor.editor.ITextModel,
  position: MonacoEditor.Position
): string {
  return model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })
}

function queryStringContext(
  before: string
): { filterPrefix: string; dataClass: string | null } | null {
  const match = before.match(/ds\.([A-Za-z_][\w]*)\s*\.\s*query\s*\(\s*(["'])([\s\S]*)$/)
  if (!match) return null
  const dataClass = match[1] ?? null
  const quote = match[2]
  const filterPrefix = match[3] ?? ''
  let escaped = false
  for (let i = 0; i < filterPrefix.length; i++) {
    const c = filterPrefix[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === quote) return null
  }
  return { filterPrefix, dataClass }
}

function rangeAtWord(
  model: MonacoEditor.editor.ITextModel,
  position: MonacoEditor.Position,
  monaco: typeof MonacoEditor
): MonacoEditor.IRange {
  const word = model.getWordUntilPosition(position)
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn
  )
}

function isTerminalModel(model: MonacoEditor.editor.ITextModel): boolean {
  return model.uri.path.includes('orda-terminal')
}

function scopeFromApplyTo(applyTo?: string): MethodMeta['scope'] {
  if (applyTo === 'entity') return 'entity'
  if (
    applyTo === 'entitySelection' ||
    applyTo === 'entityCollection' ||
    applyTo === 'dataClassSelection'
  ) {
    return 'entitySelection'
  }
  return 'dataclass'
}

export function methodsFromCatalog(catalog: CatalogAllResponse | null): MethodMeta[] {
  if (!catalog) return []
  const next: MethodMeta[] = []
  for (const dataClass of catalog.dataClasses ?? []) {
    for (const method of dataClass.methods ?? []) {
      if (!isAssistantExposedMethod(method)) continue
      next.push({
        name: method.name,
        scope: scopeFromApplyTo(method.applyTo),
        dataClass: dataClass.name,
        allowedOnHTTPGET: method.allowedOnHTTPGET,
      })
    }
  }
  const full = catalog as CatalogAllResponse & {
    methods?: Array<{
      name: string
      applyTo?: string
      allowedOnHTTPGET?: boolean
      exposed?: boolean
      scope?: string
    }>
  }
  for (const method of full.methods ?? []) {
    if (!isAssistantExposedMethod(method)) continue
    next.push({
      name: method.name,
      scope: 'catalog',
      allowedOnHTTPGET: method.allowedOnHTTPGET,
    })
  }
  return next
}

function toSuggestions(
  items: MethodSuggest[],
  monaco: typeof MonacoEditor,
  range: MonacoEditor.IRange,
  offset = 0
): MonacoEditor.languages.CompletionItem[] {
  const snippetRule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  return items.map((method, index) => ({
    label: method.label,
    kind:
      method.kind === 'class'
        ? monaco.languages.CompletionItemKind.Class
        : method.kind === 'function'
          ? monaco.languages.CompletionItemKind.Function
          : monaco.languages.CompletionItemKind.Method,
    insertText: method.insertText,
    insertTextRules: method.snippet ? snippetRule : undefined,
    detail: method.detail,
    range,
    sortText: String(offset + index).padStart(4, '0'),
  }))
}

/** Match `ds.Car.` (not after all/query/get/entity/sel call). */
function dataClassMemberContext(before: string): { dataClass: string } | null {
  const match = before.match(/(?:^|[\s([{;,=])ds\.([A-Za-z_][\w]*)\s*\.\s*[\w]*$/)
  if (!match) return null
  if (/\.(?:all|query|get|entity|sel)\s*\([^)]*\)\s*\.\s*[\w]*$/.test(before)) return null
  return { dataClass: match[1] ?? '' }
}

function entityMemberContext(before: string): { dataClass: string } | null {
  const match = before.match(/ds\.([A-Za-z_][\w]*)\s*\.\s*(?:entity|get)\s*\([^)]*\)\s*\.\s*[\w]*$/)
  if (!match) return null
  return { dataClass: match[1] ?? '' }
}

function selMemberContext(before: string): { dataClass: string } | null {
  const match = before.match(/ds\.([A-Za-z_][\w]*)\s*\.\s*sel\s*\([^)]*\)\s*\.\s*[\w]*$/)
  if (!match) return null
  return { dataClass: match[1] ?? '' }
}

export type OrdaJsCompletionContext = {
  dataClassNames: string[]
  catalog: CatalogAllResponse | null
  methods?: MethodMeta[]
}

/**
 * Register Monaco completion + signature help for the terminal ORDA JS surface.
 * Pass the monaco instance from CodeEditor `onMount` so providers bind to the same runtime.
 */
export function registerOrdaJsProviders(
  monaco: typeof MonacoEditor,
  getContext: () => OrdaJsCompletionContext
): () => void {
  const disposables: MonacoEditor.IDisposable[] = []
  const lsCache = new Map<string, LanguageService>()

  const getLs = (dataClass: string | null): LanguageService | null => {
    const { catalog } = getContext()
    if (!dataClass || !catalog) return null
    let ls = lsCache.get(dataClass)
    if (!ls) {
      try {
        ls = createLanguageService(catalog, dataClass)
        lsCache.set(dataClass, ls)
      } catch {
        return null
      }
    }
    return ls
  }

  const resolveMethods = (): MethodMeta[] => {
    const ctx = getContext()
    return ctx.methods ?? methodsFromCatalog(ctx.catalog)
  }

  disposables.push(
    monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.', '"', "'", ' '],
      provideCompletionItems(model, position) {
        if (!isTerminalModel(model)) return { suggestions: [] }

        const before = textBefore(model, position)
        const range = rangeAtWord(model, position, monaco)
        const ctx = getContext()
        const methods = resolveMethods()

        const inQuery = queryStringContext(before)
        if (inQuery) {
          const ls = getLs(inQuery.dataClass)
          if (!ls) return { suggestions: [] }
          const completions = ls.complete(inQuery.filterPrefix, inQuery.filterPrefix.length)
          return {
            suggestions: completions.map((item, index) => ({
              label: item.label,
              kind: mapOrdaCompletionKind(item.kind, monaco),
              insertText: item.insertText ?? item.label,
              detail: item.detail,
              documentation: item.documentation,
              range,
              sortText: String(index).padStart(4, '0'),
            })),
          }
        }

        // ds.
        if (/(?:^|[\s([{;,=])ds\.\s*[\w]*$/.test(before)) {
          const catalogMethods = methods
            .filter((m) => m.scope === 'catalog')
            .map(
              (m): MethodSuggest => ({
                label: m.name,
                insertText: `${m.name}()`,
                detail: 'Datastore method',
                kind: 'function',
              })
            )
          const classes = ctx.dataClassNames.map(
            (name): MethodSuggest => ({
              label: name,
              insertText: name,
              detail: 'DataClass',
              kind: 'class',
            })
          )
          return {
            suggestions: [
              ...toSuggestions(classes, monaco, range, 0),
              ...toSuggestions(catalogMethods, monaco, range, classes.length),
            ],
          }
        }

        const entityCtx = entityMemberContext(before)
        if (entityCtx) {
          const entityMethods = methods
            .filter((m) => m.scope === 'entity' && m.dataClass === entityCtx.dataClass)
            .map(
              (m): MethodSuggest => ({
                label: m.name,
                insertText: `${m.name}()`,
                detail: 'Entity method',
              })
            )
          return {
            suggestions: [
              ...toSuggestions(ENTITY_BUILTINS, monaco, range, 0),
              ...toSuggestions(entityMethods, monaco, range, ENTITY_BUILTINS.length),
            ],
          }
        }

        const selCtx = selMemberContext(before)
        if (selCtx) {
          const selMethods = methods
            .filter((m) => m.scope === 'entitySelection' && m.dataClass === selCtx.dataClass)
            .map(
              (m): MethodSuggest => ({
                label: m.name,
                insertText: `${m.name}()`,
                detail: 'Entity selection method',
              })
            )
          return {
            suggestions: [
              ...toSuggestions(
                [{ label: 'getKey', insertText: 'getKey()', detail: 'getKey()' }],
                monaco,
                range,
                0
              ),
              ...toSuggestions(selMethods, monaco, range, 1),
            ],
          }
        }

        if (/\.(?:all|query)\s*\([^)]*\)(?:\s*\.\s*\w+\s*\([^)]*\))*\s*\.\s*[\w]*$/.test(before)) {
          return { suggestions: toSuggestions(QUERY_METHODS, monaco, range) }
        }

        const dcCtx = dataClassMemberContext(before)
        if (dcCtx) {
          const dcMethods = methods
            .filter((m) => m.scope === 'dataclass' && m.dataClass === dcCtx.dataClass)
            .map(
              (m): MethodSuggest => ({
                label: m.name,
                insertText: `${m.name}()`,
                detail: 'DataClass method',
              })
            )
          return {
            suggestions: [
              ...toSuggestions(DATACLASS_BUILTINS, monaco, range, 0),
              ...toSuggestions(dcMethods, monaco, range, DATACLASS_BUILTINS.length),
            ],
          }
        }

        const word = model.getWordUntilPosition(position).word
        if ((!word || 'ds'.startsWith(word)) && /(?:^|[\s([{;,=])d?s?$/.test(before)) {
          return {
            suggestions: [
              {
                label: 'ds',
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: 'ds',
                detail: 'Datastore',
                range,
              },
            ],
          }
        }

        return { suggestions: [] }
      },
    })
  )

  disposables.push(
    monaco.languages.registerSignatureHelpProvider('javascript', {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp(model, position) {
        if (!isTerminalModel(model)) {
          return { value: { signatures: [], activeSignature: 0, activeParameter: 0 }, dispose() {} }
        }
        const before = textBefore(model, position)
        if (/\.query\s*\([^)]*$/.test(before)) {
          return {
            value: {
              signatures: [
                {
                  label: 'query(filter: string, ...params: unknown[])',
                  documentation: 'ORDA-style query mapped to REST $filter / $params',
                  parameters: [
                    { label: 'filter', documentation: 'ORDA query string (e.g. "ID > :1")' },
                    { label: '...params', documentation: 'Values for :1, :2, … placeholders' },
                  ],
                },
              ],
              activeSignature: 0,
              activeParameter: before.includes(',') ? 1 : 0,
            },
            dispose() {},
          }
        }
        if (/\.(?:get|entity)\s*\([^)]*$/.test(before)) {
          return {
            value: {
              signatures: [
                {
                  label: 'get/entity(key: string | number)',
                  documentation: 'Target a single entity by primary key',
                  parameters: [{ label: 'key' }],
                },
              ],
              activeSignature: 0,
              activeParameter: 0,
            },
            dispose() {},
          }
        }
        if (/\.sel\s*\([^)]*$/.test(before)) {
          return {
            value: {
              signatures: [
                {
                  label: 'sel(entitySetId: string)',
                  documentation: 'Target a server entity set / selection',
                  parameters: [{ label: 'entitySetId' }],
                },
              ],
              activeSignature: 0,
              activeParameter: 0,
            },
            dispose() {},
          }
        }
        return { value: { signatures: [], activeSignature: 0, activeParameter: 0 }, dispose() {} }
      },
    })
  )

  return () => {
    for (const d of disposables) d.dispose()
    lsCache.clear()
  }
}
