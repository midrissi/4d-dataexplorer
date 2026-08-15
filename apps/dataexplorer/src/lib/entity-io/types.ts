/** Context passed to format serialize/parse. */
export type EntityIoContext = {
  dataclassName: string
  /** Column order for tabular formats. */
  columns?: string[]
}

export type EntityIoCapabilities = {
  export: boolean
  import: boolean
}

export type EntityIoFormatId =
  | 'json'
  | 'json-rest'
  | 'jsonl'
  | 'csv'
  | 'tsv'
  | 'sql'
  | 'xml'
  | 'yaml'
  | 'markdown'
  | 'html'

export type EntityIoFormat = {
  id: EntityIoFormatId
  /** File extensions without dot (e.g. `['json']`). */
  extensions: string[]
  mime: string
  /** Monaco language id used to highlight previews of this format. */
  language: string
  capabilities: EntityIoCapabilities
  serialize: (rows: Record<string, unknown>[], ctx: EntityIoContext) => string
  parse?: (text: string, ctx: EntityIoContext) => Record<string, unknown>[]
}

/** Attribute summary used for export/anonymize column pickers. */
export type EntityIoAttribute = {
  name: string
  type: string
  kind?: string
  readOnly?: boolean
  autosequence?: boolean
  unique?: boolean
}
