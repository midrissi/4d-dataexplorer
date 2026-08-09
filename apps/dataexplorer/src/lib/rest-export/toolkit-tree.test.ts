import { describe, expect, it } from 'bun:test'
import { collectFolderIds, reconcileCollapsedFolderIds } from './toolkit-tree'
import type { ToolkitNode } from './toolkit-types'

describe('toolkit tree', () => {
  it('collects nested folder ids', () => {
    const nodes: ToolkitNode[] = [
      {
        type: 'folder',
        id: 'folder:auth',
        name: 'Auth',
        children: [
          {
            type: 'operation',
            operation: {
              id: 'auth:authentify',
              label: 'Authentify',
              operationId: 'auth_authentify',
              method: 'POST',
              path: '/rest/$catalog/authentify',
            },
          },
        ],
      },
      {
        type: 'folder',
        id: 'folder:dc:Company',
        name: 'Company',
        children: [
          {
            type: 'folder',
            id: 'folder:dc:Company:functions',
            name: 'Functions',
            children: [],
          },
        ],
      },
    ]
    expect(collectFolderIds(nodes)).toEqual([
      'folder:auth',
      'folder:dc:Company',
      'folder:dc:Company:functions',
    ])
  })

  it('collapses unknown folders and keeps known expand state', () => {
    const first = reconcileCollapsedFolderIds(new Set(), ['a', 'b'], new Set())
    expect([...first.collapsedIds].sort()).toEqual(['a', 'b'])

    const expandedB = reconcileCollapsedFolderIds(new Set(['a']), ['a', 'b', 'c'], first.knownIds)
    expect([...expandedB.collapsedIds].sort()).toEqual(['a', 'c'])

    const removedA = reconcileCollapsedFolderIds(
      expandedB.collapsedIds,
      ['b', 'c'],
      expandedB.knownIds
    )
    expect([...removedA.collapsedIds].sort()).toEqual(['c'])
  })
})
