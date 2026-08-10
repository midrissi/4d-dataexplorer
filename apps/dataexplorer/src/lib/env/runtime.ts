import { resolveEnvTemplates, resolveEnvTemplatesDeep } from '~/lib/env'
import { useEnvironmentsStore } from '~/store/environments'

/** Active env map for resolve helpers (call at execution time). */
export function getActiveEnvMap(): Map<string, string> {
  return useEnvironmentsStore.getState().getActiveMap()
}

export function resolveEnvString(text: string): { text: string; unresolved: string[] } {
  return resolveEnvTemplates(text, getActiveEnvMap())
}

export function resolveEnvDeep<T>(value: T): { value: T; unresolved: string[] } {
  return resolveEnvTemplatesDeep(value, getActiveEnvMap())
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
