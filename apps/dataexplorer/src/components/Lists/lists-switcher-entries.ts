import {
  isDataclassPickList,
  isValidPickListName,
  mergeScopedPickLists,
  type PickListDeclaration,
  type ScopedPickLists,
} from '~/lib/env'

export type ListsSwitcherScopeId = 'globals' | 'profile' | 'base'

export type ListsSwitcherEntry = {
  id: string
  name: string
  type: 'dataclass' | 'hardcoded'
  scope: ListsSwitcherScopeId
  valueHint?: string
}

export function listValueHint(declaration: PickListDeclaration): string | undefined {
  if (isDataclassPickList(declaration)) {
    return declaration.dataclass && declaration.attribute
      ? `${declaration.dataclass}.${declaration.attribute}`
      : undefined
  }

  const values = declaration.values.slice(0, 3)
  if (values.length === 0) return undefined
  return `${values.join(', ')}${declaration.values.length > values.length ? ', ...' : ''}`
}

/** Merged $lists for the switcher: base > profile > globals, unique names, sorted. */
export function buildSwitcherEntries(scoped: ScopedPickLists): ListsSwitcherEntry[] {
  const result: ListsSwitcherEntry[] = []
  const push = (decls: PickListDeclaration[], scope: ListsSwitcherScopeId) => {
    for (const declaration of decls) {
      const name = declaration.name.trim()
      if (!name || !isValidPickListName(name)) continue
      result.push({
        id: declaration.id,
        name,
        type: isDataclassPickList(declaration) ? 'dataclass' : 'hardcoded',
        scope,
        valueHint: listValueHint(declaration),
      })
    }
  }
  push(scoped.base, 'base')
  push(scoped.profile, 'profile')
  push(scoped.globals, 'globals')
  const mergedNames = new Set(mergeScopedPickLists(scoped).map((d) => d.name.trim()))
  return result
    .filter((entry) => mergedNames.has(entry.name))
    .filter((entry, index, arr) => arr.findIndex((item) => item.name === entry.name) === index)
    .sort((a, b) => a.name.localeCompare(b.name))
}
