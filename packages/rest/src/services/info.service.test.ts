import { describe, expect, it } from 'bun:test'
import { makeHttp } from '../mock-http.test-helper'
import { InfoService } from './info.service'

const INFO = {
  cacheSize: 1000,
  usedCache: 250,
  entitySet: [{ id: 'A' }, { id: 'B' }],
  entitySetCount: 2,
  sessionInfo: [{ user: 'admin' }],
  privileges: [{ privilege: 'read' }, { privilege: 'write' }],
}

describe('InfoService', () => {
  it('getInfo() reads /$info', async () => {
    const { http, calls } = makeHttp(INFO)
    await new InfoService(http).getInfo()
    expect(calls[0].path).toBe('/$info')
  })

  it('getCacheStats() maps cache fields', async () => {
    const { http } = makeHttp(INFO)
    expect(await new InfoService(http).getCacheStats()).toEqual({ size: 1000, used: 250 })
  })

  it('getEntitySets() returns the cached sets', async () => {
    const { http } = makeHttp(INFO)
    expect(await new InfoService(http).getEntitySets()).toHaveLength(2)
  })

  it('getEntitySetCount() returns the count', async () => {
    const { http } = makeHttp(INFO)
    expect(await new InfoService(http).getEntitySetCount()).toBe(2)
  })

  it('getSessions() returns session info', async () => {
    const { http } = makeHttp(INFO)
    expect(await new InfoService(http).getSessions()).toHaveLength(1)
  })

  it('getPrivileges() maps privilege names', async () => {
    const { http } = makeHttp(INFO)
    expect(await new InfoService(http).getPrivileges()).toEqual(['read', 'write'])
  })

  it('getPrivileges() returns an empty array when missing', async () => {
    const { http } = makeHttp({ ...INFO, privileges: undefined })
    expect(await new InfoService(http).getPrivileges()).toEqual([])
  })
})
