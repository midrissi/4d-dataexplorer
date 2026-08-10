import type { Environment } from '~/lib/env'
import { effectiveEnvValue } from '~/lib/env/merge-active'
import { useEnvironmentsStore } from '~/store/environments'

type EnvScopeBag = {
  get(key: string): string | undefined
  set(key: string, value: string): boolean
  remove(key: string): boolean
  clear(): boolean
  list(): Record<string, string>
}

function listEnvironmentVariables(env: Environment | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!env) return out
  for (const variable of env.variables) {
    if (!variable.enabled) continue
    const key = variable.key.trim()
    if (!key) continue
    out[key] = effectiveEnvValue(variable)
  }
  return out
}

function createScopedEnvBag(scope: 'profile' | 'base'): EnvScopeBag {
  const store = () => useEnvironmentsStore.getState()
  const activeEnv = () => {
    const layers = store().getLayers()
    return scope === 'base' ? layers.baseEnv : layers.profileEnv
  }

  return {
    get(key: string): string | undefined {
      const trimmed = key.trim()
      const env = activeEnv()
      if (!env) return undefined
      const hit = env.variables.find(
        (variable) => variable.enabled && variable.key.trim() === trimmed
      )
      if (!hit) return undefined
      return effectiveEnvValue(hit)
    },
    set(key: string, value: string): boolean {
      const trimmed = key.trim()
      if (!trimmed) return false
      return store().setScopedVariable(scope, trimmed, String(value))
    },
    remove(key: string): boolean {
      const trimmed = key.trim()
      if (!trimmed) return false
      return store().removeScopedVariable(scope, trimmed)
    },
    clear(): boolean {
      return store().clearScopedVariables(scope)
    },
    list(): Record<string, string> {
      return listEnvironmentVariables(activeEnv())
    },
  }
}

/**
 * Terminal `app` facade — environment get/set and related helpers.
 */
export function createAppApi() {
  const store = () => useEnvironmentsStore.getState()

  return {
    environment: {
      get(key: string): string | undefined {
        const map = store().getActiveMap()
        return map.get(key.trim())
      },
      set(key: string, value: string): boolean {
        const trimmed = key.trim()
        if (!trimmed) return false
        if (store().setActiveVariable(trimmed, String(value))) return true
        store().updateGlobalVariable(trimmed, String(value))
        return true
      },
      remove(key: string): boolean {
        const trimmed = key.trim()
        if (!trimmed) return false
        if (store().removeActiveVariable(trimmed)) return true
        store().removeGlobalVariable(trimmed)
        return true
      },
      clear(): boolean {
        if (store().clearActiveVariables()) return true
        store().clearGlobals()
        return true
      },
      list(): Record<string, string> {
        return Object.fromEntries(store().getActiveMap())
      },
      use(name: string, scope?: 'base' | 'profile'): boolean {
        return store().activateEnvironmentByName(name, scope)
      },
      getActive(): {
        profile: { id: string; name: string } | null
        base: { id: string; name: string } | null
      } {
        const layers = store().getLayers()
        return {
          profile: layers.profileEnv
            ? { id: layers.profileEnv.id, name: layers.profileEnv.name }
            : null,
          base: layers.baseEnv ? { id: layers.baseEnv.id, name: layers.baseEnv.name } : null,
        }
      },
      /** Active profile environment variables. */
      profile: createScopedEnvBag('profile'),
      /** Active database (base) environment variables. */
      base: createScopedEnvBag('base'),
      globals: {
        get(key: string): string | undefined {
          const trimmed = key.trim()
          const hit = store().globals.find((v) => v.enabled && v.key.trim() === trimmed)
          if (!hit) return undefined
          return effectiveEnvValue(hit)
        },
        set(key: string, value: string): void {
          store().setGlobalVariable(key, String(value))
        },
        remove(key: string): void {
          store().removeGlobalVariable(key)
        },
        clear(): void {
          store().clearGlobals()
        },
        list(): Record<string, string> {
          const out: Record<string, string> = {}
          for (const variable of store().globals) {
            if (!variable.enabled) continue
            const k = variable.key.trim()
            if (!k) continue
            out[k] = effectiveEnvValue(variable)
          }
          return out
        },
      },
    },
  }
}

export type AppApi = ReturnType<typeof createAppApi>
