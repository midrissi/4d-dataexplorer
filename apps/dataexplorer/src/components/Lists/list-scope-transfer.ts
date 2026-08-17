import {
  createPickListId,
  isHardcodedPickList,
  isValidPickListName,
  type PickListDeclaration,
  type PickListScope,
} from '~/lib/env'

export type ListTransferMode = 'move' | 'duplicate'

export type ListTransferResult = {
  sourceLists: PickListDeclaration[]
  targetLists: PickListDeclaration[]
  clone: PickListDeclaration
  replaced: PickListDeclaration | null
}

const SCOPES: PickListScope[] = ['globals', 'profile', 'base']

export function listTransferTargets(current: PickListScope, hasBase: boolean): PickListScope[] {
  return SCOPES.filter((scope) => scope !== current && (scope !== 'base' || hasBase))
}

export function clonePickListDeclaration(
  entry: PickListDeclaration,
  opts?: { keepId?: boolean }
): PickListDeclaration {
  const id = opts?.keepId ? entry.id : createPickListId()
  if (isHardcodedPickList(entry)) {
    return { id, name: entry.name, type: 'hardcoded', values: [...entry.values] }
  }
  return {
    id,
    name: entry.name,
    type: 'dataclass',
    dataclass: entry.dataclass,
    attribute: entry.attribute,
  }
}

export function uniquePickListName(desired: string, taken: Iterable<string>): string {
  const existing = new Set(
    [...taken].map((name) => name.trim()).filter((name) => isValidPickListName(name))
  )
  const stem = desired.trim()
  if (!isValidPickListName(stem)) return stem
  if (!existing.has(stem)) return stem
  const copy = `${stem}_copy`
  if (!existing.has(copy)) return copy
  let n = 2
  while (existing.has(`${stem}_copy${n}`)) n += 1
  return `${stem}_copy${n}`
}

function targetNames(lists: readonly PickListDeclaration[]): Set<string> {
  return new Set(
    lists.map((entry) => entry.name.trim()).filter((name) => isValidPickListName(name))
  )
}

/** Copy or relocate a list between scopes. Duplicate keeps the source; move removes it. */
export function transferListToScope(args: {
  mode: ListTransferMode
  entry: PickListDeclaration
  sourceLists: readonly PickListDeclaration[]
  targetLists: readonly PickListDeclaration[]
}): ListTransferResult {
  const { mode, entry, sourceLists, targetLists } = args

  if (mode === 'duplicate') {
    const clone = clonePickListDeclaration(entry)
    clone.name = uniquePickListName(entry.name, targetNames(targetLists))
    return {
      sourceLists: [...sourceLists],
      targetLists: [...targetLists, clone],
      clone,
      replaced: null,
    }
  }

  const moved = clonePickListDeclaration(entry, { keepId: true })
  const name = moved.name.trim()
  const replaced =
    name && isValidPickListName(name)
      ? (targetLists.find((item) => item.name.trim() === name && item.id !== entry.id) ?? null)
      : null
  const withoutName = replaced
    ? targetLists.filter((item) => item.id !== replaced.id)
    : [...targetLists]

  return {
    sourceLists: sourceLists.filter((item) => item.id !== entry.id),
    targetLists: [...withoutName, moved],
    clone: moved,
    replaced,
  }
}
