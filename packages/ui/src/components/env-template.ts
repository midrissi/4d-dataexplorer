/** Matches `{{var_name}}` — key is non-empty, no nested braces. */
export const ENV_TEMPLATE_RE = /\{\{([^{}]+)\}\}/g

export type EnvTemplateSegment =
  | { kind: 'text'; text: string; offset: number }
  | { kind: 'variable'; key: string; raw: string; offset: number }

/** Split text into plain text and `{{var}}` segments (for UI highlighting). */
export function parseEnvTemplateSegments(text: string): EnvTemplateSegment[] {
  if (!text) return [{ kind: 'text', text: '', offset: 0 }]
  const segments: EnvTemplateSegment[] = []
  let lastIndex = 0
  const re = new RegExp(ENV_TEMPLATE_RE.source, 'g')
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, index), offset: lastIndex })
    }
    const key = match[1]?.trim() ?? ''
    segments.push({ kind: 'variable', key, raw: match[0], offset: index })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex), offset: lastIndex })
  }
  if (segments.length === 0) return [{ kind: 'text', text, offset: 0 }]
  return segments
}

export type EnvVarLookup = {
  value: string
  scopeLabel: string
  scopeColor?: string
  secret?: boolean
  unresolved?: boolean
  /** Postman-style `{{$timestamp}}` — generated at resolve time; not writable. */
  dynamic?: boolean
}
