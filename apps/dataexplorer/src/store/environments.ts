import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type ActiveEnvLayers,
  cloneEnvironment,
  createEmptyEnvironment,
  createEmptyVariable,
  type Environment,
  type EnvScope,
  type EnvVariable,
  type EnvVarLookup,
  findEnvironmentById,
  findEnvironmentByName,
  lookupEnvVariable,
  mergeActiveEnvMap,
  normalizeEnvironmentsBlock,
  type PickListDeclaration,
  type PickListDistinctLoader,
  type PickListValuesState,
  resetVariablesToInitial,
} from '~/lib/env'
import {
  getBaseEnvironmentsBlock,
  getCurrentBaseId,
  getProfileEnvironmentsBlock,
  saveBaseEnvironmentsBlock,
  saveProfileEnvironmentsBlock,
} from '~/lib/storage'
import { useListsStore } from '~/store/lists'

type EnvironmentsState = {
  globals: EnvVariable[]
  /** Bump when profile/base env storage changes so selectors recompute. */
  revision: number

  setGlobals: (globals: EnvVariable[]) => void
  updateGlobalVariable: (key: string, value: string) => void
  setGlobalVariable: (key: string, value: string, type?: 'default' | 'secret') => void
  removeGlobalVariable: (key: string) => void
  clearGlobals: () => void

  getProfileBlock: () => { environments: Environment[]; activeEnvironmentId: string | null }
  setProfileBlock: (block: {
    environments: Environment[]
    activeEnvironmentId: string | null
  }) => void
  setActiveProfileEnvironment: (id: string | null) => void

  getBaseBlock: () => { environments: Environment[]; activeEnvironmentId: string | null }
  setBaseBlock: (block: { environments: Environment[]; activeEnvironmentId: string | null }) => void
  setActiveBaseEnvironment: (id: string | null) => void

  /** Notify listeners after external profile/base storage changes (e.g. profile switch). */
  touch: () => void

  getLayers: () => ActiveEnvLayers
  getActiveMap: () => Map<string, string>
  lookup: (
    key: string,
    labels?: { global: string; profile: string; base: string; dynamic?: string }
  ) => EnvVarLookup

  /**
   * Set / remove / clear variables on the active environment for a scope.
   * Returns false if that scope has no active environment (or no base connection).
   */
  setScopedVariable: (scope: 'profile' | 'base', key: string, value: string) => boolean
  removeScopedVariable: (scope: 'profile' | 'base', key: string) => boolean
  clearScopedVariables: (scope: 'profile' | 'base') => boolean

  /**
   * Set current value on the write target: active base env, else active profile env.
   * Returns false if no writable environment is active.
   */
  setActiveVariable: (key: string, value: string) => boolean
  removeActiveVariable: (key: string) => boolean
  clearActiveVariables: () => boolean

  resetActiveEnvironmentToInitial: (scope: 'profile' | 'base') => void
  activateEnvironmentByName: (name: string, scope?: 'profile' | 'base') => boolean

  /** Current-database `$lists` declarations (persisted; no values for dataclass lists). */
  getPickLists: () => PickListDeclaration[]
  setPickLists: (pickLists: readonly PickListDeclaration[]) => void
  /** Declared valid names for chips / autocomplete (merged scopes). */
  getPickListNames: () => string[]
  /** Loaded value map for sync resolve (ready lists only). */
  getPickListsResolveMap: () => Record<string, readonly string[]>
  getPickListValuesState: (dataclass: string, attribute: string) => PickListValuesState
  invalidatePickListValues: (dataclass: string, attribute: string) => void
  /**
   * Ensure named lists are loaded. Inject `loader` to avoid an api↔store cycle.
   * Returns the resolve map for successfully loaded lists.
   */
  ensurePickLists: (
    names: readonly string[],
    loader: PickListDistinctLoader
  ) => Promise<{
    lists: Record<string, readonly string[]>
    missing: string[]
    errors: Array<{ name: string; message: string }>
  }>
}

const DEFAULT_SCOPE_LABELS = {
  global: 'Global',
  profile: 'Profile',
  base: 'Base',
  dynamic: 'Dynamic',
}

