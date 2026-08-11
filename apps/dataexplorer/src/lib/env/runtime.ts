import { useEnvironmentsStore } from '~/store/environments'
import { resolveEnvTemplates, resolveEnvTemplatesDeep } from './resolve'
import type { ResolveEnvOptions } from './this-context'

/** Active env map for resolve helpers (call at execution time). */
export function getActiveEnvMap(): Map<string, string> {
  return useEnvironmentsStore.getState().getActiveMap()
}

export function resolveEnvString(
  text: string,
  options?: ResolveEnvOptions
): { text: string; unresolved: string[] } {
  return resolveEnvTemplates(text, getActiveEnvMap(), options)
}

export function resolveEnvDeep<T>(
  value: T,
  options?: ResolveEnvOptions
): { value: T; unresolved: string[] } {
  return resolveEnvTemplatesDeep(value, getActiveEnvMap(), options)
}

/** Merge unresolved key lists uniquely. */
export function mergeUnresolved(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const key of list) {
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

export function warnUnresolvedEnvVars(
  unresolved: readonly string[],
  warn: (message: string) => void,
  format: (keys: string) => string
): void {
  if (!unresolved.length) return
  warn(format(unresolved.join(', ')))
}
