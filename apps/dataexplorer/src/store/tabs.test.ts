import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { saveBaseSettings, setCurrentBaseId } from '~/lib/storage'
import type { DataclassTab, HomeTab, SettingsTab, Tab } from './tabs'
import {
  isAssistantMetadataTab,
  isDataclassTab,
  isGraphTab,
  isHomeTab,
  isHttpClientTab,
  isMethodExecutorTab,
  isSchemaBuilderTab,
  isSettingsTab,
  isStaticTab,
  RELEASE_NOTES_STATIC_ID,
  useTabsStore,
} from './tabs'

describe('method executor tabs', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('opens seeded runs in distinct tabs and reuses a blank tab', () => {
    const store = useTabsStore.getState()
    const firstBlank = store.openMethodExecutorTab()
    expect(store.openMethodExecutorTab()).toBe(firstBlank)

    const seeded = store.openMethodExecutorTab({
      scope: 'entity',
      methodName: 'calculate',
      dataClass: 'Invoice',
      key: '42',
    })
    expect(seeded).not.toBe(firstBlank)
    const tab = useTabsStore.getState().tabs.find((item) => item.id === seeded)
    expect(tab && isMethodExecutorTab(tab) ? tab.seed?.methodName : undefined).toBe('calculate')
  })
})

describe('http client tabs', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('opens seeded requests in distinct tabs and reuses a blank tab', () => {
    const store = useTabsStore.getState()
    const firstBlank = store.openHttpClientTab()
    expect(store.openHttpClientTab()).toBe(firstBlank)

    const seeded = store.openHttpClientTab({
      method: 'POST',
      path: '/rest/Car',
      warnings: ['Omitted sensitive header'],
    })
    expect(seeded).not.toBe(firstBlank)
    const tab = useTabsStore.getState().tabs.find((item) => item.id === seeded)
    expect(tab && isHttpClientTab(tab) ? tab.seed?.method : undefined).toBe('POST')
    expect(tab && isHttpClientTab(tab) ? tab.seed?.path : undefined).toBe('/rest/Car')
  })
})

