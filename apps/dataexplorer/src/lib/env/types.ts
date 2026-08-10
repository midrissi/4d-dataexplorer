/** Postman-style environment variable. */
export type EnvVariable = {
  /** Stable row id for React lists (not the variable name). */
  id: string
  key: string
  /** Current (session-editable) value. */
  value: string
  /** Reset target for "reset to initial". */
  initialValue?: string
  type: 'default' | 'secret'
  enabled: boolean
}

/** Named environment (profile-scoped or base-scoped). */
export type Environment = {
  id: string
  name: string
  /** Optional chip color (CSS color or preset key). */
  color?: string
  variables: EnvVariable[]
}

export type EnvScope = 'base' | 'profile' | 'global' | 'dynamic'

/** Resolved lookup for UI chips / hover editors. */
export type EnvVarLookup = {
  value: string
  scope: EnvScope
  scopeLabel: string
  scopeColor?: string
  secret?: boolean
  unresolved?: boolean
  /** Postman-style `{{$timestamp}}` etc. — generated at resolve time. */
  dynamic?: boolean
}

/** Persisted environments block (profile settings or BaseSettings). */
export type EnvironmentsBlock = {
  environments: Environment[]
  activeEnvironmentId: string | null
}
