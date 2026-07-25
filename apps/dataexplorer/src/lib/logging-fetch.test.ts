import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { useConsoleStore } from '~/store/console'
import { createLoggingFetch } from './logging-fetch'

async function flushBodyLogging(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('createLoggingFetch', () => {
  beforeEach(() => {
    useConsoleStore.setState({ entries: [], filter: 'all' })
  })

  it('logs requests, responses, bodies, and redacted headers', async () => {
    const inner = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'session=secret',
          },
        })
      )
    ) as unknown as typeof fetch
    const request = createLoggingFetch(inner)

    const response = await request('https://example.test/rest/items', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Item', accessKey: 'secret' }),
    })
    await flushBodyLogging()

    expect(response.status).toBe(200)
    const [entry] = useConsoleStore.getState().entries
    expect(entry.level).toBe('network')
    expect(entry.network?.method).toBe('POST')
    expect(entry.network?.requestHeaders.authorization).toBe('[REDACTED]')
    expect(entry.network?.responseHeaders?.['set-cookie']).toBe('[REDACTED]')
    expect(entry.network?.requestBody).toEqual({ name: 'Item', accessKey: '[REDACTED]' })
    expect(entry.network?.responseBody).toEqual({ ok: true })
    expect(entry.network?.responseSizeBytes).toBe(JSON.stringify({ ok: true }).length)
  })

  it('prefers Content-Length for response size', async () => {
    const inner = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '2048',
          },
        })
      )
    ) as unknown as typeof fetch

    await createLoggingFetch(inner)('https://example.test/rest/items')
    await flushBodyLogging()

    expect(useConsoleStore.getState().entries[0]?.network?.responseSizeBytes).toBe(2048)
  })

  it('logs failed requests and rethrows the original error', async () => {
    const failure = new Error('offline')
    const inner = mock(() => Promise.reject(failure)) as unknown as typeof fetch
    const request = createLoggingFetch(inner)

    await expect(request('https://example.test/rest/items')).rejects.toBe(failure)

    const entries = useConsoleStore.getState().entries
    expect(entries.map((entry) => entry.level)).toEqual(['network', 'error'])
    expect(entries[0]?.network?.error).toMatchObject({ message: 'offline' })
  })

  it('accepts a Request input without consuming it twice', async () => {
    const received: Request[] = []
    const inner = mock((input: RequestInfo | URL) => {
      received.push(input as Request)
      return Promise.resolve(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
    }) as unknown as typeof fetch

    const original = new Request('https://example.test/rest/$catalog/Catalog.sayHello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
    const controller = new AbortController()

    const response = await createLoggingFetch(inner)(original, { signal: controller.signal })
    await flushBodyLogging()

    expect(response.status).toBe(200)
    expect(received).toHaveLength(1)
    expect(received[0]).toBeInstanceOf(Request)
    expect(received[0].url).toBe(original.url)
    expect(received[0].method).toBe('POST')
    expect(received[0].signal).toBe(controller.signal)
    expect(useConsoleStore.getState().entries[0]?.network?.requestBody).toEqual([])
  })

  it('keeps redacted secrets in network details for sanitized HTTP Client replay', async () => {
    const inner = mock(() =>
      Promise.resolve(new Response('ok', { status: 200 }))
    ) as unknown as typeof fetch

    await createLoggingFetch(inner)('https://example.test/rest/secure', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
      },
    })
    await flushBodyLogging()

    const network = useConsoleStore.getState().entries[0]?.network
    expect(network?.requestHeaders.authorization).toBe('[REDACTED]')
    expect(network?.requestHeaders.cookie).toBe('[REDACTED]')
  })
})
