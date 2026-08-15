export type QueryExplainAccess = 'index' | 'sequential' | 'join' | 'filter' | 'operator' | 'unknown'

export type QueryExplainKind = 'plan' | 'path'

export type QueryExplainJoinOn = {
  left: string
  right: string
}

export type QueryExplainPredicate = {
  attribute: string
  operator: string
  value: string
}

export type QueryExplainNode = {
  id: string
  kind: QueryExplainKind
  access: QueryExplainAccess
  /** Original 4D description. */
  label: string
  /** Short heading, e.g. table name. */
  title: string
  table?: string
  tableInstance?: string
  joinOn?: QueryExplainJoinOn
  predicate?: QueryExplainPredicate
  timeMs?: number
  recordsFound?: number
  children: QueryExplainNode[]
}

export type QueryExplainPayload = {
  requested: boolean
  plan: unknown | null
  path: unknown | null
}

export type QueryExplainSummary = {
  timeMs: number | null
  recordsFound: number | null
  indexCount: number
  sequentialCount: number
  joinCount: number
  stepCount: number
}
