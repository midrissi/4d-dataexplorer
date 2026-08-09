import type { ToolkitInventory, ToolkitNode, ToolkitOperation } from './toolkit-types'

export function flattenToolkitOperations(nodes: ToolkitNode[]): ToolkitOperation[] {
  const result: ToolkitOperation[] = []
  for (const node of nodes) {
    if (node.type === 'operation') result.push(node.operation)
    else result.push(...flattenToolkitOperations(node.children))
  }
  return result
}

export function countToolkitOperations(nodes: ToolkitNode[]): number {
  return flattenToolkitOperations(nodes).length
}

export function countToolkitFolders(nodes: ToolkitNode[]): number {
  return collectFolderIds(nodes).length
}

export function collectFolderIds(nodes: ToolkitNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.type !== 'folder') continue
    ids.push(node.id)
    ids.push(...collectFolderIds(node.children))
  }
  return ids
}

/** New folders start collapsed; expanded/collapsed choices on known folders are kept. */
export function reconcileCollapsedFolderIds(
  collapsedIds: ReadonlySet<string>,
  folderIds: readonly string[],
  knownIds: ReadonlySet<string>
): { collapsedIds: Set<string>; knownIds: Set<string> } {
  const folderIdSet = new Set(folderIds)
  const nextCollapsed = new Set<string>()
  for (const id of collapsedIds) {
    if (folderIdSet.has(id)) nextCollapsed.add(id)
  }
  for (const id of folderIds) {
    if (!knownIds.has(id)) nextCollapsed.add(id)
  }
  return { collapsedIds: nextCollapsed, knownIds: folderIdSet }
}

export function inventorySummary(inventory: ToolkitInventory): {
  folders: number
  requests: number
} {
  return {
    folders: countToolkitFolders(inventory.nodes),
    requests: countToolkitOperations(inventory.nodes),
  }
}
