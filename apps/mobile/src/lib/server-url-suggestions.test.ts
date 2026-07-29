import { describe, expect, it } from 'bun:test'
import {
  applyServerUrlPort,
  applyServerUrlScheme,
  buildServerUrlSuggestions,
} from './server-url-suggestions'

describe('applyServerUrlScheme', () => {
  it('starts a localhost preset when empty', () => {
    expect(applyServerUrlScheme('', 'https')).toBe('https://localhost:7080')
  })

  it('swaps scheme on an existing URL', () => {
    expect(applyServerUrlScheme('http://192.168.1.10:7080', 'https')).toBe(
      'https://192.168.1.10:7080'
    )
  })

  it('prefixes a bare host', () => {
    expect(applyServerUrlScheme('192.168.1.10:7080', 'http')).toBe('http://192.168.1.10:7080')
  })
})

describe('applyServerUrlPort', () => {
  it('builds localhost when empty', () => {
    expect(applyServerUrlPort('', '7443')).toBe('http://localhost:7443')
  })

  it('replaces an existing port', () => {
    expect(applyServerUrlPort('http://192.168.1.10:8080', '7080')).toBe('http://192.168.1.10:7080')
  })

  it('appends a port to a host', () => {
    expect(applyServerUrlPort('http://192.168.1.10', '7080')).toBe('http://192.168.1.10:7080')
  })
})

describe('buildServerUrlSuggestions', () => {
  it('includes presets when empty', () => {
    const suggestions = buildServerUrlSuggestions('')
    expect(suggestions.some((s) => s.url === 'http://localhost:7080')).toBe(true)
    expect(suggestions.some((s) => s.url === 'https://localhost:7443')).toBe(true)
  })

  it('surfaces matching recent servers first', () => {
    const suggestions = buildServerUrlSuggestions('192', ['http://192.168.1.10:7080'])
    expect(suggestions[0]?.url).toBe('http://192.168.1.10:7080')
    expect(suggestions[0]?.kind).toBe('recent')
  })

  it('completes a bare host with common ports', () => {
    const suggestions = buildServerUrlSuggestions('192.168.1.10')
    expect(suggestions.some((s) => s.url === 'http://192.168.1.10:7080')).toBe(true)
    expect(suggestions.some((s) => s.url === 'https://192.168.1.10:7443')).toBe(true)
  })

  it('adds schemes to host:port drafts', () => {
    const suggestions = buildServerUrlSuggestions('lab.local:7080')
    expect(suggestions.some((s) => s.url === 'http://lab.local:7080')).toBe(true)
    expect(suggestions.some((s) => s.url === 'https://lab.local:7080')).toBe(true)
  })
})
