import { describe, expect, it } from 'bun:test'
import { buildToolkitInventory } from './build-toolkit-inventory'
import {
  emitOpenApiDocument,
  restExportOpenApiFilename,
  serializeOpenApiDocument,
} from './emit-openapi'
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

describe('emitOpenApiDocument', () => {
  it('emits OpenAPI 3.1 with tags, path params, and merged list/entityset GET', () => {
    const config = createDefaultToolkitConfig({
      name: 'Demo API',
      selectedDataClasses: ['Company'],
      variables: { baseUrl: 'https://example.com/', accessKey: 'ak', includeAccessKeyLogin: true },
    })
    const inventory = buildToolkitInventory(catalog, config)
    const doc = emitOpenApiDocument({
      inventory,
      name: config.name,
      variables: config.variables,
    })

    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('Demo API')
    expect(doc.servers?.[0]?.url).toBe('https://example.com')
    expect(doc.components?.securitySchemes?.sessionCookie).toBeTruthy()

    const listPath = doc.paths['/rest/Company']
    expect(listPath?.get?.summary).toContain(toolkitLabels.list)
    expect(listPath?.get?.parameters?.some((p) => p.name === '$filter')).toBe(true)
    expect(listPath?.get?.parameters?.some((p) => p.name === '$method')).toBe(true)
    expect(listPath?.get?.responses).toEqual({
      '200': { description: expect.stringContaining('without error') },
      '401': { description: expect.stringContaining('Permissions') },
      '402': { description: expect.stringContaining('sessions') },
      '404': { description: expect.stringContaining('Not Found') },
      '500': { description: expect.stringContaining('Internal Server Error') },
    })
    expect(listPath?.post?.requestBody).toBeTruthy()

    const entityFn = doc.paths['/rest/Company({key})/fullName']?.post
    expect(entityFn?.summary).toBe(toolkitLabels.classFn('fullName'))
    expect(entityFn?.parameters?.some((p) => p.in === 'path' && p.name === 'key')).toBe(true)

    expect(doc.paths['/api/login']?.post?.requestBody?.content['multipart/form-data']).toBeTruthy()
    expect(serializeOpenApiDocument(doc)).toContain('"openapi": "3.1.0"')
    expect(doc.paths['/rest/$catalog']?.get?.externalDocs?.url).toBe(
      'https://developer.4d.com/docs/REST/catalog'
    )
  })

  it('omits externalDocs when includeDocs is false', () => {
    const config = createDefaultToolkitConfig({
      name: 'Demo API',
      selectedDataClasses: ['Company'],
      includeDocs: false,
    })
    const inventory = buildToolkitInventory(catalog, config)
    const doc = emitOpenApiDocument({
      inventory,
      name: config.name,
      variables: config.variables,
    })
    expect(doc.paths['/rest/$catalog']?.get?.externalDocs).toBeUndefined()
  })

  it('builds a slug filename', () => {
    expect(restExportOpenApiFilename('4D REST API')).toBe('4d-rest-api.openapi.json')
  })
})
