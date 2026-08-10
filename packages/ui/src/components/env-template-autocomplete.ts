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

/** Built-in pipe filters offered after `{{key | …`. */
export const ENV_TEMPLATE_FILTER_SUGGESTIONS: readonly EnvTemplateSuggestion[] = [
  { key: 'lower', detail: 'Lowercase', group: 'filter' },
  { key: 'upper', detail: 'Uppercase', group: 'filter' },
  { key: 'snake', detail: 'snake_case', group: 'filter' },
  { key: 'camel', detail: 'camelCase', group: 'filter' },
  { key: 'pascal', detail: 'PascalCase', group: 'filter' },
  { key: 'kebab', detail: 'kebab-case', group: 'filter' },
  { key: 'trim', detail: 'Trim whitespace', group: 'filter' },
  { key: 'female', detail: 'Female name (dynamics)', group: 'filter' },
  { key: 'male', detail: 'Male name (dynamics)', group: 'filter' },
  { key: 'min', detail: 'min:n (number dynamics)', group: 'filter' },
  { key: 'max', detail: 'max:n (number dynamics)', group: 'filter' },
  { key: 'between', detail: 'between:a,b (number or date)', group: 'filter' },
  { key: 'after', detail: 'after:YYYY-MM-DD (date dynamics)', group: 'filter' },
  { key: 'before', detail: 'before:YYYY-MM-DD (date dynamics)', group: 'filter' },
  { key: 'from', detail: 'from:a,b,c (pick/sample/unique)', group: 'filter' },
  { key: 'of', detail: 'of:$faker.path (repeat/uniqueArray)', group: 'filter' },
  { key: 'count', detail: 'count:n | count:min,max | count:>=n | count:<=n', group: 'filter' },
]

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

/** True when the unfinished `{{` prefix is typing a pipe filter (after `|`). */
export function isEnvTemplateFilterPrefix(prefix: string): boolean {
  const pipe = prefix.lastIndexOf('|')
  if (pipe === -1) return false
  const after = prefix.slice(pipe + 1)
  // Args (`between:1`) — stop filter-name suggestions.
  return !after.includes(':')
}

function rankSuggestions(
  suggestions: readonly EnvTemplateSuggestion[],
  query: string
): EnvTemplateSuggestion[] {
  const q = query.trim().toLowerCase()
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

/** Filter suggestions by the in-progress `{{query` (variables or `| filters`). */
export function filterEnvTemplateSuggestions(
  suggestions: readonly EnvTemplateSuggestion[],
  prefix: string
): EnvTemplateSuggestion[] {
  const pipe = prefix.lastIndexOf('|')
  if (pipe !== -1) {
    if (!isEnvTemplateFilterPrefix(prefix)) return []
    const query = prefix.slice(pipe + 1)
    return rankSuggestions(ENV_TEMPLATE_FILTER_SUGGESTIONS, query)
  }

  return rankSuggestions(suggestions, prefix)
}

/**
 * Replace the unfinished `{{prefix` at the cursor with `{{key}}`,
 * or complete the filter after `|` when in filter mode.
 * If `}}` already follows the cursor, it is consumed.
 */
export function applyEnvTemplateCompletion(
  text: string,
  cursor: number,
  key: string
): { value: string; cursor: number } {
  const match = getEnvTemplateMatch(text, cursor)
  if (!match) {
    const insert = `{{${key}}}`
    const value = `${text.slice(0, cursor)}${insert}${text.slice(cursor)}`
    return { value, cursor: cursor + insert.length }
  }

  const after = text.slice(match.cursor)
  const closeLen = after.startsWith('}}') ? 2 : 0
  const pipe = match.prefix.lastIndexOf('|')

  if (pipe !== -1 && isEnvTemplateFilterPrefix(match.prefix)) {
    // Complete only the filter after the last `|`; keep key + prior filters.
    const pipeAbs = match.braceStart + 2 + pipe
    const value = `${text.slice(0, pipeAbs + 1)}${key}}}${text.slice(match.cursor + closeLen)}`
    return { value, cursor: pipeAbs + 1 + key.length + 2 }
  }

  const insert = `{{${key}}}`
  const value = `${text.slice(0, match.braceStart)}${insert}${text.slice(match.cursor + closeLen)}`
  return { value, cursor: match.braceStart + insert.length }
}
