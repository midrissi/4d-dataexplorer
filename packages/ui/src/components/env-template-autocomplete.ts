/** Suggestion shown while typing `{{…` in templated fields. */
export type EnvTemplateSuggestion = {
  /** Variable key without braces (e.g. `baseUrl` or `$timestamp`). */
  key: string
  /** Secondary text (value preview or description). */
  detail?: string
  /** Group key for section headers. */
  group?: string
}

export type EnvTemplateMatch = {
  /** Index of the opening `{{`. */
  braceStart: number
  /** Text after `{{` up to the cursor. */
  prefix: string
  /** Cursor index within `text`. */
  cursor: number
}

/**
 * If the cursor sits inside an unfinished `{{…` token, return the match.
 * Does not match after a closing `}}` on the same token.
 */
export function getEnvTemplateMatch(text: string, cursor: number): EnvTemplateMatch | null {
  const safeCursor = Math.max(0, Math.min(cursor, text.length))
  const before = text.slice(0, safeCursor)
  const match = before.match(/\{\{([^{}\n]*)$/)
  if (!match || match.index === undefined) return null
  return {
    braceStart: match.index,
    prefix: match[1] ?? '',
    cursor: safeCursor,
  }
}

/** Filter suggestions by the in-progress `{{query` (substring match, prefix-first). */
export function filterEnvTemplateSuggestions(
  suggestions: readonly EnvTemplateSuggestion[],
  prefix: string
): EnvTemplateSuggestion[] {
  const q = prefix.trim().toLowerCase()
  if (!q) return [...suggestions]

  const starts: EnvTemplateSuggestion[] = []
  const contains: EnvTemplateSuggestion[] = []
  for (const item of suggestions) {
    const key = item.key.toLowerCase()
    if (key.startsWith(q)) starts.push(item)
    else if (key.includes(q)) contains.push(item)
  }
  return [...starts, ...contains]
}

/**
 * Replace the unfinished `{{prefix` at the cursor with `{{key}}`.
 * If `}}` already follows the cursor, it is consumed.
 */
export function applyEnvTemplateCompletion(
  text: string,
  cursor: number,
  key: string
): { value: string; cursor: number } {
  const match = getEnvTemplateMatch(text, cursor)
  const insert = `{{${key}}}`
  if (!match) {
    const value = `${text.slice(0, cursor)}${insert}${text.slice(cursor)}`
    return { value, cursor: cursor + insert.length }
  }
  const after = text.slice(match.cursor)
  const closeLen = after.startsWith('}}') ? 2 : 0
  const value = `${text.slice(0, match.braceStart)}${insert}${text.slice(match.cursor + closeLen)}`
  return { value, cursor: match.braceStart + insert.length }
}