function upsertVariable(
  variables: EnvVariable[],
  key: string,
  value: string,
  type: 'default' | 'secret' = 'default'
): EnvVariable[] {
  const trimmed = key.trim()
  if (!trimmed) return variables
  const index = variables.findIndex((v) => v.key.trim() === trimmed)
  if (index >= 0) {
    return variables.map((v, i) => (i === index ? { ...v, value, enabled: true } : v))
  }
  return [
    ...variables,
    {
      ...createEmptyVariable(),
      key: trimmed,
      value,
      initialValue: value,
      type,
      enabled: true,
    },
  ]
}

function removeVariable(variables: EnvVariable[], key: string): EnvVariable[] {
  const trimmed = key.trim()
  return variables.filter((v) => v.key.trim() !== trimmed)
}

export const useEnvironmentsStore = create<EnvironmentsState>()(
  persist(
    (set, get) => ({
      globals: [],
      revision: 0,

      setGlobals: (globals) => set({ globals }),

      updateGlobalVariable: (key, value) => {
        set((state) => ({
          globals: upsertVariable(state.globals, key, value),
        }))
      },

      setGlobalVariable: (key, value, type = 'default') => {
        set((state) => ({
          globals: upsertVariable(state.globals, key, value, type),
        }))
      },

      removeGlobalVariable: (key) => {
        set((state) => ({
          globals: removeVariable(state.globals, key),
        }))
      },

      clearGlobals: () => set({ globals: [] }),

      getProfileBlock: () => normalizeEnvironmentsBlock(getProfileEnvironmentsBlock()),

      setProfileBlock: (block) => {
        const normalized = normalizeEnvironmentsBlock(block)
        saveProfileEnvironmentsBlock(normalized)
        set((state) => ({ revision: state.revision + 1 }))
      },

      setActiveProfileEnvironment: (id) => {
        const block = get().getProfileBlock()
        saveProfileEnvironmentsBlock({
          environments: block.environments,
          activeEnvironmentId: id,
        })
        set((state) => ({ revision: state.revision + 1 }))
      },

      getBaseBlock: () => {
        if (!getCurrentBaseId()) {
          return { environments: [], activeEnvironmentId: null }
        }
        return normalizeEnvironmentsBlock(getBaseEnvironmentsBlock())
      },

      setBaseBlock: (block) => {
        if (!getCurrentBaseId()) return
        const normalized = normalizeEnvironmentsBlock(block)
        saveBaseEnvironmentsBlock(normalized)
        set((state) => ({ revision: state.revision + 1 }))
      },

      setActiveBaseEnvironment: (id) => {
        if (!getCurrentBaseId()) return
        const block = get().getBaseBlock()
        saveBaseEnvironmentsBlock({
          environments: block.environments,
          activeEnvironmentId: id,
        })
        set((state) => ({ revision: state.revision + 1 }))
      },

      touch: () => set((state) => ({ revision: state.revision + 1 })),

      getLayers: () => {
        const profileBlock = get().getProfileBlock()
        const baseBlock = get().getBaseBlock()
        return {
          globals: get().globals,
          profileEnv: findEnvironmentById(
            profileBlock.environments,
            profileBlock.activeEnvironmentId
          ),
          baseEnv: findEnvironmentById(baseBlock.environments, baseBlock.activeEnvironmentId),
        }
      },

      getActiveMap: () => mergeActiveEnvMap(get().getLayers()),

      lookup: (key, labels = DEFAULT_SCOPE_LABELS) =>
        lookupEnvVariable(key, get().getLayers(), labels),

      setScopedVariable: (scope, key, value) => {
        if (scope === 'base') {
          if (!getCurrentBaseId()) return false
          const block = get().getBaseBlock()
          const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
          if (!active) return false
          get().setBaseBlock({
            environments: block.environments.map((env) =>
              env.id === active.id
                ? { ...env, variables: upsertVariable(env.variables, key, value) }
                : env
            ),
            activeEnvironmentId: block.activeEnvironmentId,
          })
          return true
        }
        const block = get().getProfileBlock()
        const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
        if (!active) return false
        get().setProfileBlock({
          environments: block.environments.map((env) =>
            env.id === active.id
              ? { ...env, variables: upsertVariable(env.variables, key, value) }
              : env
          ),
          activeEnvironmentId: block.activeEnvironmentId,
        })
        return true
      },

      removeScopedVariable: (scope, key) => {
        if (scope === 'base') {
          if (!getCurrentBaseId()) return false
          const block = get().getBaseBlock()
          const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
          if (!active) return false
          get().setBaseBlock({
            environments: block.environments.map((env) =>
              env.id === active.id ? { ...env, variables: removeVariable(env.variables, key) } : env
            ),
            activeEnvironmentId: block.activeEnvironmentId,
          })
          return true
        }
        const block = get().getProfileBlock()
        const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
        if (!active) return false
        get().setProfileBlock({
          environments: block.environments.map((env) =>
            env.id === active.id ? { ...env, variables: removeVariable(env.variables, key) } : env
          ),
          activeEnvironmentId: block.activeEnvironmentId,
        })
        return true
      },

      clearScopedVariables: (scope) => {
        if (scope === 'base') {
          if (!getCurrentBaseId()) return false
          const block = get().getBaseBlock()
          const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
          if (!active) return false
          get().setBaseBlock({
            environments: block.environments.map((env) =>
              env.id === active.id ? { ...env, variables: [] } : env
            ),
            activeEnvironmentId: block.activeEnvironmentId,
          })
          return true
        }
        const block = get().getProfileBlock()
        const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
        if (!active) return false
        get().setProfileBlock({
          environments: block.environments.map((env) =>
            env.id === active.id ? { ...env, variables: [] } : env
          ),
          activeEnvironmentId: block.activeEnvironmentId,
        })
        return true
      },

      setActiveVariable: (key, value) => {
        if (get().setScopedVariable('base', key, value)) return true
        return get().setScopedVariable('profile', key, value)
      },

      removeActiveVariable: (key) => {
        if (get().removeScopedVariable('base', key)) return true
        return get().removeScopedVariable('profile', key)
      },

      clearActiveVariables: () => {
        if (get().clearScopedVariables('base')) return true
        return get().clearScopedVariables('profile')
      },

      resetActiveEnvironmentToInitial: (scope) => {
        if (scope === 'base') {
          const block = get().getBaseBlock()
          const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
          if (!active) return
          const environments = block.environments.map((env) =>
            env.id === active.id
              ? { ...env, variables: resetVariablesToInitial(env.variables) }
              : env
          )
          get().setBaseBlock({
            environments,
            activeEnvironmentId: block.activeEnvironmentId,
          })
          return
        }
        const block = get().getProfileBlock()
        const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
        if (!active) return
        const environments = block.environments.map((env) =>
          env.id === active.id ? { ...env, variables: resetVariablesToInitial(env.variables) } : env
        )
        get().setProfileBlock({
          environments,
          activeEnvironmentId: block.activeEnvironmentId,
        })
      },

      activateEnvironmentByName: (name, scope) => {
        if (scope === 'base' || !scope) {
          const block = get().getBaseBlock()
          const env = findEnvironmentByName(block.environments, name)
          if (env) {
            get().setActiveBaseEnvironment(env.id)
            return true
          }
          if (scope === 'base') return false
        }
        const block = get().getProfileBlock()
        const env = findEnvironmentByName(block.environments, name)
        if (env) {
          get().setActiveProfileEnvironment(env.id)
          return true
        }
        return false
      },

      getPickLists: () => useListsStore.getState().getLists('base'),

      setPickLists: (pickLists) => {
        useListsStore.getState().setLists('base', pickLists)
        set((state) => ({ revision: state.revision + 1 }))
      },

      getPickListNames: () => useListsStore.getState().getPickListNames(),

      getPickListsResolveMap: () => useListsStore.getState().getPickListsResolveMap(),

      getPickListValuesState: (dataclass, attribute) =>
        useListsStore.getState().getPickListValuesState(dataclass, attribute),

      invalidatePickListValues: (dataclass, attribute) => {
        useListsStore.getState().invalidatePickListValues(dataclass, attribute)
        set((state) => ({ revision: state.revision + 1 }))
      },

      ensurePickLists: async (names, loader) => {
        const prevRevision = useListsStore.getState().revision
        const result = await useListsStore.getState().ensurePickLists(names, loader)
        if (useListsStore.getState().revision !== prevRevision) {
          set((state) => ({ revision: state.revision + 1 }))
        }
        return result
      },
    }),
    {
      name: 'dataexplorer-env-globals-v1',
      partialize: (state) => ({ globals: state.globals }),
      merge: (persisted, current): EnvironmentsState => {
        const raw = (persisted ?? {}) as { globals?: unknown }
        if (!Array.isArray(raw.globals)) return { ...current, ...raw, globals: current.globals }
        const globals: EnvVariable[] = []
        for (const item of raw.globals) {
          if (!item || typeof item !== 'object') continue
          const record = item as Record<string, unknown>
          globals.push({
            id: typeof record.id === 'string' && record.id ? record.id : createEmptyVariable().id,
            key: typeof record.key === 'string' ? record.key : '',
            value: typeof record.value === 'string' ? record.value : '',
            initialValue:
              typeof record.initialValue === 'string'
                ? record.initialValue
                : typeof record.value === 'string'
                  ? record.value
                  : '',
            type: record.type === 'secret' ? 'secret' : 'default',
            enabled: record.enabled !== false,
          })
        }
        return { ...current, globals }
      },
    }
  )
)

