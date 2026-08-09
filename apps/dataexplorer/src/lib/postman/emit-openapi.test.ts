import { describe, expect, it } from 'bun:test'
import { emitOpenApiFromPostmanItems } from './emit-openapi'
import { httpSeedToPostmanItem } from './http-seed-to-item'
import { methodSeedToPostmanItem } from './method-seed-to-item'
import type { PostmanExportItemInput } from './types'

const variables = {
  baseUrl: 'https://example.com/',
  accessKey: 'secret',
  username: 'alice',
  password: 'pw',
}

describe('emitOpenApiFromPostmanItems', () => {
  it('emits OpenAPI 3.1 paths from HTTP and method seeds', () => {
    const items: PostmanExportItemInput[] = [
      {
        id: 'http',
        name: 'List companies',
        tags: ['crm'],
        item: httpSeedToPostmanItem(
          {
            method: 'GET',
            path: '/rest/Company',
            targetMode: 'current',
            params: [{ id: '1', key: '$top', value: '20', enabled: true }],
          },
          { name: 'List companies' }
        ),
      },
      {
        id: 'method',
        name: 'fullName',
        item: methodSeedToPostmanItem(
          {
            scope: 'entity',
            methodName: 'fullName',
            dataClass: 'Company',
            key: '1',
            allowedOnHTTPGET: true,
            useGet: true,
          },
          { name: 'fullName' }
        ),
      },
      {
        id: 'create',
        name: 'Create company',
        item: httpSeedToPostmanItem(
          {
            method: 'POST',
            path: '/rest/Company',
            targetMode: 'current',
            body: { mode: 'raw', rawLanguage: 'json', raw: '{"name":"Acme"}' },
          },
          { name: 'Create company' }
        ),
      },
    ]

    const doc = emitOpenApiFromPostmanItems({
      name: 'HTTP export',
      variables,
      includeAccessKeyLogin: true,
      items,
    })

    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('HTTP export')
    expect(doc.servers?.[0]?.url).toBe('https://example.com')
    expect(doc.paths['/api/login']?.post).toBeTruthy()
    expect(doc.paths['/rest/Company']?.get?.summary).toBe('List companies')
    expect(doc.paths['/rest/Company']?.get?.tags).toEqual(['crm'])
    expect(
      doc.paths['/rest/Company']?.get?.parameters?.some((param) => param.name === '$top')
    ).toBe(true)
    expect(doc.paths['/rest/Company']?.post?.requestBody?.content['application/json']).toBeTruthy()
    expect(doc.paths['/rest/Company(1)/fullName']?.get).toBeTruthy()
  })

  it('keeps custom origins as per-path servers', () => {
    const items: PostmanExportItemInput[] = [
      {
        id: 'custom',
        name: 'External',
        item: httpSeedToPostmanItem(
          {
            method: 'DELETE',
            path: '/v1/hooks',
            targetMode: 'custom',
            customOrigin: 'https://hooks.example.test',
          },
          { name: 'External' }
        ),
      },
    ]
    const doc = emitOpenApiFromPostmanItems({
      name: 'Custom',
      variables,
      includeAccessKeyLogin: false,
      items,
    })
    expect(doc.paths['/v1/hooks']?.delete?.summary).toBe('External')
    expect(doc.paths['/v1/hooks']?.servers?.[0]?.url).toBe('https://hooks.example.test')
  })
})
