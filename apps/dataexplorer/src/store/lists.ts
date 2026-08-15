import { create } from 'zustand'
import {
  buildPickListsResolveMap,
  createPickListValuesCache,
  isDataclassPickList,
  isHardcodedPickList,
  listDeclaredPickListNames,
  mergeScopedPickLists,
  normalizePickListDeclarations,
  PICK_LIST_DEFAULT_LIMIT,
  type PickListDeclaration,
  type PickListDistinctLoader,
  type PickListScope,
  type PickListValuesState,
  type ScopedPickLists,
} from '~/lib/env'
import {
  getBasePickLists,
  getCurrentBaseId,
  getGlobalPickLists,
  getProfilePickLists,
  saveBasePickLists,
  saveGlobalPickLists,
  saveProfilePickLists,
} from '~/lib/storage'

type ListsState = {
  /** Bump when scoped list storage changes so selectors recompute. */
  revision: number
  touch: () => void

  getScopedLists: () => ScopedPickLists
  getLists: (scope: PickListScope) => PickListDeclaration[]
  setLists: (scope: PickListScope, lists: readonly PickListDeclaration[]) => void

  /** Effective declarations after base > profile > globals merge. */
  getMergedLists: () => PickListDeclaration[]
  getPickListNames: () => string[]
  getPickListsResolveMap: () => Record<string, readonly string[]>

  getPickListValuesState: (dataclass: string, attribute: string) => PickListValuesState
  /** Values preview for any declaration (hardcoded or dataclass). */
  getListValuesState: (entry: PickListDeclaration) => PickListValuesState
  invalidatePickListValues: (dataclass: string, attribute: string) => void
  /** Invalidate by declaration ID (preferred; avoids ambiguity with entitySetId/limit). */
  invalidatePickList: (id: string) => void

  ensurePickLists: (
    names: readonly string[],
    loader: PickListDistinctLoader
  ) => Promise<{
    lists: Record<string, readonly string[]>
    missing: string[]
    errors: Array<{ name: string; message: string }>
  }>
}

const pickListValuesCache = createPickListValuesCache()

function readScope(scope: PickListScope): PickListDeclaration[] {
  if (scope === 'globals') return getGlobalPickLists()
  if (scope === 'profile') return getProfilePickLists()
  return getBasePickLists()
}

function writeScope(scope: PickListScope, lists: readonly PickListDeclaration[]): void {
  const normalized = normalizePickListDeclarations(lists)
  if (scope === 'globals') {
    saveGlobalPickLists(normalized)
    return
  }
  if (scope === 'profile') {
    saveProfilePickLists(normalized)
    return
  }
  if (!getCurrentBaseId()) return
  saveBasePickLists(normalized)
}

