import { resolveDynamicEnvVar } from './dynamic'
import { HELPER_TEMPLATE_DEFS, isHelperTemplateKey } from './template-helpers'
import type { Environment, EnvScope, EnvVariable, EnvVarLookup } from './types'

/**
 * Runtime value for a variable: prefer current; fall back to initial when current is empty
 * (matches Postman: newly filled Initial often leaves Current blank until synced).
 */
export function effectiveEnvValue(variable: EnvVariable): string {
  if (variable.value !== '') return variable.value
  return variable.initialValue ?? ''
}

/** Build a key→value map from a variable list (enabled only; last key wins). */
export function variablesToMap(variables: readonly EnvVariable[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const variable of variables) {
    if (!variable.enabled) continue
    const key = variable.key.trim()
    if (!key) continue
    map.set(key, effectiveEnvValue(variable))
  }
  return map
}

export type ActiveEnvLayers = {
  globals: readonly EnvVariable[]
  profileEnv: Environment | null
  baseEnv: Environment | null
}

/**
 * Merge layers with priority: base → profile → globals (first hit wins when reading).
 * Returns a Map suitable for `resolveEnvTemplates`.
 */
export function mergeActiveEnvMap(layers: ActiveEnvLayers): Map<string, string> {
  const merged = new Map<string, string>()
  // Lowest priority first so higher layers overwrite.
  for (const [key, value] of variablesToMap(layers.globals)) {
    merged.set(key, value)
  }
  if (layers.profileEnv) {
    for (const [key, value] of variablesToMap(layers.profileEnv.variables)) {
      merged.set(key, value)
    }
  }
  if (layers.baseEnv) {
    for (const [key, value] of variablesToMap(layers.baseEnv.variables)) {
      merged.set(key, value)
    }
  }
  return merged
}

export type ScopeLabels = {
  global: string
  profile: string
  base: string
  dynamic?: string
}

/**
 * Look up a variable with scope metadata for UI chips.
 * Priority: base → profile → globals → dynamic (`$…`).
 */
export function lookupEnvVariable(
  key: string,
  layers: ActiveEnvLayers,
  labels: ScopeLabels
): EnvVarLookup {
  const trimmed = key.trim()
  if (!trimmed) {
    return {
      value: '',
      scope: 'global',
      scopeLabel: labels.global,
      unresolved: true,
    }
  }

  const findIn = (
    variables: readonly EnvVariable[],
    scope: EnvScope,
    scopeLabel: string,
    scopeColor?: string
  ): EnvVarLookup | null => {
    for (let i = variables.length - 1; i >= 0; i--) {
      const variable = variables[i]
      if (!variable.enabled) continue
      if (variable.key.trim() !== trimmed) continue
      return {
        value: effectiveEnvValue(variable),
        scope,
        scopeLabel,
        scopeColor,
        secret: variable.type === 'secret',
        unresolved: false,
      }
    }
    return null
  }

  if (layers.baseEnv) {
    const hit = findIn(layers.baseEnv.variables, 'base', labels.base, layers.baseEnv.color)
    if (hit) return hit
  }
  if (layers.profileEnv) {
    const hit = findIn(
      layers.profileEnv.variables,
      'profile',
      labels.profile,
      layers.profileEnv.color
    )
    if (hit) return hit
  }
  const globalHit = findIn(layers.globals, 'global', labels.global)
  if (globalHit) return globalHit

  const dynamicValue = resolveDynamicEnvVar(trimmed)
  if (dynamicValue !== undefined) {
    return {
      value: dynamicValue,
      scope: 'dynamic',
      scopeLabel: labels.dynamic ?? 'Dynamic',
      unresolved: false,
      dynamic: true,
    }
  }

  if (isHelperTemplateKey(trimmed)) {
    const def = HELPER_TEMPLATE_DEFS.find((item) => item.key === trimmed)
    return {
      value: def?.description ?? 'Helper template',
      scope: 'dynamic',
      scopeLabel: labels.dynamic ?? 'Dynamic',
      unresolved: false,
      dynamic: true,
    }
  }

  return {
    value: '',
    scope: 'global',
    scopeLabel: labels.global,
    unresolved: true,
  }
}

export function findEnvironmentById(
  environments: readonly Environment[],
  id: string | null | undefined
): Environment | null {
  if (!id) return null
  return environments.find((env) => env.id === id) ?? null
}

export function findEnvironmentByName(
  environments: readonly Environment[],
  name: string
): Environment | null {
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null
  return environments.find((env) => env.name.trim().toLowerCase() === trimmed) ?? null
}
