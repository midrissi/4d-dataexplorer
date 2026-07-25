import { api } from '~/lib/api'

type TabEntitySetRef = {
  id: string
  type: string
  dataclassName?: string
  entitySetId?: string | null
}

export function isEntitySetUsedByTabs(entitySetId: string, tabs: TabEntitySetRef[]): boolean {
  return tabs.some((t) => t.type === 'dataclass' && t.entitySetId === entitySetId)
}

/** Release a tab-bound entity set when no remaining tab references it. */
export function releaseEntitySetIfOrphaned(
  dataclassName: string,
  entitySetId: string | null | undefined,
  remainingTabs: TabEntitySetRef[]
): void {
  if (!entitySetId) return
  if (isEntitySetUsedByTabs(entitySetId, remainingTabs)) return
  void api.releaseEntitySet(dataclassName, entitySetId)
}

/** Release entity sets owned by tabs that were removed. */
export function releaseEntitySetsFromRemovedTabs(
  before: TabEntitySetRef[],
  after: TabEntitySetRef[]
): void {
  const removed = before.filter((tab) => !after.some((t) => t.id === tab.id))
  for (const tab of removed) {
    if (tab.type === 'dataclass' && tab.entitySetId && tab.dataclassName) {
      releaseEntitySetIfOrphaned(tab.dataclassName, tab.entitySetId, after)
    }
  }
}
