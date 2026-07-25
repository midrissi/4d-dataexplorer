/** A single `Key: value` property parsed from a raw hover string. */
export interface OrdaHoverEntry {
  key: string
  value: string
}

/** The structured representation of a raw ORDA hover string. */
export interface OrdaHover {
  title: string
  entries: OrdaHoverEntry[]
}

/** Codicon shown beside each property row, keyed by the (lower-cased) property label. */
export const ORDA_HOVER_PROPERTY_ICONS: Record<string, string> = {
  type: 'symbol-class',
  kind: 'symbol-enum',
  indexed: 'search',
  unique: 'star-full',
  'read only': 'lock',
  'primary key': 'key',
  'related dataclass': 'references',
  inverse: 'arrow-swap',
}

/** Escape characters that would otherwise be interpreted as HTML markup. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Parse a raw hover string (a bold title followed by `- Key: value` lines) into a
 * structured {@link OrdaHover}. Returns `null` when the string has no recognisable
 * title/property structure.
 */
export function parseOrdaHover(raw: string): OrdaHover | null {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return null

  const title = lines[0].replace(/^\*\*(.+)\*\*$/, '$1').trim()

  const entries: OrdaHoverEntry[] = []
  for (const line of lines.slice(1)) {
    const match = line.match(/^-\s*([^:]+):\s*(.+)$/)
    if (!match) continue
    entries.push({ key: match[1].trim(), value: match[2].trim() })
  }

  if (entries.length === 0) return null

  return { title, entries }
}

/** Pick a header codicon that reflects the attribute's role (relation / key / scalar). */
export function ordaHoverHeaderIcon(entries: OrdaHoverEntry[]): string {
  const kind = entries.find((entry) => entry.key.toLowerCase() === 'kind')?.value ?? ''
  const isPrimaryKey = entries.some((entry) => entry.key.toLowerCase() === 'primary key')
  if (kind.includes('relatedEntity') || kind.includes('relatedEntities')) return 'references'
  if (isPrimaryKey) return 'key'
  return 'symbol-field'
}

/**
 * Render a raw hover string into themed Monaco markdown: a header with a contextual
 * codicon, a table of properties with per-row icons and themed value badges, and a tip
 * for relations. Falls back to the raw string when it cannot be parsed.
 */
export function formatOrdaHoverMarkdown(raw: string): string {
  const parsed = parseOrdaHover(raw)
  if (!parsed) return raw

  const { title, entries } = parsed
  const kind = entries.find((entry) => entry.key.toLowerCase() === 'kind')?.value
  const related = entries.find((entry) => entry.key.toLowerCase() === 'related dataclass')?.value
  const headerIcon = ordaHoverHeaderIcon(entries)

  const rows = entries.map((entry) => {
    const icon = ORDA_HOVER_PROPERTY_ICONS[entry.key.toLowerCase()] ?? 'circle-small-filled'
    const value = escapeHtml(entry.value.replace(/`/g, ''))
    const badge = `<span style="color:var(--vscode-badge-foreground);background-color:var(--vscode-badge-background);border-radius:4px;">&nbsp;${value}&nbsp;</span>`
    return `| $(${icon})&nbsp; ${entry.key} | ${badge} |`
  })

  const parts = [`$(${headerIcon})&nbsp; **${title}**`, '', '| | |', '| :-- | :-- |', ...rows]

  const isRelation = kind?.includes('relatedEntity')
  if (isRelation && related) {
    const target = related.replace(/`/g, '')
    parts.push('', '---', '', `$(lightbulb)&nbsp; Type \`.\` to explore **${target}** attributes`)
  }

  return parts.join('\n')
}
