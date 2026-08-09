import { describe, expect, it } from 'bun:test'
import { POSTMAN_COLLECTION_SCHEMA, type PostmanDescription, type PostmanItem } from '~/lib/postman'
import { buildToolkitInventory } from './build-toolkit-inventory'
import { emitPostmanCollection, restExportPostmanFilename } from './emit-postman'
import { createDefaultToolkitConfig } from './toolkit-defaults'
import { toolkitLabels } from './toolkit-emoji'
import type { ToolkitCatalogInput } from './toolkit-types'

const catalog: ToolkitCatalogInput = {
  dataClasses: [
    {
      name: 'Company',
      methods: [
        { name: 'allActive', applyTo: 'dataClass', exposed: true },
        { name: 'fullName', applyTo: 'entity', exposed: true },
      ],
    },
  ],
  methods: [{ name: 'ping', exposed: true }],
}

function descriptionContent(value: PostmanDescription | undefined): string | undefined {
  if (!value) return undefined
  return typeof value === 'string' ? value : value.content
}

function findItem(items: PostmanItem[], name: string): PostmanItem | undefined {
  for (const item of items) {
    if (item.name === name) return item
    if ('item' in item) {
      const nested = findItem(item.item, name)
      if (nested) return nested
    }
  }
  return undefined
}

describe('emitPostmanCollection', () => {
  it('emits Collection v2.1 folders with emoji names and {{baseUrl}}', () => {
    const config = createDefaultToolkitConfig({
      name: 'Demo API',
      description: 'From catalog',
      selectedDataClasses: ['Company'],
      variables: {
        baseUrl: 'https://example.com/',
        accessKey: 'secret',
        includeAccessKeyLogin: true,
      },
    })
    const inventory = buildToolkitInventory(catalog, config)
    const collection = emitPostmanCollection({
      inventory,
      name: config.name,
      description: config.description,
      variables: config.variables,
    })

    expect(collection.info.schema).toBe(POSTMAN_COLLECTION_SCHEMA)
    expect(collection.info.name).toBe('Demo API')
    expect(collection.variable?.find((v) => v.key === 'baseUrl')?.value).toBe('https://example.com')
    expect(collection.event?.[0]?.listen).toBe('prerequest')

    const login = findItem(collection.item, toolkitLabels.login)
    expect(login && 'request' in login ? login.request.method : undefined).toBe('POST')
    expect(login && 'request' in login ? login.request.url.raw : undefined).toBe(
      '{{baseUrl}}/api/login'
    )

    const getByKey = findItem(collection.item, toolkitLabels.getByKey)
    expect(getByKey && 'request' in getByKey ? getByKey.request.url.raw : undefined).toContain(
      '/rest/Company({{key}})'
    )

    const entityFn = findItem(collection.item, toolkitLabels.classFn('fullName'))
    expect(entityFn && 'request' in entityFn ? entityFn.request.url.raw : undefined).toContain(
      '/rest/Company({{key}})/fullName'
    )

    const catalogItem = findItem(collection.item, toolkitLabels.catalog)
    expect(descriptionContent(catalogItem?.description)).toContain(
      'https://developer.4d.com/docs/REST/catalog'
    )
    expect(
      descriptionContent(
        catalogItem && 'request' in catalogItem ? catalogItem.request.description : undefined
      )
    ).toContain('$catalog')

    const list = findItem(collection.item, toolkitLabels.list)
    const listDocs = list && 'request' in list ? list.request.description : undefined
    expect(listDocs && typeof listDocs === 'object' ? listDocs.type : undefined).toBe(
      'text/markdown'
    )
    expect(descriptionContent(listDocs)).toContain('Available syntaxes')
    expect(descriptionContent(listDocs)).toContain('__entityModel')
    expect(descriptionContent(listDocs)).toContain('https://developer.4d.com/docs/REST/dataClass')

    const listQuery = list && 'request' in list ? list.request.url.query : undefined
    expect(listQuery?.find((param) => param.key === '$filter')?.disabled).toBe(true)
    expect(listQuery?.find((param) => param.key === '$orderby')?.disabled).toBe(true)
    expect(listQuery?.find((param) => param.key === '$attributes')?.disabled).toBe(true)
    expect(listQuery?.find((param) => param.key === '$top')?.disabled).toBeUndefined()
    expect(listQuery?.find((param) => param.key === '$skip')?.value).toBe('0')
    expect(list && 'request' in list ? list.request.url.raw : undefined).toContain('%24top=20')
    expect(list && 'request' in list ? list.request.url.raw : undefined).not.toContain('filter')
  })

  it('omits 4D docs links when includeDocs is false', () => {
    const config = createDefaultToolkitConfig({
      name: 'Demo API',
      selectedDataClasses: ['Company'],
      includeDocs: false,
    })
    const inventory = buildToolkitInventory(catalog, config)
    const collection = emitPostmanCollection({
      inventory,
      name: config.name,
      variables: config.variables,
    })
    const catalogItem = findItem(collection.item, toolkitLabels.catalog)
    expect(
      catalogItem && 'description' in catalogItem ? catalogItem.description : undefined
    ).toBeUndefined()
  })

  it('builds a slug filename', () => {
    expect(restExportPostmanFilename('4D REST API')).toBe('4d-rest-api.postman_collection.json')
  })
})
