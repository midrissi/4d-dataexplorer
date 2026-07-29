import { describe, expect, it } from 'bun:test'
import type { Tab } from '~/store/tabs'
import { getTabOverviewDetails } from './tab-overview-details'

const t = (key: string) => key

function dataclassTab(overrides: Partial<Extract<Tab, { type: 'dataclass' }>> = {}): Tab {
  return {
    id: '1',
    type: 'dataclass',
    dataclassName: 'Agency',
    entitySetId: null,
    isPinned: false,
    viewMode: 'table',
    queryOptions: {
      filter: '',
      filterParams: [],
      sort: '',
      order: 'asc',
      select: '',
      top: 80,
    },
    fieldConfig: { table: [], cards: [] },
    queryExpanded: false,
    queryPanelHeight: null,
    selectedEntityId: null,
    entitiesPage: 1,
    selectionCount: null,
    ...overrides,
  }
}

describe('getTabOverviewDetails', () => {
  it('includes view mode and count chips for dataclass tabs', () => {
    const details = getTabOverviewDetails(dataclassTab(), t, { count: 490 })
    expect(details.chips).toContain('command.tableView')
    expect(details.chips).toContain('490')
    expect(details.subtitle).toBe('')
  })

  it('surfaces filter text as subtitle when present', () => {
    const details = getTabOverviewDetails(
      dataclassTab({
        queryOptions: {
          filter: 'name = "Acme"',
          filterParams: [],
          sort: '',
          order: 'asc',
          select: '',
          top: 80,
        },
      }),
      t
    )
    expect(details.subtitle).toBe('name = "Acme"')
    expect(details.chips).toContain('tabs.filtered')
  })

  it('formats http method and path', () => {
    const details = getTabOverviewDetails(
      {
        id: 'http',
        type: 'http-client',
        isPinned: false,
        seed: { method: 'GET', path: '/rest/Agency?$top=1' },
      },
      t
    )
    expect(details.subtitle).toBe('GET /rest/Agency')
    expect(details.chips).toContain('GET')
  })
})
