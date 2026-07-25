import { describe, expect, it } from 'bun:test'
import { makeHttp, type RecordedCall } from '../mock-http.test-helper'
import { CatalogService } from './catalog.service'

describe('CatalogService', () => {
  it('getDataClasses() reads /$catalog', async () => {
    const { http, calls } = makeHttp({ dataClasses: [{ name: 'Employee' }] })
    const res = await new CatalogService(http).getDataClasses()
    expect(res.dataClasses).toHaveLength(1)
    expect(calls[0].path).toBe('/$catalog')
  })

  it('getAll() requests /$catalog/$all without metadata by default', async () => {
    const { http, calls } = makeHttp({ dataClasses: [] })
    await new CatalogService(http).getAll()
    expect(calls[0].path).toBe('/$catalog/$all')
    expect(calls[0].params.$metadata).toBeUndefined()
  })

  it('getAll({ metadata: full }) sends $metadata=full', async () => {
    const { http, calls } = makeHttp({ dataClasses: [] })
    await new CatalogService(http).getAll({ metadata: 'full' })
    expect(calls[0].params.$metadata).toBe('full')
  })

  it('getAllCached() fetches once and caches', async () => {
    const { http, calls } = makeHttp({ dataClasses: [{ name: 'A' }] })
    const service = new CatalogService(http)
    await service.getAllCached()
    await service.getAllCached()
    expect(calls).toHaveLength(1)
  })

  it('clearCache() forces a refetch', async () => {
    const { http, calls } = makeHttp({ dataClasses: [{ name: 'A' }] })
    const service = new CatalogService(http)
    await service.getAllCached()
    service.clearCache()
    await service.getAllCached()
    expect(calls).toHaveLength(2)
  })

  it('getDataClass() reads /$catalog/{name}', async () => {
    const { http, calls } = makeHttp({ name: 'Employee', attributes: [] })
    await new CatalogService(http).getDataClass('Employee')
    expect(calls[0].path).toBe('/$catalog/Employee')
  })

  it('getDataClass() can request full metadata', async () => {
    const { http, calls } = makeHttp({ name: 'Employee', attributes: [] })
    await new CatalogService(http).getDataClass('Employee', { metadata: 'full' })
    expect(calls[0].params.$metadata).toBe('full')
  })

  it('getSingletons() returns singletons or an empty array', async () => {
    const withSingletons = makeHttp({ dataClasses: [], singletons: [{ name: 'S' }] })
    expect(await new CatalogService(withSingletons.http).getSingletons()).toHaveLength(1)

    const noSingletons = makeHttp({ dataClasses: [] })
    expect(await new CatalogService(noSingletons.http).getSingletons()).toEqual([])
  })

  it('getDataClassNames() maps names', async () => {
    const { http } = makeHttp({ dataClasses: [{ name: 'A' }, { name: 'B' }] })
    expect(await new CatalogService(http).getDataClassNames()).toEqual(['A', 'B'])
  })

  it('hasDataClass() checks for membership', async () => {
    const present = makeHttp({ dataClasses: [{ name: 'A' }] })
    expect(await new CatalogService(present.http).hasDataClass('A')).toBe(true)
    const absent = makeHttp({ dataClasses: [{ name: 'A' }] })
    expect(await new CatalogService(absent.http).hasDataClass('Z')).toBe(false)
  })

  it('getAttributeNames() maps attribute names', async () => {
    const { http } = makeHttp({
      name: 'Employee',
      attributes: [{ name: 'firstName' }, { name: 'lastName' }],
    })
    expect(await new CatalogService(http).getAttributeNames('Employee')).toEqual([
      'firstName',
      'lastName',
    ])
  })

  it('getPrimaryKey() returns the first key name', async () => {
    const withKey = makeHttp({ name: 'Employee', attributes: [], key: [{ name: 'ID' }] })
    expect(await new CatalogService(withKey.http).getPrimaryKey('Employee')).toBe('ID')

    const noKey = makeHttp({ name: 'Employee', attributes: [] })
    expect(await new CatalogService(noKey.http).getPrimaryKey('Employee')).toBeUndefined()
  })

  it('getAllWithMetadataCached() expands dataclasses and caches', async () => {
    const { http, calls } = makeHttp((call: RecordedCall) => {
      if (call.path === '/$catalog/$all') {
        return { __UNIQID: 'u', dataClasses: [{ name: 'Employee' }] }
      }
      return { name: 'Employee', attributes: [{ name: 'firstName' }], key: [{ name: 'ID' }] }
    })
    const service = new CatalogService(http)
    const result = await service.getAllWithMetadataCached()
    expect(result.dataClasses[0].attributes).toHaveLength(1)
    expect(result.dataClasses[0].name).toBe('Employee')
    const callCount = calls.length
    await service.getAllWithMetadataCached()
    expect(calls).toHaveLength(callCount)
  })

  it('getAllWithMetadataCached() uses inline attributes without per-dataclass requests', async () => {
    const { http, calls } = makeHttp((call: RecordedCall) => {
      if (call.path === '/$catalog/$all') {
        return {
          __UNIQID: 'u',
          dataClasses: [
            { name: 'Employee', attributes: [{ name: 'firstName' }], key: [{ name: 'ID' }] },
            { name: 'Company', attributes: [{ name: 'label' }] },
          ],
        }
      }
      throw new Error(`unexpected per-dataclass request: ${call.path}`)
    })
    const service = new CatalogService(http)
    const result = await service.getAllWithMetadataCached()
    expect(result.dataClasses).toHaveLength(2)
    expect(result.dataClasses[0].attributes).toHaveLength(1)
    expect(result.dataClasses[1].name).toBe('Company')
    // Only the single $catalog/$all request, no per-dataclass follow-ups
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/$catalog/$all')
  })

  it('getAllWithMetadataCached() falls back to per-dataclass fetch for short-form entries', async () => {
    const { http, calls } = makeHttp((call: RecordedCall) => {
      if (call.path === '/$catalog/$all') {
        return {
          dataClasses: [
            { name: 'Employee', attributes: [{ name: 'firstName' }] },
            { name: 'Company', uri: '/rest/$catalog/Company', dataURI: '/rest/Company' },
          ],
        }
      }
      return { name: 'Company', attributes: [{ name: 'label' }] }
    })
    const service = new CatalogService(http)
    const result = await service.getAllWithMetadataCached()
    expect(result.dataClasses[1].attributes).toHaveLength(1)
    // One request for $all + one per-dataclass request for the short-form Company
    expect(calls).toHaveLength(2)
    expect(calls[1].path).toBe('/$catalog/Company')
  })

  it('getAllWithMetadataCached() extracts the matching dataclass from a full catalog', async () => {
    const { http } = makeHttp((call: RecordedCall) => {
      if (call.path === '/$catalog/$all') {
        return { dataClasses: [{ name: 'Employee' }] }
      }
      // Server returns the whole catalog instead of a single dataclass
      return {
        dataClasses: [
          { name: 'Other', attributes: [] },
          { className: 'Employee', attributes: [{ name: 'firstName' }] },
        ],
      }
    })
    const result = await new CatalogService(http).getAllWithMetadataCached()
    expect(result.dataClasses[0].name).toBe('Employee')
    expect(result.dataClasses[0].attributes).toHaveLength(1)
  })

  it('getAllWithMetadataCached() defaults attributes and key when missing', async () => {
    const { http } = makeHttp((call: RecordedCall) => {
      if (call.path === '/$catalog/$all') {
        return { dataClasses: [{ name: 'Employee' }] }
      }
      return { name: 'Employee' }
    })
    const result = await new CatalogService(http).getAllWithMetadataCached()
    expect(result.dataClasses[0].attributes).toEqual([])
  })

  it('getAllWithMetadataCached() defaults to empty dataClasses when missing', async () => {
    const { http } = makeHttp(() => ({ __UNIQID: 'u', methods: [] }))
    const result = await new CatalogService(http).getAllWithMetadataCached()
    expect(result.dataClasses).toEqual([])
  })
})
