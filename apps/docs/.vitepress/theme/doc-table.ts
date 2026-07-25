export type DocTableColumn = {
  key: string
  label: string
  width?: string
  /** Render cell content as keyboard chips */
  kbd?: boolean
  /** Show icons in this column (controls variant) */
  icons?: boolean
}

export type DocTableRow = Record<string, string>

export type DocTableProps = {
  columns: DocTableColumn[]
  rows: DocTableRow[]
  /** Table style preset */
  variant?: 'default' | 'controls' | 'shortcuts' | 'meta'
  caption?: string
}

/** Map control labels to icon ids */
export const CONTROL_ICONS: Record<string, string> = {
  'Sidebar chevron': 'chevron-left',
  'Chord buffer': 'keyboard',
  'Version link': 'tag',
  Sparkles: 'sparkles',
  'Command icon': 'terminal',
  Keyboard: 'keyboard',
  Network: 'network',
  Wrench: 'wrench',
  'Profile badge': 'user',
  Gear: 'settings',
  Languages: 'globe',
  Palette: 'palette',
  'Sun / Moon': 'sun-moon',
}

/** Icons for meta / feature rows (matched on plain label text) */
export const META_ICONS: Record<string, string> = {
  Header: 'layout',
  Sidebar: 'panel-left',
  'Tab bar': 'tabs',
  Footer: 'dock',
  'Entity list': 'rows',
  'Query bar': 'filter',
  'Entity viewer': 'eye',
  Form: 'form',
  Tree: 'git-branch',
  JSON: 'braces',
  Edit: 'pencil',
  Save: 'save',
  'Cancel edit': 'x-circle',
  Duplicate: 'copy',
  Delete: 'trash',
  'Auto-organize': 'layout-grid',
  'Show all relations': 'network',
  'Selected relations only': 'focus',
  'Hide relations': 'eye-off',
  Filter: 'filter',
  'Order by': 'sort',
  Attributes: 'columns',
  'Top / Limit': 'hash',
  'Entity set ID': 'link',
  Parameters: 'sliders',
  'Edit mode': 'pencil',
  'Read only': 'shield',
  'Editor / JSON tabs': 'braces',
  'Generate all': 'sparkles',
  'Missing indicators': 'alert-circle',
  'Export JSON': 'download',
  Version: 'tag',
  URL: 'globe',
  Authentication: 'shield',
}

export function stripMarkdownLabel(value: string): string {
  return value.replace(/\*\*/g, '').replace(/`/g, '').trim()
}

export function metaIconFor(value: string): string {
  const plain = stripMarkdownLabel(value)
  return META_ICONS[plain] ?? 'circle'
}

export type DocTableLayout = 'kv' | 'table'

export function resolveDocTableLayout(
  columns: DocTableColumn[],
  hideHeader: boolean
): DocTableLayout {
  if (hideHeader && columns.length === 2) return 'kv'
  return 'table'
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string }

/** Parse a subset of inline markdown used in doc tables */
export function parseInlineMarkdown(input: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  while (true) {
    const match = pattern.exec(input)
    if (!match) break

    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: input.slice(lastIndex, match.index) })
    }

    const token = match[0]
    if (token.startsWith('**')) {
      segments.push({ type: 'bold', value: token.slice(2, -2) })
    } else if (token.startsWith('`')) {
      segments.push({ type: 'code', value: token.slice(1, -1) })
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        segments.push({ type: 'link', label: linkMatch[1], href: linkMatch[2] })
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: input }]
}

/** Split shortcut strings into groups of kbd tokens (groups separated by "or" / "/") */
export function splitShortcutKeys(shortcut: string): string[][] {
  const alternatives = shortcut.split(/\s+(?:or|\/)\s+/i)

  return alternatives.map((alt) => {
    const backtickMatches = [...alt.matchAll(/`([^`]+)`/g)].map((m) => m[1])
    if (backtickMatches.length > 0) return backtickMatches
    return [alt.trim()]
  })
}
