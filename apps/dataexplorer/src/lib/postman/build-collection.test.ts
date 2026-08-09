import { describe, expect, it } from 'bun:test'
import {
  buildPostmanCollection,
  postmanCollectionFilename,
  serializePostmanCollection,
} from './build-collection'
import { httpSeedToPostmanItem } from './http-seed-to-item'
import { methodSeedToPostmanItem } from './method-seed-to-item'
import type { PostmanExportItemInput } from './types'
import { POSTMAN_COLLECTION_SCHEMA } from './types'

function httpItem(id: string, name: string, tags?: string[]): PostmanExportItemInput {
  return {
    id,
    name,
    tags,
    item: httpSeedToPostmanItem(
      {
        method: 'GET',
        path: `/rest/${name}`,
        targetMode: 'current',
      },
      { name }
    ),
  }
}

describe('buildPostmanCollection', () => {
  it('includes only selected items with collection variables', () => {
    const collection = buildPostmanCollection({
      name: 'Demo',
      description: 'Exported favourites',
      variables: {
        baseUrl: 'https://example.com/',
        accessKey: 'secret',
        username: 'alice',
        password: 'pw',
      },
      includeAccessKeyLogin: true,
      folderMode: 'flat',
      items: [httpItem('a', 'Alpha'), httpItem('b', 'Beta')],
    })

    expect(collection.info.name).toBe('Demo')
    expect(collection.info.description).toBe('Exported favourites')
    expect(collection.info.schema).toBe(POSTMAN_COLLECTION_SCHEMA)
    expect(collection.variable).toEqual([
      { key: 'baseUrl', value: 'https://example.com', type: 'string' },
      { key: 'accessKey', value: 'secret', type: 'secret' },
      { key: 'username', value: 'alice', type: 'string' },
      { key: 'password', value: 'pw', type: 'secret' },
    ])
    expect(collection.event?.[0]?.listen).toBe('prerequest')
    expect(collection.event?.[0]?.script.exec.join('\n')).toContain('/api/login')
    expect(collection.item).toHaveLength(3)
    expect(collection.item.map((item) => item.name)).toEqual([
      'Login (access key)',
      'Alpha',
      'Beta',
    ])
    const login = collection.item[0]
    expect(login && 'request' in login ? login.request.method : undefined).toBe('POST')
    expect(login && 'request' in login ? login.request.url.raw : undefined).toContain('/api/login')
    expect(login && 'request' in login ? login.request.body : undefined).toEqual({
      mode: 'formdata',
      formdata: [{ key: 'accessKey', value: '{{accessKey}}', type: 'text' }],
    })
  })

  it('omits login request and pre-request when disabled', () => {
    const collection = buildPostmanCollection({
      name: 'Demo',
      variables: {
        baseUrl: 'https://example.com',
        accessKey: '',
        username: '',
        password: '',
      },
      includeAccessKeyLogin: false,
      folderMode: 'flat',
      items: [httpItem('a', 'Alpha')],
    })
    expect(collection.event).toBeUndefined()
    expect(collection.item.map((item) => item.name)).toEqual(['Alpha'])
  })

  it('skips login item when enabled but accessKey is empty', () => {
    const collection = buildPostmanCollection({
      name: 'Demo',
      variables: {
        baseUrl: 'https://example.com',
        accessKey: '   ',
        username: '',
        password: '',
      },
      includeAccessKeyLogin: true,
      folderMode: 'flat',
      items: [httpItem('a', 'Alpha')],
    })
    expect(collection.event).toBeUndefined()
    expect(collection.item.map((item) => item.name)).toEqual(['Alpha'])
  })

  it('groups by first tag and puts untagged in a folder when tags exist', () => {
    const collection = buildPostmanCollection({
      name: 'Tagged',
      variables: {
        baseUrl: 'https://example.com',
        accessKey: '',
        username: '',
        password: '',
      },
      includeAccessKeyLogin: false,
      folderMode: 'byTags',
      untaggedFolderName: 'Untagged',
      items: [
        httpItem('1', 'One', ['smoke']),
        httpItem('2', 'Two', ['api', 'smoke']),
        httpItem('3', 'Three'),
      ],
    })

    expect(collection.item).toHaveLength(3)
    const names = collection.item.map((item) => item.name)
    expect(names).toEqual(['api', 'smoke', 'Untagged'])

    const apiFolder = collection.item.find((item) => item.name === 'api')
    const smokeFolder = collection.item.find((item) => item.name === 'smoke')
    const untagged = collection.item.find((item) => item.name === 'Untagged')
    expect(apiFolder && 'item' in apiFolder ? apiFolder.item.map((i) => i.name) : []).toEqual([
      'Two',
    ])
    expect(smokeFolder && 'item' in smokeFolder ? smokeFolder.item.map((i) => i.name) : []).toEqual(
      ['One']
    )
    expect(untagged && 'item' in untagged ? untagged.item.map((i) => i.name) : []).toEqual([
      'Three',
    ])
  })

  it('keeps untagged items flat when no tags are present', () => {
    const collection = buildPostmanCollection({
      name: 'Flat',
      variables: {
        baseUrl: 'https://example.com',
        accessKey: '',
        username: '',
        password: '',
      },
      includeAccessKeyLogin: false,
      folderMode: 'byTags',
      items: [httpItem('1', 'One'), httpItem('2', 'Two')],
    })
    expect(collection.item.map((item) => item.name)).toEqual(['One', 'Two'])
  })
})

