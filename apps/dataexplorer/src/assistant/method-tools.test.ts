import { afterAll, describe, expect, test } from 'bun:test'
import { buildMethodToolName, createAssistantToolRegistry } from '@4djs/assistant/tools'
import { fullCatalogDataClasses, mockCatalogGetAllWithMetadataCached } from '~/test-rest-mock'
import {
  getDynamicMethodTools,
  getRegisteredMethodToolDefinitions,
  refreshAssistantMethodTools,
  syncMethodTools,
} from './method-tools'

describe('assistant method tool naming', () => {
  test('buildMethodToolName matches Data Explorer conventions', () => {
    expect(
      buildMethodToolName({
        scope: 'dataclass',
        dataClass: 'User',
        methodName: 'searchByDescription',
      })
    ).toBe('@dataclass/User/searchByDescription')

    expect(
      buildMethodToolName({
        scope: 'entity',
        dataClass: 'User',
        methodName: 'greet',
      })
    ).toBe('@dataclass/User/Entity/greet')

    expect(
      buildMethodToolName({
        scope: 'catalog',
        methodName: 'authentify',
      })
    ).toBe('@datastore/methods/authentify')
  })
})

describe('syncMethodTools', () => {
  const catalogWithMethods = {
    __UNIQID: 'methods-uniq',
    __BASEID: 'methods-base',
    dataClasses: [
      {
        name: 'User',
        collectionName: 'Users',
        key: [{ name: 'id' }],
        attributes: [
          {
            name: 'id',
            type: 'long',
            kind: 'storage',
            indexed: true,
            unique: true,
            readOnly: true,
          },
        ],
        methods: [
          { name: 'greet', applyTo: 'entity', exposed: true },
          { name: 'searchByName', applyTo: 'dataClass', exposed: true },
        ],
      },
    ],
    singletons: [{ name: 'App', exposed: true, methods: [{ name: 'version', exposed: true }] }],
    methods: [{ name: 'login', exposed: true }],
  }

  afterAll(() => {
    mockCatalogGetAllWithMetadataCached.mockImplementation(() =>
      Promise.resolve({
        __UNIQID: 'test-uniq',
        __BASEID: 'test-base',
        dataClasses: fullCatalogDataClasses,
      })
    )
  })

  test('registers dynamic method tools from the catalog', async () => {
    mockCatalogGetAllWithMetadataCached.mockImplementation(() =>
      Promise.resolve(catalogWithMethods)
    )
    const registry = createAssistantToolRegistry()
    const count = await refreshAssistantMethodTools(registry)

    expect(count).toBeGreaterThan(0)
    const definitions = getRegisteredMethodToolDefinitions()
    expect(definitions.length).toBe(count)

    const dynamic = getDynamicMethodTools()
    expect(dynamic.length).toBeGreaterThan(0)
    // sorted by name
    const names = dynamic.map((tool) => tool.name)
    expect([...names].sort()).toEqual(names)

    mockCatalogGetAllWithMetadataCached.mockImplementation(() =>
      Promise.resolve({ __UNIQID: 'test-uniq', __BASEID: 'test-base', dataClasses: [] })
    )
  })

  test('syncMethodTools handles empty catalog', async () => {
    mockCatalogGetAllWithMetadataCached.mockImplementation(() =>
      Promise.resolve({ __UNIQID: 'empty', __BASEID: 'empty-base', dataClasses: [] })
    )
    const registry = createAssistantToolRegistry()
    const count = await syncMethodTools(registry)
    expect(count).toBe(0)
    expect(getDynamicMethodTools()).toEqual([])
  })
})
