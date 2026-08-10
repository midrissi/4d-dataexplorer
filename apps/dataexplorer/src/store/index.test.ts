import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { setCurrentBaseId } from '~/lib/storage'
import {
  mockCatalogClearCache,
  mockCatalogGetAllWithMetadataCached,
  mockDataclassCount,
  mockDataclassCreate,
  mockDataclassDelete,
  mockDataclassFetch,
  mockDataclassUpdate,
  mockFetchPage,
  mockToEntitySet,
} from '../test-rest-mock'
import { type Entity, useDataExplorerStore } from './index'
import { useTabsStore } from './tabs'

// Re-import api helpers after mocks are wired (test-setup preloads test-rest-mock)
const { api } = await import('~/lib/api')

describe('store/index', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    useTabsStore.setState({ tabs: [], activeTabId: null })
    useDataExplorerStore.setState({
      dataclasses: [],
      dataclassesLoading: false,
      dataclassesError: null,
      selectedDataclass: null,
      entities: [],
      entitiesLoading: false,
      entitiesError: null,
      pagination: null,
      selectedEntity: null,
      selectedEntityId: null,
      isEditing: false,
      editedEntity: null,
      searchQuery: '',
    })
    mockDataclassCount.mockClear()
    mockDataclassFetch.mockClear()
    mockToEntitySet.mockClear()
    mockFetchPage.mockClear()
  })

  describe('fetchDataclasses', () => {
    it('loads dataclasses on success', async () => {
      mockCatalogClearCache.mockClear()
      await useDataExplorerStore.getState().fetchDataclasses()
      expect(mockCatalogClearCache).toHaveBeenCalled()
      expect(useDataExplorerStore.getState().dataclasses).toHaveLength(2)
      expect(useDataExplorerStore.getState().dataclassesLoading).toBe(false)
      expect(useDataExplorerStore.getState().dataclassesError).toBeNull()
    })

    it('sets error message when fetch fails', async () => {
      mockCatalogGetAllWithMetadataCached.mockRejectedValueOnce(new Error('network down'))
      await useDataExplorerStore.getState().fetchDataclasses()
      expect(useDataExplorerStore.getState().dataclassesError).toBe('network down')
      expect(useDataExplorerStore.getState().dataclassesLoading).toBe(false)
    })

    it('sets generic error for non-Error throws', async () => {
      mockCatalogGetAllWithMetadataCached.mockRejectedValueOnce('nope')
      await useDataExplorerStore.getState().fetchDataclasses()
      expect(useDataExplorerStore.getState().dataclassesError).toBe('Failed to fetch dataclasses')
    })
  })

  describe('selectDataclass', () => {
    it('clears entity state when selecting null', () => {
      useDataExplorerStore.setState({
        selectedDataclass: 'Employee',
        entities: [{ id: '1', __KEY: '1', __STAMP: 1 } as Entity],
        searchQuery: 'x',
      })
      useDataExplorerStore.getState().selectDataclass(null)
      const state = useDataExplorerStore.getState()
      expect(state.selectedDataclass).toBeNull()
      expect(state.entities).toEqual([])
      expect(state.searchQuery).toBe('')
    })

    it('fetches entities when a dataclass is selected', async () => {
      useDataExplorerStore.getState().selectDataclass('Employee')
      await Bun.sleep(20)
      expect(useDataExplorerStore.getState().selectedDataclass).toBe('Employee')
      expect(useDataExplorerStore.getState().entities.length).toBeGreaterThan(0)
    })
  })

  describe('fetchEntities', () => {
    it('returns early when no dataclass selected', async () => {
      await useDataExplorerStore.getState().fetchEntities()
      expect(mockToEntitySet).not.toHaveBeenCalled()
    })

    it('fetches with query override on bound entity set', async () => {
      useTabsStore.getState().openTab('Employee')
      const tabId = useTabsStore.getState().activeTabId
      expect(tabId).toBeTruthy()
      if (tabId) {
        useTabsStore.getState().setEntitySetId(tabId, 'bound-set')
      }

      useDataExplorerStore.getState().selectDataclass('Employee')
      await useDataExplorerStore.getState().fetchEntities(1, {
        filter: 'name eq :1',
        filterParams: [{ type: 'string', value: 'Alice' }],
        sort: 'name',
        order: 'asc',
        select: 'name,id',
        top: 10,
      })

      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (tab && tab.type === 'dataclass') {
        expect(tab.entitySetId).toBe('bound-set')
      }
      expect(mockToEntitySet).not.toHaveBeenCalled()
      expect(mockFetchPage).toHaveBeenCalled()
      expect(useDataExplorerStore.getState().entities).toHaveLength(2)
    })

    it('uses active tab query options and bound entity set', async () => {
      useTabsStore.getState().openTab('Employee')
      const tabId = useTabsStore.getState().activeTabId
      expect(tabId).toBeDefined()
      if (!tabId) return
      useTabsStore.getState().setEntitySetId(tabId, 'existing-set-id')

      useDataExplorerStore.setState({ selectedDataclass: 'Employee' })
      await useDataExplorerStore.getState().fetchEntities()

      expect(mockToEntitySet).not.toHaveBeenCalled()
      expect(useDataExplorerStore.getState().entitiesLoading).toBe(false)
    })

    it('sets entitiesError on failure', async () => {
      useDataExplorerStore.setState({ selectedDataclass: 'Employee' })
      mockDataclassFetch.mockRejectedValueOnce(new Error('fetch failed'))
      await useDataExplorerStore.getState().fetchEntities()
      expect(useDataExplorerStore.getState().entitiesError).toBe('fetch failed')
    })
  })

  describe('entity selection and editing', () => {
    const entity: Entity = { id: '1', __KEY: '1', __STAMP: 1, name: 'Alice' }

    it('selectEntity sets selection and edited JSON', () => {
      useDataExplorerStore.getState().selectEntity(entity)
      const state = useDataExplorerStore.getState()
      expect(state.selectedEntity).toEqual(entity)
      expect(state.selectedEntityId).toBe('1')
      expect(state.editedEntity).toContain('Alice')
    })

    it('selectEntity null clears selection', () => {
      useDataExplorerStore.getState().selectEntity(entity)
      useDataExplorerStore.getState().selectEntity(null)
      expect(useDataExplorerStore.getState().selectedEntity).toBeNull()
    })

    it('setSearchQuery updates query', () => {
      useDataExplorerStore.getState().setSearchQuery('test')
      expect(useDataExplorerStore.getState().searchQuery).toBe('test')
    })

    it('setIsEditing toggles edit mode with JSON snapshot', () => {
      useDataExplorerStore.getState().selectEntity(entity)
      useDataExplorerStore.getState().setIsEditing(true)
      expect(useDataExplorerStore.getState().isEditing).toBe(true)
      expect(useDataExplorerStore.getState().editedEntity).toContain('Alice')
      useDataExplorerStore.getState().setIsEditing(false)
      expect(useDataExplorerStore.getState().editedEntity).toBeNull()
    })

    it('setEditedEntity updates raw edit buffer', () => {
      useDataExplorerStore.getState().setEditedEntity('{"x":1}')
      expect(useDataExplorerStore.getState().editedEntity).toBe('{"x":1}')
    })
  })

  describe('createEntity', () => {
    it('no-ops without selected dataclass', async () => {
      await useDataExplorerStore.getState().createEntity({ name: 'X' })
      expect(mockDataclassCreate).not.toHaveBeenCalled()
    })

    it('creates entity and refreshes view', async () => {
      useDataExplorerStore.setState({ selectedDataclass: 'Employee' })
      await useDataExplorerStore.getState().createEntity({ name: 'New' })
      expect(mockDataclassCreate).toHaveBeenCalled()
      expect(useDataExplorerStore.getState().entities.length).toBeGreaterThan(0)
    })

    it('skips list refresh when refresh is false', async () => {
      useDataExplorerStore.setState({ selectedDataclass: 'Employee', entities: [] })
      await useDataExplorerStore.getState().createEntity({ name: 'New' }, { refresh: false })
      expect(mockDataclassCreate).toHaveBeenCalled()
      expect(useDataExplorerStore.getState().entities).toEqual([])
    })
  })

  describe('updateEntity', () => {
    it('no-ops without selected dataclass', async () => {
      await useDataExplorerStore.getState().updateEntity('1', { name: 'X' })
      expect(mockDataclassUpdate).not.toHaveBeenCalled()
    })

    it('updates entity and refreshes list', async () => {
      useDataExplorerStore.setState({ selectedDataclass: 'Employee' })
      await useDataExplorerStore.getState().updateEntity('1', { name: 'Updated' })
      expect(mockDataclassUpdate).toHaveBeenCalledWith('1', { name: 'Updated' })
      expect(useDataExplorerStore.getState().selectedEntity?.name).toBe('Updated')
      expect(useDataExplorerStore.getState().isEditing).toBe(false)
    })
  })

  describe('deleteEntity', () => {
    it('no-ops without selected dataclass', async () => {
      await useDataExplorerStore.getState().deleteEntity('1')
      expect(mockDataclassDelete).not.toHaveBeenCalled()
    })

    it('deletes entity and clears selection', async () => {
      useDataExplorerStore.setState({
        selectedDataclass: 'Employee',
        selectedEntity: { id: '1', __KEY: '1', __STAMP: 1 } as Entity,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      })
      await useDataExplorerStore.getState().deleteEntity('1')
      expect(mockDataclassDelete).toHaveBeenCalledWith('1')
      expect(useDataExplorerStore.getState().selectedEntity).toBeNull()
    })
  })

  describe('refreshCurrentView', () => {
    it('refetches dataclasses only when none selected', async () => {
      const spy = mock(() => api.getDataclasses())
      await useDataExplorerStore.getState().refreshCurrentView()
      expect(useDataExplorerStore.getState().dataclasses.length).toBeGreaterThan(0)
      spy.mockRestore()
    })

    it('refetches dataclasses and entities when dataclass selected', async () => {
      useDataExplorerStore.setState({
        selectedDataclass: 'Employee',
        pagination: { page: 2, limit: 20, total: 100, totalPages: 5, hasNext: true, hasPrev: true },
      })
      await useDataExplorerStore.getState().refreshCurrentView()
      expect(useDataExplorerStore.getState().entities.length).toBeGreaterThan(0)
    })
  })

  describe('syncActiveTab', () => {
    it('clears active mirror for non-dataclass tabs', () => {
      useDataExplorerStore.setState({ selectedDataclass: 'Employee' })
      useTabsStore.getState().openHomeTab()
      useDataExplorerStore.getState().syncActiveTab()
      expect(useDataExplorerStore.getState().selectedDataclass).toBeNull()
    })

    it('restores cached slice when present', () => {
      useTabsStore.getState().openTab('Employee')
      const activeId = useTabsStore.getState().activeTabId as string
      useDataExplorerStore.setState({
        tabData: {
          [activeId]: {
            entities: [{ id: '7', __KEY: '7', __STAMP: 1 } as Entity],
            pagination: null,
            selectedEntity: null,
            selectedEntityId: null,
            entitiesLoading: false,
            entitiesError: null,
            isEditing: false,
            editedEntity: null,
          },
        },
      })
      useDataExplorerStore.getState().syncActiveTab(activeId)
      const state = useDataExplorerStore.getState()
      expect(state.selectedDataclass).toBe('Employee')
      expect(state.entities).toHaveLength(1)
    })

    it('sets dataclass and fetches on first activation', async () => {
      useTabsStore.getState().openTab('Employee')
      const activeId = useTabsStore.getState().activeTabId as string
      useDataExplorerStore.setState({ tabData: {} })
      useDataExplorerStore.getState().syncActiveTab(activeId)
      expect(useDataExplorerStore.getState().selectedDataclass).toBe('Employee')
    })
  })

  describe('clearTabData', () => {
    it('removes cached slice for a tab id', () => {
      useDataExplorerStore.setState({
        tabData: { 'tab-1': { entities: [], pagination: null } as never },
      })
      useDataExplorerStore.getState().clearTabData('tab-1')
      expect('tab-1' in useDataExplorerStore.getState().tabData).toBe(false)
    })

    it('is a no-op for an unknown tab id', () => {
      useDataExplorerStore.setState({ tabData: {} })
      useDataExplorerStore.getState().clearTabData('missing')
      expect(useDataExplorerStore.getState().tabData).toEqual({})
    })
  })
})