describe('httpSeedToPostmanItem', () => {
  it('maps current-origin GET with query params to {{baseUrl}}', () => {
    const item = httpSeedToPostmanItem(
      {
        method: 'GET',
        targetMode: 'current',
        path: '/rest/Car',
        params: [
          { id: '1', key: '$top', value: '5', enabled: true },
          { id: '2', key: 'skip', value: '1', enabled: false },
        ],
        headers: [{ id: 'h1', key: 'X-Test', value: '1', enabled: true }],
      },
      { name: 'Cars' }
    )

    expect(item.request.method).toBe('GET')
    expect(item.request.url.raw).toBe('{{baseUrl}}/rest/Car?%24top=5')
    expect(item.request.url.host).toEqual(['{{baseUrl}}'])
    expect(item.request.url.path).toEqual(['rest', 'Car'])
    expect(item.request.url.query).toEqual([{ key: '$top', value: '5' }])
    expect(item.request.header).toEqual([{ key: 'X-Test', value: '1' }])
  })

  it('maps custom origin and raw JSON body', () => {
    const item = httpSeedToPostmanItem(
      {
        method: 'POST',
        targetMode: 'custom',
        customOrigin: 'https://api.example.com',
        path: '/v1/items',
        body: {
          mode: 'raw',
          raw: '{"ok":true}',
          rawLanguage: 'json',
          rawContentType: 'application/json',
          formData: [],
          urlencoded: [],
        },
      },
      { name: 'Create' }
    )

    expect(item.request.url.raw).toBe('https://api.example.com/v1/items')
    expect(item.request.body).toEqual({
      mode: 'raw',
      raw: '{"ok":true}',
      options: { raw: { language: 'json' } },
    })
    expect(item.request.header.some((h) => h.key === 'Content-Type')).toBe(true)
  })
})

describe('methodSeedToPostmanItem', () => {
  it('maps catalog POST with params body', () => {
    const item = methodSeedToPostmanItem(
      {
        scope: 'catalog',
        methodName: 'hello',
        arguments: [{ id: '1', kind: 'string', value: 'world' }],
      },
      { name: 'hello' }
    )

    expect(item.request.method).toBe('POST')
    expect(item.request.url.raw).toContain('{{baseUrl}}/rest/$catalog/hello')
    expect(
      item.request.url.query?.some((q) => q.key === '$method' && q.value === 'entityset')
    ).toBe(true)
    expect(item.request.body?.mode).toBe('raw')
    if (item.request.body?.mode === 'raw') {
      expect(JSON.parse(item.request.body.raw)).toEqual(['world'])
    }
  })

  it('maps entity GET with $params', () => {
    const item = methodSeedToPostmanItem(
      {
        scope: 'entity',
        methodName: 'fullName',
        dataClass: 'Person',
        key: 42,
        allowedOnHTTPGET: true,
        useGet: true,
        arguments: [{ id: '1', kind: 'boolean', value: true }],
      },
      { name: 'fullName' }
    )

    expect(item.request.method).toBe('GET')
    expect(item.request.url.path).toEqual(['rest', 'Person(42)', 'fullName'])
    const params = item.request.url.query?.find((q) => q.key === '$params')
    expect(params?.value).toBe('[true]')
    expect(item.request.body).toBeUndefined()
  })

  it('maps entitySelection path with entity set and wrapper POST body', () => {
    const item = methodSeedToPostmanItem(
      {
        scope: 'entitySelection',
        methodName: 'bulk',
        dataClass: 'Car',
        entitySetId: 'set-1',
        filter: 'ignored',
        wrapperEnabled: true,
        wrapperText: '{"mode":"fast"}',
        useGet: true,
        allowedOnHTTPGET: true,
        arguments: [{ id: '1', kind: 'number', value: '3' }],
      },
      { name: 'bulk' }
    )

    expect(item.request.method).toBe('POST')
    expect(item.request.url.path).toEqual(['rest', 'Car', 'bulk', '$entityset', 'set-1'])
    expect(item.request.url.query?.some((q) => q.key === '$filter')).toBe(false)
    if (item.request.body?.mode === 'raw') {
      expect(JSON.parse(item.request.body.raw)).toEqual({ params: [3], mode: 'fast' })
    }
  })

  it('maps singleton and dataclass scopes', () => {
    const singleton = methodSeedToPostmanItem(
      {
        scope: 'singleton',
        singletonName: 'Settings',
        methodName: 'get',
      },
      { name: 'settings' }
    )
    expect(singleton.request.url.path).toEqual(['rest', '$singleton', 'Settings', 'get'])

    const dataclass = methodSeedToPostmanItem(
      {
        scope: 'dataclass',
        dataClass: 'Invoice',
        methodName: 'total',
      },
      { name: 'total' }
    )
    expect(dataclass.request.url.path).toEqual(['rest', 'Invoice', 'total'])
  })
})

describe('serialize helpers', () => {
  it('builds a postman filename slug', () => {
    expect(postmanCollectionFilename('4D Data Explorer — HTTP')).toBe(
      '4d-data-explorer-http.postman_collection.json'
    )
  })

  it('serializes pretty JSON with trailing newline', () => {
    const json = serializePostmanCollection(
      buildPostmanCollection({
        name: 'X',
        variables: { baseUrl: '', accessKey: '', username: '', password: '' },
        includeAccessKeyLogin: false,
        folderMode: 'flat',
        items: [],
      })
    )
    expect(json.endsWith('\n')).toBe(true)
    expect(JSON.parse(json).info.name).toBe('X')
  })
})
