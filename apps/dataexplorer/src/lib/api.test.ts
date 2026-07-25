import { beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  mockCatalogGetAll,
  mockCatalogGetAllCached,
  mockCatalogGetAllWithMetadataCached,
  mockCatalogGetDataClasses,
  mockCombineToEntitySet,
  mockDataclassCount,
  mockDataclassCreate,
  mockDataclassDelete,
  mockDataclassFetch,
  mockDataclassGet,
  mockDataclassUpdate,
  mockDataclassUpdateMany,
  mockEntitySetDelete,
  mockEntitySetFetch,
  mockEntitySetIntersects,
  mockFetchPage,
  mockInfoGetInfo,
  mockQueryDelete,
  mockReleaseEntitySet,
  mockToEntitySet,
} from '../test-rest-mock'
import { api, clearCatalogCacheAndStorage, clearEntitySetCache } from './api'

describe('lib/api', () => {
  beforeEach(async () => {
    clearEntitySetCache()
    clearCatalogCacheAndStorage()
    const { useTabsStore } = await import('~/store/tabs')
    useTabsStore.setState({ tabs: [], activeTabId: null })
    mockCatalogGetDataClasses.mockClear()
    mockCatalogGetAll.mockClear()
    mockCatalogGetAllCached.mockClear()
    mockCatalogGetAllWithMetadataCached.mockClear()
    mockInfoGetInfo.mockClear()
    mockDataclassCount.mockClear()
    mockDataclassFetch.mockClear()
    mockToEntitySet.mockClear()
    mockFetchPage.mockClear()
    mockReleaseEntitySet.mockClear()
    mockDataclassGet.mockClear()
    mockDataclassCreate.mockClear()
    mockDataclassUpdate.mockClear()
    mockDataclassUpdateMany.mockClear()
    mockDataclassDelete.mockClear()
    mockQueryDelete.mockClear()
    mockEntitySetFetch.mockClear()
    mockEntitySetDelete.mockClear()
    mockCombineToEntitySet.mockClear()
    mockEntitySetIntersects.mockClear()
  })

  describe('getServerInfo', () => {
    it('returns server info from client.info.getInfo()', async () => {
      const result = await api.getServerInfo()
      expect(mockInfoGetInfo).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        cacheSize: 0,
        usedCache: 0,
        entitySetCount: 0,
        entitySet: [],
        ProgressInfo: [],
        sessionInfo: [],
        privileges: [],
      })
    })
  })

  describe('getDataclasses', () => {
    it('returns dataclasses with counts', async () => {
      const result = await api.getDataclasses()
      expect(mockCatalogGetAllWithMetadataCached).toHaveBeenCalledTimes(1)
      expect(mockDataclassCount).toHaveBeenCalledTimes(2) // Employee, Company
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ name: 'Employee', collectionName: 'Employees', count: 42 })
      expect(result[1]).toEqual({ name: 'Company', collectionName: 'Companies', count: 42 })
    })

    it('returns empty array when catalog has no dataClasses', async () => {
      mockCatalogGetAllWithMetadataCached.mockResolvedValueOnce({
        __UNIQID: 'test',
        __BASEID: 'test-base',
        dataClasses: [],
      })
      const result = await api.getDataclasses()
      expect(result).toEqual([])
    })

    it('returns empty array when catalog.dataClasses is empty', async () => {
      mockCatalogGetAllWithMetadataCached.mockResolvedValueOnce({
        __UNIQID: 'test',
        __BASEID: 'test-base',
        dataClasses: [],
      })
      const result = await api.getDataclasses()
      expect(result).toEqual([])
    })
  })

  describe('getDataclassSchema', () => {
    it('returns schema when dataclass exists', async () => {
      const result = await api.getDataclassSchema('Employee')
      expect(mockCatalogGetAllWithMetadataCached).toHaveBeenCalledTimes(1)
      expect(result.dataclass).toBe('Employee')
      expect(result.attributes).toHaveLength(2)
      expect(result.attributes?.[0]).toMatchObject({
        name: 'id',
        type: 'long',
        kind: 'scalar',
        indexed: false,
        unique: true,
        readOnly: true,
      })
      expect(result.key).toBe('id')
    })

    it('throws when dataclass not found', async () => {
      mockCatalogGetAllWithMetadataCached.mockResolvedValueOnce({
        __UNIQID: 'test',
        __BASEID: 'test-base',
        dataClasses: [],
      })
      await expect(api.getDataclassSchema('Missing')).rejects.toThrow(
        'Dataclass Missing not found in catalog'
      )
    })
  })

  describe('getEntities', () => {
    it('returns entities and pagination with defaults', async () => {
      const result = await api.getEntities('Employee')
      expect(result.dataclass).toBe('Employee')
      expect(result.entities).toHaveLength(2)
      expect(result.entities[0]).toMatchObject({ id: '1', name: 'Alice' })
      expect(result.entitySetId).toBe('mock-entity-set-id')
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      })
    })

    it('reuses entity set when only page/limit change (same filter/sort/select)', async () => {
      await api.getEntities('Employee', { page: 1, limit: 20 })
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
      expect(mockFetchPage).toHaveBeenCalledTimes(1)
      const result = await api.getEntities('Employee', { page: 2, limit: 20 })
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.hasPrev).toBe(true)
      expect(mockReleaseEntitySet).not.toHaveBeenCalled()
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
      expect(mockFetchPage).toHaveBeenCalledTimes(2)
    })

    it('passes filter, sort, order, select when provided', async () => {
      await api.getEntities('Employee', {
        page: 2,
        limit: 10,
        filter: 'name ne null',
        sort: 'name',
        order: 'asc',
        select: ['name', 'id'],
      })
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
      expect(mockFetchPage).toHaveBeenCalledTimes(1)
      // Entity-set page fetch must not re-send $filter/$params (already applied at create).
      expect(mockFetchPage.mock.calls[0]?.[2]).toEqual({
        $orderby: '"name asc"',
        $attributes: 'name,id',
      })
      const result = await api.getEntities('Employee', { page: 2, limit: 10 })
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.hasPrev).toBe(true)
      // Second call has different query (no filter/sort/select) so releases old entity set and creates new one
      expect(mockReleaseEntitySet).toHaveBeenCalledTimes(1)
      expect(mockToEntitySet).toHaveBeenCalledTimes(2)
      expect(mockFetchPage).toHaveBeenCalledTimes(2)
    })

    it('does not re-apply filterParams on entity-set page fetch', async () => {
      await api.getEntities('Employee', {
        filter: 'ID in :1',
        filterParams: [{ type: 'json', value: '[9,13,4]' }],
        select: ['ID'],
      })
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
      expect(mockFetchPage).toHaveBeenCalledTimes(1)
      const pageOptions = mockFetchPage.mock.calls[0]?.[2]
      expect(pageOptions).toBeDefined()
      expect(pageOptions?.$filter).toBeUndefined()
      expect(pageOptions?.$params).toBeUndefined()
      expect(pageOptions?.$attributes).toBe('ID')
    })

    it('loads from existing entity set id without creating a new one', async () => {
      const result = await api.getEntities('Employee', {
        entitySetId: 'existing-set-id',
        page: 1,
        limit: 20,
      })
      expect(mockToEntitySet).not.toHaveBeenCalled()
      expect(mockFetchPage).toHaveBeenCalledTimes(1)
      expect(result.entitySetId).toBe('existing-set-id')
      expect(result.entities).toHaveLength(2)
    })

    it('queries without creating an entity set when createEntitySet is false', async () => {
      const result = await api.getEntities('Employee', {
        page: 1,
        limit: 20,
        filter: 'name ne null',
        createEntitySet: false,
      })
      expect(mockToEntitySet).not.toHaveBeenCalled()
      expect(mockFetchPage).not.toHaveBeenCalled()
      expect(mockDataclassFetch).toHaveBeenCalledTimes(1)
      expect(result.entitySetId).toBe('')
      expect(result.entities).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
    })

    it('applies sort/select/expand but not filter when loading from an existing entity set', async () => {
      await api.getEntities('Employee', {
        entitySetId: 'existing-set-id',
        page: 1,
        limit: 10,
        filter: 'name ne null',
        sort: 'name',
        order: 'asc',
        select: ['name', 'id'],
        expand: ['employer'],
      })

      expect(mockToEntitySet).not.toHaveBeenCalled()
      expect(mockFetchPage).toHaveBeenCalledTimes(1)
      const pageOptions = mockFetchPage.mock.calls[0]?.[2]
      expect(pageOptions).toBeDefined()
      expect(pageOptions?.$filter).toBeUndefined()
      expect(pageOptions?.$params).toBeUndefined()
      expect(mockFetchPage).toHaveBeenCalledWith(
        0,
        10,
        expect.objectContaining({
          $orderby: '"name asc"',
          $attributes: 'name,id',
          $expand: 'employer',
        })
      )
    })

    it('passes expand when querying without an entity set', async () => {
      await api.getEntities('Employee', {
        page: 1,
        limit: 20,
        expand: ['employer', 'manager.*'],
        createEntitySet: false,
      })
      expect(mockDataclassFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createEntitySet', () => {
    it('creates entity set and returns id and count', async () => {
      const result = await api.createEntitySet('Employee', { filter: 'name ne null' })
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        id: 'mock-entity-set-id',
        uri: 'http://test/rest/Employee/$entityset/mock-entity-set-id',
        dataclass: 'Employee',
        count: 100,
      })
    })
  })

  describe('combineEntitySets', () => {
    it('creates a new entity set for AND', async () => {
      const result = await api.combineEntitySets('Employee', {
        entitySetId: 'set-a',
        otherEntitySetId: 'set-b',
        operator: 'AND',
      })
      expect(mockCombineToEntitySet).toHaveBeenCalledWith('AND', 'set-b', 7200)
      expect(result).toEqual({
        dataclass: 'Employee',
        operator: 'AND',
        entitySetId: 'combined-entity-set-id',
        sourceEntitySetIds: ['set-a', 'set-b'],
        uri: 'http://localhost:3002/rest/Employee/$entityset/combined-entity-set-id',
        count: 72,
      })
    })

    it('returns intersects for INTERSECT without creating a set', async () => {
      const result = await api.combineEntitySets('Employee', {
        entitySetId: 'set-a',
        otherEntitySetId: 'set-b',
        operator: 'intersect',
      })
      expect(mockEntitySetIntersects).toHaveBeenCalledWith('set-b')
      expect(mockCombineToEntitySet).not.toHaveBeenCalled()
      expect(result).toEqual({
        dataclass: 'Employee',
        operator: 'INTERSECT',
        entitySetId: 'set-a',
        otherEntitySetId: 'set-b',
        intersects: true,
      })
    })
  })

  describe('releaseEntitySets', () => {
    it('releases multiple entity sets in one call', async () => {
      const result = await api.releaseEntitySets([
        { dataClass: 'Employee', entitySetId: 'set-a' },
        { dataClass: 'Company', entitySetId: 'set-b' },
      ])
      expect(mockReleaseEntitySet).toHaveBeenCalledTimes(2)
      expect(mockReleaseEntitySet).toHaveBeenNthCalledWith(1, 'Employee', 'set-a')
      expect(mockReleaseEntitySet).toHaveBeenNthCalledWith(2, 'Company', 'set-b')
      expect(result).toEqual({
        count: 2,
        detachedTabs: 0,
        results: [
          { dataclass: 'Employee', entitySetId: 'set-a', released: true },
          { dataclass: 'Company', entitySetId: 'set-b', released: true },
        ],
      })
    })
  })

  describe('releaseEntitySet', () => {
    it('calls client.releaseEntitySet and clears dataclass cache entry', async () => {
      await api.getEntities('Employee')
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
      const result = await api.releaseEntitySet('Employee', 'mock-entity-set-id')
      expect(mockReleaseEntitySet).toHaveBeenCalledWith('Employee', 'mock-entity-set-id')
      expect(result).toEqual({
        dataclass: 'Employee',
        entitySetId: 'mock-entity-set-id',
        released: true,
        detachedTabs: 0,
      })
    })
  })

  describe('getEntity', () => {
    it('returns entity with id from __KEY', async () => {
      const result = await api.getEntity('Employee', '1')
      expect(mockDataclassGet).toHaveBeenCalledWith('1')
      expect(result.dataclass).toBe('Employee')
      expect(result.entity).toMatchObject({ id: '1', name: 'Alice' })
    })
  })

  describe('createEntity', () => {
    it('returns created entity with id', async () => {
      const result = await api.createEntity('Employee', { name: 'New' })
      expect(mockDataclassCreate).toHaveBeenCalledWith({ name: 'New' })
      expect(result.dataclass).toBe('Employee')
      expect(result.entity).toMatchObject({ id: '99', name: 'New' })
      expect(result.created).toBe(true)
    })
  })

  describe('updateEntity', () => {
    it('returns updated entity', async () => {
      const result = await api.updateEntity('Employee', '1', { name: 'Updated' })
      expect(mockDataclassUpdate).toHaveBeenCalledWith('1', { name: 'Updated' })
      expect(result.dataclass).toBe('Employee')
      expect(result.entity).toMatchObject({ id: '1', name: 'Updated' })
      expect(result.updated).toBe(true)
    })
  })

  describe('deleteEntity', () => {
    it('returns deleted id', async () => {
      const result = await api.deleteEntity('Employee', '1')
      expect(mockDataclassDelete).toHaveBeenCalledWith('1')
      expect(result.dataclass).toBe('Employee')
      expect(result.id).toBe('1')
      expect(result.deleted).toBe(true)
    })
  })

  describe('deleteManyEntities', () => {
    it('deletes by filter and returns count', async () => {
      const result = await api.deleteManyEntities('Employee', { filter: 'active = false' })
      expect(mockQueryDelete).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        dataclass: 'Employee',
        deleted: true,
        count: 100,
        filter: 'active = false',
      })
    })

    it('deletes by entity set id and returns count', async () => {
      const result = await api.deleteManyEntities('Employee', { entitySetId: 'set-123' })
      expect(mockEntitySetFetch).toHaveBeenCalledTimes(1)
      expect(mockEntitySetDelete).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        dataclass: 'Employee',
        deleted: true,
        count: 72,
        entitySetId: 'set-123',
      })
    })

    it('deletes by keys via __KEY in :1 and returns count', async () => {
      const result = await api.deleteManyEntities('Employee', { keys: ['1', '2', 3] })
      expect(mockQueryDelete).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        dataclass: 'Employee',
        deleted: true,
        count: 100,
        keys: ['1', '2', '3'],
      })
    })
  })

  describe('createManyEntities', () => {
    it('creates multiple entities in one request', async () => {
      const payload = [{ name: 'A' }, { name: 'B' }]
      const result = await api.createManyEntities('Employee', payload)
      expect(mockDataclassUpdateMany).toHaveBeenCalledWith(payload)
      expect(result.dataclass).toBe('Employee')
      expect(result.created).toBe(true)
      expect(result.count).toBe(2)
      expect(result.entities).toHaveLength(2)
    })
  })

  describe('updateManyEntities', () => {
    it('updates multiple entities in one request', async () => {
      const payload = [
        { __KEY: '1', __STAMP: 1, name: 'Updated' },
        { __KEY: '2', __STAMP: 2, name: 'Updated' },
      ]
      const result = await api.updateManyEntities('Employee', payload)
      expect(mockDataclassUpdateMany).toHaveBeenCalledWith(payload)
      expect(result.dataclass).toBe('Employee')
      expect(result.updated).toBe(true)
      expect(result.count).toBe(2)
      expect(result.entities).toHaveLength(2)
    })
  })

  describe('uploadFile', () => {
    it('sends POST and returns ID on success', async () => {
      const originalFetch = globalThis.fetch
      const mockFetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        expect(request.url).toContain('$upload')
        expect(request.method).toBe('POST')
        return Promise.resolve(new Response(JSON.stringify({ ID: 'upload-123' }), { status: 200 }))
      })
      ;(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

      const file = new File(['content'], 'test.png', { type: 'image/png' })
      const result = await api.uploadFile(file, true)
      expect(result).toEqual({ ID: 'upload-123' })
      expect(mockFetch).toHaveBeenCalledTimes(1)

      ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
    })

    it('throws on non-ok response', async () => {
      const originalFetch = globalThis.fetch
      ;(globalThis as { fetch: typeof fetch }).fetch = mock(() =>
        Promise.resolve(new Response('Forbidden', { status: 403 }))
      ) as unknown as typeof fetch

      const file = new File(['x'], 'a.bin', { type: 'application/octet-stream' })
      await expect(api.uploadFile(file, false)).rejects.toThrow(/Upload failed/)

      ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
    })
  })

  describe('initializeStorage', () => {
    it('calls catalog.getAllWithMetadataCached and rehydrates tabs; second call is no-op', async () => {
      const { setCurrentBaseId } = await import('~/lib/storage')
      const { useTabsStore } = await import('~/store/tabs')
      setCurrentBaseId('')
      const rehydrateSpy = mock(() => {})
      const orig = useTabsStore.getState().rehydrateTabs
      useTabsStore.setState({ rehydrateTabs: rehydrateSpy })

      await api.initializeStorage()
      expect(mockCatalogGetAllWithMetadataCached).toHaveBeenCalledTimes(1)
      expect(rehydrateSpy).toHaveBeenCalledTimes(1)

      await api.initializeStorage()
      expect(mockCatalogGetAllWithMetadataCached).toHaveBeenCalledTimes(1)
      useTabsStore.setState({ rehydrateTabs: orig })
    })
  })

  describe('clearCatalogCacheAndStorage', () => {
    it('allows initializeStorage to refetch catalog', async () => {
      await api.initializeStorage()
      clearCatalogCacheAndStorage()
      await api.initializeStorage()
      expect(mockCatalogGetAllWithMetadataCached.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getDataclasses count fallback', () => {
    it('returns count 0 when count() throws', async () => {
      mockDataclassCount.mockRejectedValueOnce(new Error('count failed'))
      const result = await api.getDataclasses()
      expect(result[0]?.count).toBe(0)
    })
  })

  describe('getEntities filterParams coercion', () => {
    it('passes coerced filter params for mixed types', async () => {
      await api.getEntities('Employee', {
        filter: 'x eq :1 and y eq :2 and z eq :3 and d eq :4 and j eq :5',
        filterParams: [
          { type: 'number', value: '42' },
          { type: 'boolean', value: 'true' },
          { type: 'date', value: '2024-01-01' },
          { type: 'json', value: '{"a":1}' },
          { type: 'string', value: 'hello' },
        ],
      })
      expect(mockToEntitySet).toHaveBeenCalledTimes(1)
    })

    it('handles invalid number and json filter params', async () => {
      await api.getEntities('Employee', {
        filter: 'x eq :1',
        filterParams: [
          { type: 'number', value: 'not-a-number' },
          { type: 'json', value: 'not-json' },
          { type: 'boolean', value: '0' },
          { type: 'date', value: '  ' },
        ],
      })
      expect(mockToEntitySet).toHaveBeenCalled()
    })
  })

  describe('loginWithAccessKey', () => {
    it('succeeds when server returns isLogged', async () => {
      const originalFetch = globalThis.fetch
      ;(globalThis as { fetch: typeof fetch }).fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true, isLogged: true }), { status: 200 })
        )
      ) as unknown as typeof fetch
      await expect(api.loginWithAccessKey('secret-key')).resolves.toBeUndefined()
      ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
    })

    it('throws on HTTP error', async () => {
      const originalFetch = globalThis.fetch
      ;(globalThis as { fetch: typeof fetch }).fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ errors: ['bad key'] }), { status: 401 }))
      ) as unknown as typeof fetch
      await expect(api.loginWithAccessKey('x')).rejects.toThrow('bad key')
      ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
    })

    it('throws when isLogged is false', async () => {
      const originalFetch = globalThis.fetch
      ;(globalThis as { fetch: typeof fetch }).fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ isLogged: false, errors: ['denied'] }), { status: 200 })
        )
      ) as unknown as typeof fetch
      await expect(api.loginWithAccessKey('x')).rejects.toThrow('denied')
      ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
    })
  })

  describe('releaseEntitySet errors', () => {
    it('swallows release failures', async () => {
      await api.getEntities('Employee')
      mockReleaseEntitySet.mockRejectedValueOnce(new Error('already released'))
      await expect(api.releaseEntitySet('Employee', 'mock-entity-set-id')).resolves.toEqual({
        dataclass: 'Employee',
        entitySetId: 'mock-entity-set-id',
        released: true,
        detachedTabs: 0,
      })
    })
  })
})
