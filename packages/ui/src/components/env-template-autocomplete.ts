/** Suggestion shown while typing `{{…` in templated fields. */
export type EnvTemplateSuggestion = {
  /** Variable key without braces (e.g. `baseUrl` or `$timestamp`). */
  key: string
  /** Secondary text (value preview or description). */
  detail?: string
  /** Optional generated sample value, shown by wide autocomplete lists. */
  example?: string
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
  { key: 'hash', detail: 'hash:md5|sha1|sha256|sha384|sha512', group: 'filter' },
  { key: 'female', detail: 'Female name (dynamics)', group: 'filter' },
  { key: 'male', detail: 'Male name (dynamics)', group: 'filter' },
  { key: 'min', detail: 'min:n (number dynamics)', group: 'filter' },
  { key: 'max', detail: 'max:n (number dynamics)', group: 'filter' },
  { key: 'between', detail: 'between:a,b (number or date)', group: 'filter' },
  { key: 'after', detail: 'after:YYYY-MM-DD (date dynamics)', group: 'filter' },
  { key: 'before', detail: 'before:YYYY-MM-DD (date dynamics)', group: 'filter' },
  { key: 'from', detail: 'from:a,b,c | $lists.name | ds.Class.Attr', group: 'filter' },
  { key: 'of', detail: 'of:$faker.path (repeat/uniqueArray)', group: 'filter' },
  { key: 'count', detail: 'count:n | count:min,max | count:>=n | count:<=n', group: 'filter' },
  { key: 'top', detail: 'top:n (max distinct for from:ds.Class.Attr)', group: 'filter' },
  { key: 'entityset', detail: 'entityset:id (scope from:ds.Class.Attr)', group: 'filter' },
  { key: 'dims', detail: 'dims:n (vector dimensions)', group: 'filter' },
  { key: 'normalize', detail: 'L2-normalize ($vector)', group: 'filter' },
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

/**
 * When typing `|filter:arg` (or `|filter:a,b,<partial>`), return the filter name
 * and the current arg segment under the cursor.
 */
export function getEnvTemplateFilterArgContext(
  prefix: string
): { filterName: string; argQuery: string; argStartInPrefix: number } | null {
  const pipe = prefix.lastIndexOf('|')
  if (pipe === -1) return null
  const after = prefix.slice(pipe + 1)
  const colon = after.indexOf(':')
  if (colon === -1) return null
  const filterName = after.slice(0, colon).trim().toLowerCase()
  if (!filterName) return null
  const argsRaw = after.slice(colon + 1)
  const lastComma = argsRaw.lastIndexOf(',')
  const segmentOffset = lastComma === -1 ? 0 : lastComma + 1
  const argQuery = argsRaw.slice(segmentOffset).trimStart()
  const leadingWs = argsRaw.slice(segmentOffset).length - argQuery.length
  return {
    filterName,
    argQuery,
    argStartInPrefix: pipe + 1 + colon + 1 + segmentOffset + leadingWs,
  }
}

/** Filters whose args commonly accept `$lists.<name>` (or `$…` refs). */
function filterAcceptsListsRef(filterName: string): boolean {
  return filterName === 'from' || filterName === 'of'
}

function rankSuggestions(
  suggestions: readonly EnvTemplateSuggestion[],
  query: string
): EnvTemplateSuggestion[] {
  // Trailing dots are common while typing paths (`$lists.`); strip so `$list.` still
  // matches `$lists.empIds`.
  const q = query.trim().toLowerCase().replace(/\.+$/, '')
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

/** Filter suggestions by the in-progress `{{query` (variables, `| filters`, or `$lists` args). */
export function filterEnvTemplateSuggestions(
  suggestions: readonly EnvTemplateSuggestion[],
  prefix: string
): EnvTemplateSuggestion[] {
  const pipe = prefix.lastIndexOf('|')
  if (pipe !== -1) {
    if (isEnvTemplateFilterPrefix(prefix)) {
      const query = prefix.slice(pipe + 1)
      return rankSuggestions(ENV_TEMPLATE_FILTER_SUGGESTIONS, query)
    }

    const argCtx = getEnvTemplateFilterArgContext(prefix)
    if (argCtx && filterAcceptsListsRef(argCtx.filterName)) {
      const q = argCtx.argQuery.toLowerCase()
      // `ds.…` → inline `ds.Dataclass.Attribute` direct-load refs.
      if (q.startsWith('ds')) {
        const dsSuggestions = suggestions.filter((item) => item.key.startsWith('ds.'))
        return rankSuggestions(dsSuggestions, q)
      }
      // Empty or `$…` → offer declared/loaded `$lists.*` names.
      if (q === '' || q.startsWith('$')) {
        const listSuggestions = suggestions.filter((item) => item.key.startsWith('$lists.'))
        return rankSuggestions(listSuggestions, q)
      }
    }
    return []
  }

  // Top level: inline `ds.*` refs only resolve inside `from:` / `of:` args — hide them here.
  return rankSuggestions(
    suggestions.filter((item) => !item.key.startsWith('ds.')),
    prefix
  )
}

/**
 * Replace the unfinished `{{prefix` at the cursor with `{{key}}`,
 * or complete the filter / `$lists` arg after `|` when in those modes.
 * If `}}` already follows the cursor, it is consumed.
 * Cursor is left just before the closing `}}` so the user can keep typing (e.g. filters).
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
    return { value, cursor: cursor + 2 + key.length }
  }

  const after = text.slice(match.cursor)
  const closeLen = after.startsWith('}}') ? 2 : 0
  const pipe = match.prefix.lastIndexOf('|')

  if (pipe !== -1 && isEnvTemplateFilterPrefix(match.prefix)) {
    // Complete only the filter after the last `|`; keep key + prior filters.
    const pipeAbs = match.braceStart + 2 + pipe
    const value = `${text.slice(0, pipeAbs + 1)}${key}}}${text.slice(match.cursor + closeLen)}`
    return { value, cursor: pipeAbs + 1 + key.length }
  }

  const argCtx = pipe !== -1 ? getEnvTemplateFilterArgContext(match.prefix) : null
  if (argCtx && (key.startsWith('$lists.') || key.startsWith('ds.') || key.startsWith('$'))) {
    // Complete only the current filter arg (`| from:$lists.name` or `| from:ds.Class.Attr`).
    const argAbs = match.braceStart + 2 + argCtx.argStartInPrefix
    const value = `${text.slice(0, argAbs)}${key}}}${text.slice(match.cursor + closeLen)}`
    return { value, cursor: argAbs + key.length }
  }

  const insert = `{{${key}}}`
  const value = `${text.slice(0, match.braceStart)}${insert}${text.slice(match.cursor + closeLen)}`
  return { value, cursor: match.braceStart + 2 + key.length }
}
