import type * as Monaco from 'monaco-editor'
import { DYNAMIC_ENV_VARS, ENV_TEMPLATE_RE, resolveDynamicEnvVar } from '~/lib/env'
import { getActiveEnvMap } from '~/lib/env/runtime'

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
    const key = match[1]?.trim() ?? ''
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
    const dynamicSample =
      key.length > 0 && mapped === undefined ? resolveDynamicEnvVar(key) : undefined
    const known = mapped !== undefined || dynamicSample !== undefined
    const decoration: Monaco.editor.IModelDeltaDecoration = {
      range,
      options: {
        inlineClassName: known ? 'env-var-token-resolved' : 'env-var-token-unresolved',
        hoverMessage: {
          value:
            mapped !== undefined
              ? `**${key}** = \`${mapped}\``
              : dynamicSample !== undefined
                ? `**${key}** (dynamic) → \`${dynamicSample}\``
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
      for (const item of DYNAMIC_ENV_VARS) {
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
