import { parseTemplateExpression } from '@4d/ui'
import type * as Monaco from 'monaco-editor'
import {
  ENV_TEMPLATE_RE,
  HELPER_TEMPLATE_DEFS,
  isHelperTemplateKey,
  listAllDynamicEnvVarDefs,
  resolveDynamicEnvVar,
  resolveHelperTemplate,
} from '~/lib/env'
import { getActiveEnvMap } from '~/lib/env/runtime'
import { isThisTemplateKey } from '~/lib/env/this-context'

const DECORATION_KEY = 'env-template-decorations'

/**
 * Apply Monaco decorations for `{{var}}` tokens (resolved vs unresolved).
 * Call from editor onDidChangeModelContent / on mount.
 */
export function applyEnvTemplateDecorations(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
): string[] {
  const model = editor.getModel()
  if (!model) return []
  const text = model.getValue()
  const map = getActiveEnvMap()
  const resolved: Monaco.editor.IModelDeltaDecoration[] = []
  const unresolved: Monaco.editor.IModelDeltaDecoration[] = []
  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  for (const match of text.matchAll(re)) {
    const raw = match[0]
    const expr = parseTemplateExpression(match[1] ?? '')
    const key = expr?.key ?? ''
    const filters = expr?.filters ?? []
    const filterHint =
      filters.length > 0
        ? ` · filters: ${filters.map((f) => (f.args.length ? `${f.name}:${f.args.join(',')}` : f.name)).join(' | ')}`
        : ''
    const start = match.index ?? 0
    const end = start + raw.length
    const startPos = model.getPositionAt(start)
    const endPos = model.getPositionAt(end)
    const range = new monaco.Range(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    )
    const mapped = key.length > 0 ? map.get(key) : undefined
    const helperSample =
      key.length > 0 && mapped === undefined && isHelperTemplateKey(key)
        ? resolveHelperTemplate(key, filters)
        : null
    const dynamicSample =
      key.length > 0 && mapped === undefined && !helperSample
        ? resolveDynamicEnvVar(key)
        : undefined
    const known =
      mapped !== undefined ||
      dynamicSample !== undefined ||
      helperSample !== null ||
      isThisTemplateKey(key)
    const decoration: Monaco.editor.IModelDeltaDecoration = {
      range,
      options: {
        inlineClassName: known ? 'env-var-token-resolved' : 'env-var-token-unresolved',
        hoverMessage: {
          value:
            mapped !== undefined
              ? `**${key}** = \`${mapped}\`${filterHint}`
              : helperSample
                ? `**${key}** (helper) → \`${helperSample.text}\`${filterHint}`
                : dynamicSample !== undefined
                  ? `**${key}** (dynamic) → \`${dynamicSample}\`${filterHint}\n\nTip: pipe filters e.g. \`{{$faker.number.int | between:1,100}}\`, \`{{$faker.person.firstName | hash:md5}}\`, \`{{$this.path}}\`, \`{{$pick | from:a,b}}\`, \`{{$vector | dims:8}}\`, \`{{$object | name:$faker.person.fullName}}\``
                  : isThisTemplateKey(key)
                    ? `**${key}** — call-site context (\`$this\` / \`$this.field\`)`
                    : `Unresolved variable **${key || raw}**`,
        },
      },
    }
    if (known) resolved.push(decoration)
    else unresolved.push(decoration)
  }
  const ids = editor.deltaDecorations(
    (editor as unknown as { [DECORATION_KEY]?: string[] })[DECORATION_KEY] ?? [],
    [...resolved, ...unresolved]
  )
  ;(editor as unknown as { [DECORATION_KEY]?: string[] })[DECORATION_KEY] = ids
  return ids
}

/** Register a completion provider that suggests env keys after `{{`. */
export function registerEnvTemplateCompletionProvider(
  monaco: typeof Monaco,
  languageId = 'json'
): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: ['{', '$'],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber)
      const before = line.slice(0, position.column - 1)
      if (!before.endsWith('{{') && !/\{\{[\w.$-]*$/.test(before)) {
        return { suggestions: [] }
      }
      const map = getActiveEnvMap()
      const wordMatch = before.match(/\{\{([\w.$-]*)$/)
      const prefix = wordMatch?.[1] ?? ''
      const startCol = position.column - prefix.length
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: startCol,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      }
      const suggestions: Monaco.languages.CompletionItem[] = []
      const seen = new Set<string>()
      for (const key of map.keys()) {
        if (prefix && !key.startsWith(prefix)) continue
        seen.add(key)
        suggestions.push({
          label: key,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: key,
          detail: map.get(key),
          range,
          sortText: `0-${key}`,
        })
      }
      for (const item of HELPER_TEMPLATE_DEFS) {
        if (prefix && !item.key.startsWith(prefix)) continue
        if (seen.has(item.key)) continue
        seen.add(item.key)
        suggestions.push({
          label: item.key,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: item.key,
          detail: item.description,
          range,
          sortText: `0.5-${item.key}`,
        })
      }
      if (!prefix || '$this'.startsWith(prefix) || prefix.startsWith('$this')) {
        if (!seen.has('$this')) {
          seen.add('$this')
          suggestions.push({
            label: '$this',
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: '$this',
            detail: 'Call-site context root',
            range,
            sortText: '0.4-$this',
          })
        }
      }
      for (const item of listAllDynamicEnvVarDefs()) {
        if (prefix && !item.key.startsWith(prefix)) continue
        if (seen.has(item.key)) continue
        suggestions.push({
          label: item.key,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: item.key,
          detail: item.description,
          range,
          sortText: `1-${item.key}`,
        })
      }
      return { suggestions }
    },
  })
}