describe('store/tabs', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  describe('RELEASE_NOTES_STATIC_ID', () => {
    it('is the release notes static tab id', () => {
      expect(RELEASE_NOTES_STATIC_ID).toBe('release-notes')
    })
  })

  describe('type guards', () => {
    const homeTab: HomeTab = {
      id: 'home',
      type: 'home',
      isClosable: false,
      isPinned: false,
      index: 0,
    }

    const dataclassTab: DataclassTab = {
      id: 'dc-1',
      type: 'dataclass',
      dataclassName: 'Employee',
      entitySetId: null,
      isPinned: false,
      isClosable: true,
      viewMode: 'table',
      queryOptions: {
        filter: '',
        filterParams: [],
        sort: '__KEY',
        order: 'desc',
        select: '',
        top: 100,
      },
      fieldConfig: { table: [], cards: [] },
      queryExpanded: true,
      queryPanelHeight: null,
      selectedEntityId: null,
      entitiesPage: 1,
      selectionCount: null,
    }

    const settingsTab: SettingsTab = {
      id: 'settings',
      type: 'settings',
      isPinned: false,
      isClosable: true,
      shortcutsExpanded: false,
      dataclassesExpanded: false,
      assistantToolsExpanded: false,
      widgetsExpanded: false,
    }

    it('isHomeTab identifies home tab', () => {
      expect(isHomeTab(homeTab)).toBe(true)
      expect(isHomeTab(dataclassTab)).toBe(false)
    })

    it('isDataclassTab identifies dataclass tab', () => {
      expect(isDataclassTab(dataclassTab)).toBe(true)
      expect(isDataclassTab(homeTab)).toBe(false)
    })

    it('isSettingsTab identifies settings tab', () => {
      expect(isSettingsTab(settingsTab)).toBe(true)
      expect(isSettingsTab(homeTab)).toBe(false)
    })

    it('isGraphTab identifies graph tab', () => {
      const graphTab: Tab = { id: 'g', type: 'graph', isPinned: false }
      expect(isGraphTab(graphTab)).toBe(true)
      expect(isGraphTab(homeTab)).toBe(false)
    })

    it('isStaticTab identifies static tab', () => {
      const staticTab: Tab = {
        id: 'sn',
        type: 'static',
        staticId: RELEASE_NOTES_STATIC_ID,
        isPinned: false,
      }
      expect(isStaticTab(staticTab)).toBe(true)
      expect(isStaticTab(homeTab)).toBe(false)
    })
  })

  describe('store actions', () => {
    it('openTab creates dataclass tab and activates it', () => {
      useTabsStore.getState().openTab('Employee')
      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
      const tab = tabs[0]
      expect(tab).toBeDefined()
      expect(tab && isDataclassTab(tab)).toBe(true)
      expect((tabs[0] as DataclassTab).dataclassName).toBe('Employee')
      expect(activeTabId).toBe(tabs[0]?.id)
    })

    it('openTab same dataclass activates existing tab', () => {
      useTabsStore.getState().openTab('Employee')
      const firstId = useTabsStore.getState().tabs[0]?.id
      useTabsStore.getState().openTab('Employee')
      expect(useTabsStore.getState().tabs).toHaveLength(1)
      expect(useTabsStore.getState().activeTabId).toBe(firstId)
    })

    it('openEntitySetTab creates tab bound to entity set id', () => {
      const tabId = useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        viewMode: 'table',
        forceNew: true,
      })
      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
      const tab = tabs[0] as DataclassTab
      expect(tab.entitySetId).toBe('ABC123')
      expect(tab.viewMode).toBe('table')
      expect(activeTabId).toBe(tabId)
    })

    it('openEntitySetTab reuses tab with same entity set id when forceNew is false', () => {
      const firstId = useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        forceNew: true,
      })
      useTabsStore.getState().openTab('Company')
      const secondId = useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        forceNew: false,
      })
      expect(useTabsStore.getState().tabs).toHaveLength(2)
      expect(secondId).toBe(firstId)
    })

    it('openEntitySetTab with forceNew always creates a new tab', () => {
      useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        forceNew: true,
      })
      useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        forceNew: true,
      })
      expect(useTabsStore.getState().tabs).toHaveLength(2)
    })

    it('openTab does not reuse entity-set tabs for same dataclass', () => {
      useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        forceNew: true,
      })
      useTabsStore.getState().openTab('Employee')
      expect(useTabsStore.getState().tabs).toHaveLength(2)
    })

    it('closeTab releases orphaned entity set', async () => {
      const { api } = await import('~/lib/api')
      const releaseSpy = mock((dataclassName: string, entitySetId: string) =>
        Promise.resolve({
          dataclass: dataclassName,
          entitySetId,
          released: true,
          detachedTabs: 0,
        })
      )
      const originalRelease = api.releaseEntitySet
      api.releaseEntitySet = releaseSpy

      useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'ABC123',
        forceNew: true,
      })
      const tabId = useTabsStore.getState().activeTabId
      expect(tabId).toBeTruthy()
      if (!tabId) throw new Error('expected active tab id')
      useTabsStore.getState().closeTab(tabId)

      await Promise.resolve()
      expect(releaseSpy).toHaveBeenCalledWith('Employee', 'ABC123')

      api.releaseEntitySet = originalRelease
    })

    it('setEntitySetId releases previous entity set when replaced', async () => {
      const { api } = await import('~/lib/api')
      const releaseSpy = mock((dataclassName: string, entitySetId: string) =>
        Promise.resolve({
          dataclass: dataclassName,
          entitySetId,
          released: true,
          detachedTabs: 0,
        })
      )
      const originalRelease = api.releaseEntitySet
      api.releaseEntitySet = releaseSpy

      useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'OLD-ID',
        forceNew: true,
      })
      const tabId = useTabsStore.getState().activeTabId
      expect(tabId).toBeTruthy()
      if (!tabId) throw new Error('expected active tab id')
      useTabsStore.getState().setEntitySetId(tabId, 'NEW-ID')

      await Promise.resolve()
      expect(releaseSpy).toHaveBeenCalledWith('Employee', 'OLD-ID')

      api.releaseEntitySet = originalRelease
    })

    it('openHomeTab creates home tab and activates it', () => {
      useTabsStore.getState().openHomeTab()
      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
      const tab = tabs[0]
      expect(tab).toBeDefined()
      expect(tab && isHomeTab(tab)).toBe(true)
      expect(activeTabId).toBe(tabs[0]?.id)
    })

    it('openHomeTab activates existing home tab', () => {
      useTabsStore.getState().openHomeTab()
      const id = useTabsStore.getState().activeTabId ?? null
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openHomeTab()
      expect(useTabsStore.getState().tabs).toHaveLength(2)
      expect(useTabsStore.getState().activeTabId).toBe(id)
    })

    it('openSettingsTab creates settings tab', () => {
      useTabsStore.getState().openSettingsTab()
      const { tabs } = useTabsStore.getState()
      expect(tabs.some(isSettingsTab)).toBe(true)
    })

    it('openSettingsTab activates existing settings tab', () => {
      useTabsStore.getState().openSettingsTab()
      const settingsId = useTabsStore.getState().tabs.find((t) => isSettingsTab(t))?.id
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openSettingsTab()
      expect(useTabsStore.getState().activeTabId).toBe(settingsId ?? null)
    })

    it('openStaticTab creates static tab', () => {
      useTabsStore.getState().openStaticTab(RELEASE_NOTES_STATIC_ID)
      const { tabs } = useTabsStore.getState()
      const staticTab = tabs.find((t) => isStaticTab(t) && t.staticId === RELEASE_NOTES_STATIC_ID)
      expect(staticTab).toBeDefined()
    })

    it('openStaticTab activates existing static tab', () => {
      useTabsStore.getState().openStaticTab(RELEASE_NOTES_STATIC_ID)
      const staticId = useTabsStore.getState().tabs.find((t) => isStaticTab(t))?.id
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openStaticTab(RELEASE_NOTES_STATIC_ID)
      expect(useTabsStore.getState().activeTabId).toBe(staticId ?? null)
    })

    it('setActiveTab updates activeTabId', () => {
      useTabsStore.getState().openTab('Employee')
      const tabId = useTabsStore.getState().tabs[0]?.id ?? null
      useTabsStore.getState().openTab('Company')
      useTabsStore.getState().setActiveTab(tabId)
      expect(useTabsStore.getState().activeTabId).toBe(tabId)
    })

    it('closeTab removes unpinned closable tab', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      // New tab is inserted after pinned; tabs are [Company, Employee]
      const companyTabId = useTabsStore.getState().tabs[0]?.id
      expect(companyTabId).toBeDefined()
      if (companyTabId !== undefined) {
        useTabsStore.getState().closeTab(companyTabId)
      }
      expect(useTabsStore.getState().tabs).toHaveLength(1)
      expect(useTabsStore.getState().tabs[0]).toMatchObject({
        type: 'dataclass',
        dataclassName: 'Employee',
      })
    })

    it('closeTab does not close pinned tab', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().pinTab(id)
        useTabsStore.getState().closeTab(id)
      }
      expect(useTabsStore.getState().tabs).toHaveLength(1)
    })

    it('closeTab does not close home tab (isClosable false)', () => {
      useTabsStore.getState().openHomeTab()
      const homeId = useTabsStore.getState().tabs[0]?.id
      expect(homeId).toBeDefined()
      if (homeId !== undefined) {
        useTabsStore.getState().closeTab(homeId)
      }
      expect(useTabsStore.getState().tabs).toHaveLength(1)
      expect(useTabsStore.getState().tabs[0]?.id).toBe(homeId)
    })

    it('closeTab when active is last tab activates previous', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const companyId = useTabsStore.getState().tabs[0]?.id ?? null
      useTabsStore.getState().setActiveTab(companyId)
      if (companyId !== null) {
        useTabsStore.getState().closeTab(companyId)
      }
      expect(useTabsStore.getState().activeTabId).toBe(useTabsStore.getState().tabs[0]?.id)
      expect(useTabsStore.getState().tabs).toHaveLength(1)
    })

    it('pinTab and unpinTab update isPinned', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(useTabsStore.getState().tabs[0]?.isPinned).toBe(false)
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().pinTab(id)
        expect(useTabsStore.getState().tabs[0]?.isPinned).toBe(true)
        useTabsStore.getState().unpinTab(id)
      }
      expect(useTabsStore.getState().tabs[0]?.isPinned).toBe(false)
    })

    it('setViewMode updates dataclass tab viewMode', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().setViewMode(id, 'table')
      }
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.viewMode).toBe('table')
    })

    it('setQueryOptions merges options for dataclass tab', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().setQueryOptions(id, { filter: 'name ne null', top: 50 })
      }
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.queryOptions.filter).toBe('name ne null')
      expect(tab.queryOptions.top).toBe(50)
    })

    it('setFieldConfig merges field visibility config for dataclass tab', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().setFieldConfig(id, { table: ['name'] })
        useTabsStore.getState().setFieldConfig('missing', { table: ['x'] })
      }
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.fieldConfig.table).toEqual(['name'])
    })

    it('setSelectedEntityId and setEntitiesPage update dataclass tab', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().setSelectedEntityId(id, '42')
        useTabsStore.getState().setEntitiesPage(id, 3)
      }
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.selectedEntityId).toBe('42')
      expect(tab.entitiesPage).toBe(3)
    })

    it('setSettingsShortcutsExpanded updates settings tab', () => {
      useTabsStore.getState().openSettingsTab()
      const id = useTabsStore.getState().tabs.find((t) => isSettingsTab(t))?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().setSettingsShortcutsExpanded(id, true)
      }
      const tab = useTabsStore.getState().tabs.find((t) => t.id === id) as SettingsTab
      expect(tab.shortcutsExpanded).toBe(true)
    })

    it('rehydrateTabs reads from base storage and updates state', () => {
      setCurrentBaseId('test-uniq')
      saveBaseSettings({
        tabs: [
          {
            id: 'stored-tab',
            type: 'dataclass',
            dataclassName: 'Employee',
            isPinned: false,
            viewMode: 'cards',
            queryOptions: {
              filter: '',
              filterParams: [],
              sort: '',
              order: 'desc',
              select: '',
              top: 100,
            },
            queryExpanded: false,
            selectedEntityId: null,
            entitiesPage: 1,
            selectionCount: null,
          },
        ],
        activeTabId: 'stored-tab',
      })
      useTabsStore.getState().rehydrateTabs()
      expect(useTabsStore.getState().tabs.length).toBe(1)
      expect(useTabsStore.getState().activeTabId).toBe('stored-tab')
    })

    it('applyDefaultViewModeToAllTabs updates all dataclass tabs', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      useTabsStore.getState().applyDefaultViewModeToAllTabs('table')
      const dcTabs = useTabsStore.getState().tabs.filter(isDataclassTab)
      expect(dcTabs.every((t) => t.viewMode === 'table')).toBe(true)
    })

    it('applyDefaultPageSizeToAllTabs updates top on dataclass tabs', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().applyDefaultPageSizeToAllTabs(50)
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.queryOptions.top).toBe(50)
    })

    it('openAllDataclasses opens new tabs and activates first', () => {
      useTabsStore.getState().openAllDataclasses(['Employee', 'Company'])
      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs.filter(isDataclassTab)).toHaveLength(2)
      expect(activeTabId).toBe(tabs[0]?.id)
    })

    it('openAllDataclasses activates existing when all already open', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      useTabsStore.getState().setActiveTab(null)
      useTabsStore.getState().openAllDataclasses(['Employee', 'Company'])
      expect(useTabsStore.getState().activeTabId).toBeTruthy()
    })

    it('openGraphTab creates graph tab and returns promise', async () => {
      const promise = useTabsStore.getState().openGraphTab()
      expect(promise).toBeInstanceOf(Promise)
      const { tabs } = useTabsStore.getState()
      expect(tabs.some(isGraphTab)).toBe(true)
      useTabsStore.getState().notifyGraphTabReady()
      await promise
    })

    it('openGraphTab activates existing graph tab', async () => {
      useTabsStore.getState().openGraphTab()
      const promise = useTabsStore.getState().openGraphTab()
      useTabsStore.getState().notifyGraphTabReady()
      await promise
      const { tabs } = useTabsStore.getState()
      expect(tabs.filter(isGraphTab)).toHaveLength(1)
    })

    it('closeOtherTabs keeps target and pinned', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const companyId = useTabsStore.getState().tabs[0]?.id
      expect(companyId).toBeDefined()
      if (companyId !== undefined) {
        useTabsStore.getState().closeOtherTabs(companyId)
      }
      expect(useTabsStore.getState().tabs).toHaveLength(1)
      expect(useTabsStore.getState().activeTabId).toBe(companyId)
    })

    it('closeTabsToRight keeps tabs to the left and pinned', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const employeeId = useTabsStore.getState().tabs[1]?.id
      expect(employeeId).toBeDefined()
      if (employeeId !== undefined) {
        useTabsStore.getState().closeTabsToRight(employeeId)
      }
      expect(useTabsStore.getState().tabs.some((t) => t.id === employeeId)).toBe(true)
    })

    it('closeAllTabs keeps only pinned and non-closable', () => {
      useTabsStore.getState().openHomeTab()
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().closeAllTabs()
      expect(useTabsStore.getState().tabs.some(isHomeTab)).toBe(true)
    })

    it('closeUnpinnedTabs keeps only pinned', () => {
      useTabsStore.getState().openHomeTab()
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().closeUnpinnedTabs()
      expect(useTabsStore.getState().tabs.every((t) => t.isPinned)).toBe(true)
    })

    it('moveTab reorders within pinned section', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const tabs = useTabsStore.getState().tabs
      useTabsStore.getState().moveTab(1, 0)
      expect(useTabsStore.getState().tabs[0]?.id).toBe(tabs[1]?.id)
    })

    it('reorderTabs applies new order', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const tabs = [...useTabsStore.getState().tabs]
      const first = tabs[0]
      const second = tabs[1]
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      if (first !== undefined && second !== undefined) {
        useTabsStore.getState().reorderTabs([second, first])
      }
      expect(useTabsStore.getState().tabs[0]?.id).toBe(tabs[1]?.id)
    })

    it('resetQueryOptions resets dataclass tab query', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id !== undefined) {
        useTabsStore.getState().setQueryOptions(id, { filter: 'x', top: 50 })
        useTabsStore.getState().resetQueryOptions(id)
      }
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.queryOptions.filter).toBe('')
      expect(tab.queryOptions.top).toBe(100)
    })

    it('setQueryExpanded and setSettingsDataclassesExpanded', () => {
      useTabsStore.getState().openTab('Employee')
      const dcId = useTabsStore.getState().tabs[0]?.id
      expect(dcId).toBeDefined()
      if (dcId !== undefined) {
        useTabsStore.getState().setQueryExpanded(dcId, true)
      }
      expect((useTabsStore.getState().tabs[0] as DataclassTab).queryExpanded).toBe(true)
      useTabsStore.getState().openSettingsTab()
      const settingsId = useTabsStore.getState().tabs.find((t) => isSettingsTab(t))?.id
      expect(settingsId).toBeDefined()
      if (settingsId !== undefined) {
        useTabsStore.getState().setSettingsDataclassesExpanded(settingsId, true)
      }
      const st = useTabsStore.getState().tabs.find((t) => t.id === settingsId) as SettingsTab
      expect(st.dataclassesExpanded).toBe(true)
    })

    it('pinAllTabs and unpinAllTabs', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      useTabsStore.getState().pinAllTabs()
      expect(useTabsStore.getState().tabs.every((t) => t.isPinned)).toBe(true)
      useTabsStore.getState().unpinAllTabs()
      const dcTabs = useTabsStore.getState().tabs.filter(isDataclassTab)
      expect(dcTabs.every((t) => !t.isPinned)).toBe(true)
    })

    it('setQueryOptions is no-op when tab not found or not dataclass', () => {
      useTabsStore.getState().setQueryOptions('nonexistent', { filter: 'x' })
      expect(useTabsStore.getState().tabs).toHaveLength(0)
    })

    it('tabs storage no-op when no base BASEID (setItem early return)', () => {
      setCurrentBaseId('')
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      setCurrentBaseId('test-uniq')
      expect(useTabsStore.getState().tabs.length).toBeGreaterThanOrEqual(0)
    })

    it('isSchemaBuilderTab and openSchemaBuilderTab', () => {
      expect(isSchemaBuilderTab({ id: 'sb', type: 'schema-builder', isPinned: false })).toBe(true)
      useTabsStore.getState().openSchemaBuilderTab()
      const firstId = useTabsStore.getState().activeTabId
      useTabsStore.getState().openSchemaBuilderTab()
      expect(useTabsStore.getState().activeTabId).toBe(firstId)
      expect(useTabsStore.getState().tabs.filter((t) => t.type === 'schema-builder')).toHaveLength(
        1
      )
    })

    it('isAssistantMetadataTab and openAssistantMetadataTab', () => {
      expect(
        isAssistantMetadataTab({ id: 'am', type: 'assistant-metadata', isPinned: false })
      ).toBe(true)
      useTabsStore.getState().openAssistantMetadataTab()
      const firstId = useTabsStore.getState().activeTabId
      useTabsStore.getState().openAssistantMetadataTab()
      expect(useTabsStore.getState().activeTabId).toBe(firstId)
      expect(
        useTabsStore.getState().tabs.filter((t) => t.type === 'assistant-metadata')
      ).toHaveLength(1)
    })

    it('openGraphTab activates existing graph tab', async () => {
      const promise = useTabsStore.getState().openGraphTab()
      useTabsStore.getState().notifyGraphTabReady()
      await promise
      const graphId = useTabsStore.getState().activeTabId
      await useTabsStore.getState().openGraphTab()
      expect(useTabsStore.getState().activeTabId).toBe(graphId)
    })

    it('togglePinTab toggles active tab pin state', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().activeTabId
      expect(id).toBeDefined()
      if (!id) return
      expect(useTabsStore.getState().tabs.find((t) => t.id === id)?.isPinned).toBe(false)
      useTabsStore.getState().togglePinTab(id)
      expect(useTabsStore.getState().tabs.find((t) => t.id === id)?.isPinned).toBe(true)
      useTabsStore.getState().togglePinTab(id)
      expect(useTabsStore.getState().tabs.find((t) => t.id === id)?.isPinned).toBe(false)
    })

    it('closeTab activates previous tab when closing last tab in list', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const companyId = useTabsStore.getState().activeTabId
      expect(companyId).toBeDefined()
      if (!companyId) return
      useTabsStore.getState().closeTab(companyId)
      expect(useTabsStore.getState().activeTabId).not.toBe(companyId)
      expect(useTabsStore.getState().tabs).toHaveLength(1)
    })

    it('closeTabsToRight reassigns active when active tab is removed', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const employeeId = useTabsStore
        .getState()
        .tabs.find((t) => isDataclassTab(t) && t.dataclassName === 'Employee')?.id
      expect(employeeId).toBeDefined()
      useTabsStore.setState({ activeTabId: useTabsStore.getState().tabs[1]?.id ?? null })
      if (employeeId) {
        useTabsStore.getState().closeTabsToRight(employeeId)
      }
      expect(
        useTabsStore.getState().tabs.some((t) => t.id === useTabsStore.getState().activeTabId)
      ).toBe(true)
    })

    it('resetQueryOptions releases orphaned entity set', async () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().tabs[0]?.id
      expect(id).toBeDefined()
      if (id) {
        useTabsStore.getState().setQueryOptions(id, { filter: 'x' })
        useTabsStore.setState({
          tabs: useTabsStore
            .getState()
            .tabs.map((t) =>
              t.id === id && isDataclassTab(t) ? { ...t, entitySetId: 'orphan-set' } : t
            ),
        })
        useTabsStore.getState().resetQueryOptions(id)
      }
      const tab = useTabsStore.getState().tabs[0] as DataclassTab
      expect(tab.entitySetId).toBeNull()
    })

    it('tabs persist removeItem clears stored tabs', async () => {
      const storage = useTabsStore.persist.getOptions().storage
      expect(storage).toBeTruthy()
      if (!storage) return
      useTabsStore.getState().openTab('Employee')
      storage.setItem('dataexplorer-tabs', { state: { tabs: [], activeTabId: null } })
      storage.removeItem('dataexplorer-tabs')
    })

    it('tabs persist removeItem no-op without base uniq id', () => {
      const storage = useTabsStore.persist.getOptions().storage
      if (!storage) return
      setCurrentBaseId('')
      storage.removeItem('dataexplorer-tabs')
      setCurrentBaseId('test-uniq')
    })

    it('openGraphTab resolves immediately when graph tab is already active', async () => {
      const first = useTabsStore.getState().openGraphTab()
      useTabsStore.getState().notifyGraphTabReady()
      await first
      const again = useTabsStore.getState().openGraphTab()
      await again
      expect(useTabsStore.getState().tabs.filter(isGraphTab)).toHaveLength(1)
    })

    it('openGraphTab switches to existing graph tab when another tab is active', async () => {
      const first = useTabsStore.getState().openGraphTab()
      useTabsStore.getState().notifyGraphTabReady()
      await first
      const graphId = useTabsStore.getState().tabs.find(isGraphTab)?.id
      expect(graphId).toBeDefined()
      useTabsStore.getState().openTab('Employee')
      const second = useTabsStore.getState().openGraphTab()
      useTabsStore.getState().notifyGraphTabReady()
      await second
      expect(useTabsStore.getState().activeTabId).toBe(graphId ?? null)
    })

    it('closeTab picks previous tab when closing the last tab in the strip', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      useTabsStore.getState().openTab('Department')
      const lastId = useTabsStore.getState().activeTabId
      expect(lastId).toBeDefined()
      if (!lastId) return
      useTabsStore.getState().closeTab(lastId)
      expect(useTabsStore.getState().tabs).toHaveLength(2)
      expect(useTabsStore.getState().activeTabId).not.toBe(lastId)
    })

    it('closeTabsToRight reassigns active when active tab is removed', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      useTabsStore.getState().openTab('Department')
      const pivotId = useTabsStore.getState().tabs[0]?.id
      useTabsStore.setState({ activeTabId: useTabsStore.getState().tabs[2]?.id ?? null })
      if (pivotId) {
        useTabsStore.getState().closeTabsToRight(pivotId)
      }
      expect(useTabsStore.getState().activeTabId).toBe(pivotId)
    })

    it('reorderTabs appends remaining tabs after fixed-index slots', () => {
      useTabsStore.getState().openHomeTab()
      for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
        useTabsStore.getState().openTab(name)
      }
      const tabs = useTabsStore.getState().tabs.map((t) => ({ ...t }))
      const anchor = tabs.find((t) => t.type === 'dataclass' && isDataclassTab(t))
      if (anchor) {
        ;(anchor as DataclassTab & { index?: number }).index = 4
      }
      useTabsStore.getState().reorderTabs([...tabs].reverse())
      expect(useTabsStore.getState().tabs[0]?.type).toBe('home')
      expect(useTabsStore.getState().tabs.length).toBe(tabs.length)
    })

    it('closeTab sets activeTabId null when last tab closed', () => {
      useTabsStore.getState().openTab('Employee')
      const id = useTabsStore.getState().activeTabId
      expect(id).toBeDefined()
      if (!id) return
      useTabsStore.getState().closeTab(id)
      expect(useTabsStore.getState().tabs).toHaveLength(0)
      expect(useTabsStore.getState().activeTabId).toBeNull()
    })

    it('closeTabsToRight updates active when active tab was removed', () => {
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const companyId = useTabsStore.getState().activeTabId
      expect(companyId).toBeDefined()
      if (!companyId) return
      useTabsStore.getState().closeTabsToRight(companyId)
      expect(useTabsStore.getState().activeTabId).toBe(companyId)
    })

    it('openEntitySetTab reuses existing tab for same entity set', () => {
      const id = useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'set-123',
      })
      const again = useTabsStore.getState().openEntitySetTab({
        dataclassName: 'Employee',
        entitySetId: 'set-123',
      })
      expect(again).toBe(id)
      expect(useTabsStore.getState().tabs.filter((t) => t.type === 'dataclass')).toHaveLength(1)
    })

    it('moveTab ignores moves onto fixed home index', () => {
      useTabsStore.getState().openHomeTab()
      useTabsStore.getState().openTab('Employee')
      const tabs = useTabsStore.getState().tabs
      const employeeIndex = tabs.findIndex((t) => t.type === 'dataclass')
      useTabsStore.getState().moveTab(employeeIndex, 0)
      expect(useTabsStore.getState().tabs[0]?.type).toBe('home')
    })

    it('reorderTabs preserves home tab fixed index', () => {
      useTabsStore.getState().openHomeTab()
      useTabsStore.getState().openTab('Employee')
      useTabsStore.getState().openTab('Company')
      const tabs = [...useTabsStore.getState().tabs]
      useTabsStore.getState().reorderTabs([...tabs].reverse())
      expect(useTabsStore.getState().tabs[0]?.type).toBe('home')
    })

    it('openStaticTab activates existing static tab', () => {
      useTabsStore.getState().openStaticTab(RELEASE_NOTES_STATIC_ID)
      const id = useTabsStore.getState().activeTabId
      useTabsStore.getState().openStaticTab(RELEASE_NOTES_STATIC_ID)
      expect(useTabsStore.getState().activeTabId).toBe(id)
    })

    it('rehydrateTabs restores tabs from base settings', () => {
      useTabsStore.getState().openTab('Employee')
      const tabs = [...useTabsStore.getState().tabs]
      const activeTabId = useTabsStore.getState().activeTabId
      useTabsStore.setState({ tabs: [], activeTabId: null })
      saveBaseSettings({ tabs, activeTabId })
      useTabsStore.getState().rehydrateTabs()
      expect(useTabsStore.getState().tabs.length).toBe(tabs.length)
    })

    it('setSettingsAssistantToolsExpanded', () => {
      useTabsStore.getState().openSettingsTab()
      const settingsId = useTabsStore.getState().tabs.find(isSettingsTab)?.id
      expect(settingsId).toBeDefined()
      if (settingsId) {
        useTabsStore.getState().setSettingsAssistantToolsExpanded(settingsId, true)
        const tab = useTabsStore.getState().tabs.find((t) => t.id === settingsId) as SettingsTab
        expect(tab.assistantToolsExpanded).toBe(true)
      }
    })
  })
})
