import type { Environment, EnvironmentsBlock, EnvVariable } from './types'

/** Preset swatches for environment color chips (~30). */
export const ENVIRONMENT_COLORS = [
  '#38bdf8',
  '#0ea5e9',
  '#0284c7',
  '#f59e0b',
  '#f97316',
  '#ea580c',
  '#a78bfa',
  '#8b5cf6',
  '#7c3aed',
  '#34d399',
  '#10b981',
  '#059669',
  '#f472b6',
  '#ec4899',
  '#db2777',
  '#fb7185',
  '#f43f5e',
  '#e11d48',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#22d3ee',
  '#14b8a6',
  '#84cc16',
  '#eab308',
  '#ef4444',
  '#d946ef',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
] as const

export function createEnvironmentId(): string {
  return `env-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createVariableId(): string {
  return `var-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Prefer the first unused preset; cycle when every preset is already taken. */
export function nextEnvironmentColor(
  usedColors: readonly (string | undefined | null)[] = []
): string {
  const used = new Set(
    usedColors.filter((color): color is string => typeof color === 'string' && color.length > 0)
  )
  for (const color of ENVIRONMENT_COLORS) {
    if (!used.has(color)) return color
  }
  const fallback = ENVIRONMENT_COLORS[used.size % ENVIRONMENT_COLORS.length]
  return fallback ?? ENVIRONMENT_COLORS[0]
}

/** Next "New Environment 1", "New Environment 2", … based on existing names. */
export function nextNewEnvironmentName(existingNames: readonly string[], baseName: string): string {
  const trimmedBase = baseName.trim() || 'New Environment'
  const escaped = trimmedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const numbered = new RegExp(`^${escaped}\\s+(\\d+)$`, 'i')
  const used = new Set<number>()
  for (const name of existingNames) {
    const trimmed = name.trim()
    if (trimmed.toLowerCase() === trimmedBase.toLowerCase()) {
      used.add(1)
      continue
    }
    const match = trimmed.match(numbered)
    if (match?.[1]) used.add(Number(match[1]))
  }
  let n = 1
  while (used.has(n)) n += 1
  return `${trimmedBase} ${n}`
}

/** Assign preset colors to any environments that are missing one. */
export function ensureEnvironmentColors(environments: Environment[]): Environment[] {
  const used: string[] = []
  for (const env of environments) {
    if (env.color) used.push(env.color)
  }
  let changed = false
  const next = environments.map((env) => {
    if (env.color) return env
    const color = nextEnvironmentColor(used)
    used.push(color)
    changed = true
    return { ...env, color }
  })
  return changed ? next : environments
}

export function createEmptyVariable(): EnvVariable {
  return {
    id: createVariableId(),
    key: '',
    value: '',
    initialValue: '',
    type: 'default',
    enabled: true,
  }
}

export function createEmptyEnvironment(
  name = 'New Environment',
  usedColors: readonly (string | undefined | null)[] = []
): Environment {
  return {
    id: createEnvironmentId(),
    name,
    color: nextEnvironmentColor(usedColors),
    variables: [createEmptyVariable()],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeVariable(raw: unknown): EnvVariable | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' && raw.id ? raw.id : createVariableId()
  const key = typeof raw.key === 'string' ? raw.key : ''
  const value = typeof raw.value === 'string' ? raw.value : ''
  const initialValue =
    typeof raw.initialValue === 'string'
      ? raw.initialValue
      : typeof raw.initial === 'string'
        ? raw.initial
        : value
  const type = raw.type === 'secret' ? 'secret' : 'default'
  const enabled = raw.enabled !== false
  return { id, key, value, initialValue, type, enabled }
}

function normalizeEnvironment(raw: unknown): Environment | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' && raw.id ? raw.id : createEnvironmentId()
  const rawName = typeof raw.name === 'string' ? raw.name : ''
  // Keep spaces while typing ("env " → "env 2"); only fall back when blank.
  const name = rawName.trim() ? rawName : 'Untitled'
  const color = typeof raw.color === 'string' ? raw.color : undefined
  const variablesRaw = Array.isArray(raw.variables) ? raw.variables : []
  const variables = variablesRaw.map(normalizeVariable).filter((v): v is EnvVariable => v !== null)
  return { id, name, color, variables }
}

/** Normalize a persisted environments block from profile or base settings. */
export function normalizeEnvironmentsBlock(raw: unknown): EnvironmentsBlock {
  if (!isRecord(raw)) {
    return { environments: [], activeEnvironmentId: null }
  }
  const list = Array.isArray(raw.environments) ? raw.environments : Array.isArray(raw) ? raw : []
  const environments = ensureEnvironmentColors(
    list.map(normalizeEnvironment).filter((e): e is Environment => e !== null)
  )
  const activeRaw = raw.activeEnvironmentId
  const activeEnvironmentId =
    typeof activeRaw === 'string' && environments.some((e) => e.id === activeRaw) ? activeRaw : null
  return { environments, activeEnvironmentId }
}

export function cloneEnvironment(
  env: Environment,
  name?: string,
  usedColors: readonly (string | undefined | null)[] = []
): Environment {
  return {
    id: createEnvironmentId(),
    name: name ?? `${env.name} (copy)`,
    color: nextEnvironmentColor([...usedColors, env.color]),
    variables: env.variables.map((variable) => ({ ...variable })),
  }
}

export function resetVariablesToInitial(variables: readonly EnvVariable[]): EnvVariable[] {
  return variables.map((variable) => ({
    ...variable,
    value: variable.initialValue ?? variable.value,
  }))
}

/** Export shape for import/export JSON. */
export type EnvironmentsExport = {
  version: 1
  scope?: 'profile' | 'base' | 'globals'
  environments?: Environment[]
  globals?: EnvVariable[]
  activeEnvironmentId?: string | null
}

export function parseEnvironmentsImport(raw: unknown): EnvironmentsExport | null {
  if (!isRecord(raw)) return null
  const version = raw.version === 1 ? 1 : 1
  const scope =
    raw.scope === 'profile' || raw.scope === 'base' || raw.scope === 'globals'
      ? raw.scope
      : undefined
  const environments = Array.isArray(raw.environments)
    ? ensureEnvironmentColors(
        raw.environments.map(normalizeEnvironment).filter((e): e is Environment => e !== null)
      )
    : undefined
  const globals = Array.isArray(raw.globals)
    ? raw.globals.map(normalizeVariable).filter((v): v is EnvVariable => v !== null)
    : undefined
  const activeEnvironmentId =
    typeof raw.activeEnvironmentId === 'string' ? raw.activeEnvironmentId : null
  if (!environments?.length && !globals?.length) return null
  return { version, scope, environments, globals, activeEnvironmentId }
}
