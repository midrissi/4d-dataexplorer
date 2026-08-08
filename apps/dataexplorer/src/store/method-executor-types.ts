export type MethodScope = 'catalog' | 'dataclass' | 'entity' | 'entitySelection'

export type CustomRuntimeArgument = {
  id: string
  kind: 'custom'
  name?: string
  sourceType?: string
  value: string
}

export type StringRuntimeArgument = {
  id: string
  kind: 'string'
  name?: string
  sourceType?: string
  value: string
}

export type NumberRuntimeArgument = {
  id: string
  kind: 'number'
  name?: string
  sourceType?: string
  /** Digits as typed in the input; parsed when serializing. */
  value: string
}

export type BooleanRuntimeArgument = {
  id: string
  kind: 'boolean'
  name?: string
  sourceType?: string
  value: boolean
}

export type DateRuntimeArgument = {
  id: string
  kind: 'date'
  name?: string
  sourceType?: string
  /** ISO calendar date (`YYYY-MM-DD`) for `<input type="date">`. */
  value: string
}

export type EntityRuntimeArgument = {
  id: string
  kind: 'entity'
  name?: string
  sourceType?: string
  dataClass: string
  key: string
}

export type EntitySelectionRuntimeArgument = {
  id: string
  kind: 'entitysel'
  name?: string
  sourceType?: string
  dataClass: string
  entitySetId: string
}

export type RuntimeArgument =
  | CustomRuntimeArgument
  | StringRuntimeArgument
  | NumberRuntimeArgument
  | BooleanRuntimeArgument
  | DateRuntimeArgument
  | EntityRuntimeArgument
  | EntitySelectionRuntimeArgument

export type MethodExecutorSeed = {
  scope: MethodScope
  methodName: string
  dataClass?: string
  key?: string | number
  entitySetId?: string
  filter?: string
  orderby?: string
  paramsText?: string
  allowedOnHTTPGET?: boolean
  useGet?: boolean
  arguments?: RuntimeArgument[]
  /**
   * When true, POST body is `{ params: [...], ...wrapper }` using `wrapperText`.
   * Off by default — editor is hidden until enabled.
   */
  wrapperEnabled?: boolean
  /**
   * Optional JSON object text merged into the POST body with `params`
   * (e.g. `{ "foo": "test" }` → `{ "params": [...], "foo": "test" }`).
   */
  wrapperText?: string
}
