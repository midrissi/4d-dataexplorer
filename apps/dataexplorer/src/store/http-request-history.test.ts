import { beforeEach, describe, expect, it } from 'bun:test'
import {
  DEFAULT_HTTP_REQUEST_HISTORY_LIMIT,
  useHttpRequestHistoryStore,
} from './http-request-history'

const seed = {
  method: 'GET' as const,
  path: '/rest/Employee(1)/photo',
  targetMode: 'current' as const,
}

describe('http request history', () => {
  beforeEach(() =>
    useHttpRequestHistoryStore.setState({
      requests: [],
      maxCount: DEFAULT_HTTP_REQUEST_HISTORY_LIMIT,
    })
  )

  it('stores requests and deduplicates by seed', () => {
    const store = useHttpRequestHistoryStore.getState()
    store.addRequest(seed, { status: 200, statusText: 'OK', durationMs: 12 })
    store.addRequest(seed, { status: 404, statusText: 'Not Found', durationMs: 8 })
    const requests = useHttpRequestHistoryStore.getState().requests
    expect(requests).toHaveLength(1)
    expect(requests[0]?.status).toBe(404)
  })

  it('trims history when max count is reduced', () => {
    const store = useHttpRequestHistoryStore.getState()
    for (let i = 0; i < 5; i++) {
      store.addRequest({ ...seed, path: `/rest/Item(${i})` })
    }
    expect(useHttpRequestHistoryStore.getState().requests).toHaveLength(5)
    store.setMaxCount(10)
    expect(useHttpRequestHistoryStore.getState().maxCount).toBe(10)
    store.setMaxCount(10)
    store.setMaxCount(20) // still keeps all 5
    expect(useHttpRequestHistoryStore.getState().requests).toHaveLength(5)
    // Add more then shrink
    for (let i = 5; i < 15; i++) {
      store.addRequest({ ...seed, path: `/rest/Item(${i})` })
    }
    expect(useHttpRequestHistoryStore.getState().requests.length).toBeLessThanOrEqual(20)
    store.setMaxCount(10)
    expect(useHttpRequestHistoryStore.getState().maxCount).toBe(10)
    expect(useHttpRequestHistoryStore.getState().requests).toHaveLength(10)
  })

  it('removes and clears requests', () => {
    useHttpRequestHistoryStore.getState().addRequest(seed)
    const id = useHttpRequestHistoryStore.getState().requests[0]?.id
    expect(id).toBeDefined()
    if (id) useHttpRequestHistoryStore.getState().removeRequest(id)
    expect(useHttpRequestHistoryStore.getState().requests).toEqual([])

    useHttpRequestHistoryStore.getState().addRequest(seed)
    useHttpRequestHistoryStore.getState().clearRequests()
    expect(useHttpRequestHistoryStore.getState().requests).toEqual([])
  })
})
