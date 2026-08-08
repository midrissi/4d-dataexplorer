import { describe, expect, it } from 'bun:test'
import type { ConsoleEntry, NetworkDetails } from '~/store/console'
import {
  failedNetworkBackground,
  formatByteSize,
  formatConsoleTimestamp,
  networkMethodToneClass,
  splitNetworkUrl,
} from './console-format'

function networkEntry(network?: NetworkDetails): ConsoleEntry {
  return {
    id: '1',
    timestamp: 0,
    level: network ? 'network' : 'log',
    message: 'GET /',
    network,
  }
}

function networkDetails(overrides: Partial<NetworkDetails> = {}): NetworkDetails {
  return {
    method: 'GET',
    url: 'https://example.com/rest',
    durationMs: 12,
    requestHeaders: {},
    ...overrides,
  }
}

describe('formatConsoleTimestamp', () => {
  it('formats UTC time as HH:mm:ss.sss', () => {
    expect(formatConsoleTimestamp(Date.UTC(2026, 0, 1, 14, 30, 5, 123))).toBe('14:30:05.123')
  })
})

describe('formatByteSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatByteSize(500)).toBe('500 B')
  })

  it('formats kibibytes with one decimal when under 10 KB', () => {
    expect(formatByteSize(1536)).toBe('1.5 KB')
  })

  it('formats mebibytes with two decimals when under 10 MB', () => {
    expect(formatByteSize(2e6)).toBe('1.91 MB')
  })
})

describe('splitNetworkUrl', () => {
  it('splits origin from path, query, and hash', () => {
    expect(splitNetworkUrl('https://api.example.com/rest/Person?$top=10#row')).toEqual({
      origin: 'https://api.example.com',
      pathWithQuery: '/rest/Person?$top=10#row',
    })
  })

  it('uses / when the URL has no path beyond origin', () => {
    expect(splitNetworkUrl('https://example.com')).toEqual({
      origin: 'https://example.com',
      pathWithQuery: '/',
    })
  })

  it('treats invalid URLs as a path with empty origin', () => {
    expect(splitNetworkUrl('/rest/Person?$filter=1')).toEqual({
      origin: '',
      pathWithQuery: '/rest/Person?$filter=1',
    })
  })
})

describe('networkMethodToneClass', () => {
  it('uses distinct color tokens per method', () => {
    const getClass = networkMethodToneClass('GET')
    const postClass = networkMethodToneClass('post')
    const deleteClass = networkMethodToneClass('DELETE')
    const unknownClass = networkMethodToneClass('TRACE')

    expect(getClass).toContain('emerald')
    expect(postClass).toContain('sky')
    expect(deleteClass).toContain('rose')
    expect(unknownClass).toContain('text-foreground')
    expect(new Set([getClass, postClass, deleteClass, unknownClass]).size).toBe(4)
  })
})

describe('failedNetworkBackground', () => {
  it('returns false when the entry has no network details', () => {
    expect(failedNetworkBackground(networkEntry())).toBe(false)
  })

  it('returns false for successful responses', () => {
    expect(failedNetworkBackground(networkEntry(networkDetails({ status: 200 })))).toBe(false)
  })

  it('returns the error background for 4xx/5xx status', () => {
    expect(failedNetworkBackground(networkEntry(networkDetails({ status: 404 })))).toBe(
      'bg-destructive/[0.03] hover:bg-destructive/10'
    )
  })

  it('returns the error background when network.error is set', () => {
    expect(failedNetworkBackground(networkEntry(networkDetails({ error: 'timeout' })))).toBe(
      'bg-destructive/[0.03] hover:bg-destructive/10'
    )
  })
})