export function useActiveEnvMap(): Map<string, string> {
  const revision = useEnvironmentsStore((s) => s.revision)
  const globals = useEnvironmentsStore((s) => s.globals)
  void revision
  void globals
  return useEnvironmentsStore.getState().getActiveMap()
}

export function useActiveEnvLayers(): ActiveEnvLayers {
  const revision = useEnvironmentsStore((s) => s.revision)
  const globals = useEnvironmentsStore((s) => s.globals)
  void revision
  void globals
  return useEnvironmentsStore.getState().getLayers()
}

export function useActiveEnvironmentLabels(): {
  profile: Environment | null
  base: Environment | null
} {
  const revision = useEnvironmentsStore((s) => s.revision)
  void revision
  const layers = useEnvironmentsStore.getState().getLayers()
  return { profile: layers.profileEnv, base: layers.baseEnv }
}

/** Resolve + set variable value for TemplatedTextInput wiring. */
export function resolveEnvVarForUi(
  key: string,
  labels: { global: string; profile: string; base: string }
): EnvVarLookup {
  return useEnvironmentsStore.getState().lookup(key, labels)
}

export function setEnvVarCurrentValue(key: string, value: string, scope?: EnvScope): void {
  const store = useEnvironmentsStore.getState()
  if (scope === 'global') {
    store.updateGlobalVariable(key, value)
    return
  }
  if (scope === 'base') {
    const block = store.getBaseBlock()
    const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
    if (!active) return
    store.setBaseBlock({
      environments: block.environments.map((env) =>
        env.id === active.id
          ? { ...env, variables: upsertVariable(env.variables, key, value) }
          : env
      ),
      activeEnvironmentId: block.activeEnvironmentId,
    })
    return
  }
  if (scope === 'profile') {
    const block = store.getProfileBlock()
    const active = findEnvironmentById(block.environments, block.activeEnvironmentId)
    if (!active) return
    store.setProfileBlock({
      environments: block.environments.map((env) =>
        env.id === active.id
          ? { ...env, variables: upsertVariable(env.variables, key, value) }
          : env
      ),
      activeEnvironmentId: block.activeEnvironmentId,
    })
    return
  }
  // Prefer writing to the scope that currently owns the key (never "dynamic").
  const hit = store.lookup(key)
  if (!hit.unresolved && hit.scope !== 'dynamic' && !hit.dynamic) {
    setEnvVarCurrentValue(key, value, hit.scope)
    return
  }
  if (!store.setActiveVariable(key, value)) {
    store.updateGlobalVariable(key, value)
  }
}

export { cloneEnvironment, createEmptyEnvironment, createEmptyVariable }