export const useListsStore = create<ListsState>()((set, get) => ({
  revision: 0,

  touch: () => set((state) => ({ revision: state.revision + 1 })),

  getScopedLists: () => ({
    globals: getGlobalPickLists(),
    profile: getProfilePickLists(),
    base: getBasePickLists(),
  }),

  getLists: (scope) => readScope(scope),

  setLists: (scope, lists) => {
    if (scope === 'base' && !getCurrentBaseId()) return
    const prev = readScope(scope)
    writeScope(scope, lists)

    const prevById = new Map(prev.map((d) => [d.id, d]))
    const baseId = getCurrentBaseId()
    for (const next of lists) {
      if (!isDataclassPickList(next)) continue
      const before = prevById.get(next.id)
      if (
        baseId &&
        before &&
        isDataclassPickList(before) &&
        (before.dataclass !== next.dataclass || before.attribute !== next.attribute)
      ) {
        pickListValuesCache.invalidate(baseId, before.id)
      }
    }
    set((state) => ({ revision: state.revision + 1 }))
  },

  getMergedLists: () => mergeScopedPickLists(get().getScopedLists()),

  getPickListNames: () => listDeclaredPickListNames(get().getMergedLists()),

  getPickListsResolveMap: () => {
    const valuesByName: Record<string, readonly string[]> = {}
    const baseId = getCurrentBaseId()
    for (const decl of get().getMergedLists()) {
      const name = decl.name.trim()
      if (!name) continue
      if (isHardcodedPickList(decl)) {
        if (decl.values.length > 0) valuesByName[name] = decl.values
        continue
      }
      if (!baseId || !decl.dataclass || !decl.attribute) continue
      const state = pickListValuesCache.getCached(baseId, decl.id)
      if (state.status === 'ready') valuesByName[name] = state.values
    }
    return buildPickListsResolveMap(valuesByName)
  },

  getPickListValuesState: (dataclass, attribute) => {
    const baseId = getCurrentBaseId()
    if (!baseId || !dataclass || !attribute) return { status: 'idle' }
    // Find the first merged declaration matching dataclass+attribute.
    const decl = get()
      .getMergedLists()
      .find((d) => isDataclassPickList(d) && d.dataclass === dataclass && d.attribute === attribute)
    if (!decl) return { status: 'idle' }
    return pickListValuesCache.getCached(baseId, decl.id)
  },

  getListValuesState: (entry) => {
    if (isHardcodedPickList(entry)) {
      if (entry.values.length === 0) return { status: 'empty' }
      return { status: 'ready', values: entry.values, truncated: false }
    }
    const baseId = getCurrentBaseId()
    if (!baseId || !entry.dataclass || !entry.attribute) return { status: 'idle' }
    return pickListValuesCache.getCached(baseId, entry.id)
  },

  invalidatePickListValues: (dataclass, attribute) => {
    const baseId = getCurrentBaseId()
    if (!baseId || !dataclass || !attribute) return
    // Invalidate all merged declarations matching dataclass+attribute.
    const matching = get()
      .getMergedLists()
      .filter(
        (d) => isDataclassPickList(d) && d.dataclass === dataclass && d.attribute === attribute
      )
    for (const decl of matching) {
      pickListValuesCache.invalidate(baseId, decl.id)
    }
    set((state) => ({ revision: state.revision + 1 }))
  },

  invalidatePickList: (id: string) => {
    const baseId = getCurrentBaseId()
    if (!baseId || !id) return
    pickListValuesCache.invalidate(baseId, id)
    set((state) => ({ revision: state.revision + 1 }))
  },

  ensurePickLists: async (names, loader) => {
    const wanted = new Set(names.map((n) => n.trim()).filter(Boolean))
    const byName = new Map(
      get()
        .getMergedLists()
        .filter((d) => d.name.trim())
        .map((d) => [d.name.trim(), d] as const)
    )
    const missing: string[] = []
    const errors: Array<{ name: string; message: string }> = []
    const toLoad: Array<Extract<PickListDeclaration, { type: 'dataclass' }>> = []
    const hardcodedReady: Record<string, readonly string[]> = {}

    for (const name of wanted) {
      const decl = byName.get(name)
      if (!decl) {
        missing.push(name)
        continue
      }
      if (isHardcodedPickList(decl)) {
        if (decl.values.length === 0) missing.push(name)
        else hardcodedReady[name] = decl.values
        continue
      }
      if (!decl.dataclass || !decl.attribute) {
        missing.push(name)
        continue
      }
      toLoad.push(decl)
    }

    const baseId = getCurrentBaseId()
    let changed = false
    if (baseId && toLoad.length > 0) {
      await Promise.all(
        toLoad.map(async (decl) => {
          const before = pickListValuesCache.getCached(baseId, decl.id)
          try {
            await pickListValuesCache.ensure(
              baseId,
              decl.id,
              {
                dataclass: decl.dataclass,
                attribute: decl.attribute,
                top: PICK_LIST_DEFAULT_LIMIT,
              },
              loader
            )
          } catch (err) {
            errors.push({
              name: decl.name.trim(),
              message: err instanceof Error ? err.message : String(err),
            })
          }
          const after = pickListValuesCache.getCached(baseId, decl.id)
          if (before.status !== after.status) changed = true
        })
      )
    } else {
      for (const decl of toLoad) missing.push(decl.name.trim())
    }

    if (changed) set((state) => ({ revision: state.revision + 1 }))

    const lists = { ...get().getPickListsResolveMap(), ...hardcodedReady }
    for (const name of wanted) {
      if (missing.includes(name) || errors.some((e) => e.name === name)) continue
      if (!lists[name] || lists[name].length === 0) missing.push(name)
    }

    return { lists, missing, errors }
  },
}))

/** Back-compat accessors used by Environments / anonymize until callers migrate. */
export function getPickListsCompat(): PickListDeclaration[] {
  return useListsStore.getState().getMergedLists()
}
