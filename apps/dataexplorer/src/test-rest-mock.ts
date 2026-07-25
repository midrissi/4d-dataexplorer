import { mock } from 'bun:test'
import {
  normalizeFilterExpression,
  normalizeOrderByExpression,
} from '../../../packages/rest/src/resources/query-builder'

export const mockCatalogGetDataClasses = mock(() =>
  Promise.resolve({ __UNIQID: 'test-uniq', __BASEID: 'test-base' })
)
export const mockCatalogGetAll = mock(() =>
  Promise.resolve({
    dataClasses: [
      { name: 'Employee', collectionName: 'Employees' },
      { name: 'Company', collectionName: 'Companies' },
    ],
  })
)
export const fullCatalogDataClasses = [
  {
    name: 'Employee',
    collectionName: 'Employees',
    attributes: [
      {
        name: 'id',
        type: 'long',
        kind: 'scalar',
        indexed: false,
        unique: true,
        readOnly: true,
      },
      {
        name: 'name',
        type: 'string',
        kind: 'scalar',
        indexed: true,
        unique: false,
        readOnly: false,
      },
    ],
    key: [{ name: 'id' }],
  },
  {
    name: 'Company',
    collectionName: 'Companies',
    attributes: [],
    key: [{ name: 'id' }],
  },
]

export const mockCatalogGetAllCached = mock(() =>
  Promise.resolve({
    dataClasses: fullCatalogDataClasses.slice(0, 1),
  })
)

export const mockCatalogGetAllWithMetadataCached = mock(() =>
  Promise.resolve({
    __UNIQID: 'test-uniq',
    __BASEID: 'test-base',
    dataClasses: fullCatalogDataClasses,
  })
)
export const mockCatalogClearCache = mock(() => {})
export const mockInfoGetInfo = mock(() =>
  Promise.resolve({
    cacheSize: 0,
    usedCache: 0,
    entitySetCount: 0,
    entitySet: [],
    ProgressInfo: [],
    sessionInfo: [],
    privileges: [],
  })
)
export const mockDataclassCount = mock(() => Promise.resolve(42))
export const entityCollectionResponse = {
  __COUNT: 100,
  __ENTITIES: [
    { __KEY: '1', name: 'Alice' },
    { __KEY: '2', name: 'Bob' },
  ],
}
export const mockDataclassFetch = mock(() => Promise.resolve(entityCollectionResponse))
export const mockToEntitySet = mock(() =>
  Promise.resolve({
    id: 'mock-entity-set-id',
    uri: 'http://test/rest/Employee/$entityset/mock-entity-set-id',
    dataClass: 'Employee',
    count: 100,
  })
)
export const mockFetchPage = mock(
  (_skip?: number, _top?: number, _options?: Record<string, unknown>) =>
    Promise.resolve(entityCollectionResponse)
)
export const mockReleaseEntitySet = mock(() => Promise.resolve({ ok: true }))
export const mockDataclassGet = mock(() => Promise.resolve({ __KEY: '1', name: 'Alice', id: 1 }))
export const mockDataclassCreate = mock(() => Promise.resolve({ __KEY: '99', name: 'New', id: 99 }))
export const mockDataclassUpdate = mock(() =>
  Promise.resolve({ __KEY: '1', name: 'Updated', id: 1 })
)
export const mockDataclassDelete = mock(() => Promise.resolve(undefined as undefined))
export const mockQueryDelete = mock(() => Promise.resolve({ ok: true }))
export const mockEntitySetFetch = mock(() => Promise.resolve({ __COUNT: 72 }))
export const mockEntitySetDelete = mock(() => Promise.resolve({ ok: true }))
export const mockCombineToEntitySet = mock(() =>
  Promise.resolve({
    id: 'combined-entity-set-id',
    fetch: mockEntitySetFetch,
  })
)
export const mockEntitySetIntersects = mock(() => Promise.resolve(true))
export const mockDataclassUpdateMany = mock(() =>
  Promise.resolve([
    { __KEY: '1', name: 'Updated' },
    { __KEY: '2', name: 'Updated' },
  ])
)

function createChainable(
  impl: () => Promise<unknown>,
  toEntitySetImpl: () => Promise<unknown> = mockToEntitySet
) {
  const chain = {
    top: () => chain,
    skip: () => chain,
    filter: () => chain,
    orderBy: () => chain,
    select: () => chain,
    expand: () => chain,
    params: () => chain,
    all: () => chain,
    fetch: impl,
    delete: mockQueryDelete,
    toEntitySet: toEntitySetImpl,
  }
  return chain
}

function createDataclassMock() {
  return {
    count: mockDataclassCount,
    all: () => createChainable(mockDataclassFetch, mockToEntitySet),
    entitySet: (_id: string) => ({
      fetchPage: mockFetchPage,
      fetch: mockEntitySetFetch,
      delete: mockEntitySetDelete,
      combineToEntitySet: mockCombineToEntitySet,
      intersects: mockEntitySetIntersects,
    }),
    get: mockDataclassGet,
    create: mockDataclassCreate,
    update: mockDataclassUpdate,
    updateMany: mockDataclassUpdateMany,
    delete: mockDataclassDelete,
  }
}

export class MockRESTClient {
  catalog = {
    getDataClasses: mockCatalogGetDataClasses,
    getAll: mockCatalogGetAll,
    getAllCached: mockCatalogGetAllCached,
    getAllWithMetadataCached: mockCatalogGetAllWithMetadataCached,
    clearCache: mockCatalogClearCache,
  }
  info = { getInfo: mockInfoGetInfo }
  getHttpClient = () => ({ getBaseUrl: () => 'http://localhost:3002' })
  dataclass = () => createDataclassMock()
  releaseEntitySet = mockReleaseEntitySet
}

export const mockCallDataStoreFunction = mock(() => Promise.resolve(undefined))
export const mockCallDataClassFunction = mock(() => Promise.resolve(undefined))
export const mockCallEntityFunction = mock(() => Promise.resolve(undefined))
export const mockCallEntitySelectionFunction = mock(() => Promise.resolve(undefined))
export const mockCallSingletonFunction = mock(() => Promise.resolve(undefined))

mock.module('@4d/rest', () => ({
  RESTClient: MockRESTClient,
  callDataStoreFunction: mockCallDataStoreFunction,
  callDataClassFunction: mockCallDataClassFunction,
  callEntityFunction: mockCallEntityFunction,
  callEntitySelectionFunction: mockCallEntitySelectionFunction,
  callSingletonFunction: mockCallSingletonFunction,
  normalizeFilterExpression,
  normalizeOrderByExpression,
}))
