import { describe, expect, it } from 'bun:test'
import {
  queryExplainAccentClass,
  queryExplainAccessTone,
  queryExplainRailClass,
} from './query-explain-display'

describe('queryExplainAccessTone', () => {
  it('uses distinct semantic colors per access kind', () => {
    expect(queryExplainAccessTone('join').text).toContain('sky')
    expect(queryExplainAccessTone('index').text).toContain('emerald')
    expect(queryExplainAccessTone('sequential').text).toContain('amber')
    expect(queryExplainAccessTone('filter').text).toContain('violet')
    expect(queryExplainAccessTone('operator').text).toContain('muted')
  })
})

describe('queryExplainAccentClass', () => {
  it('matches favourite-row accent bars', () => {
    expect(queryExplainAccentClass('join')).toBe('bg-sky-500')
    expect(queryExplainAccentClass('index')).toBe('bg-emerald-500')
    expect(queryExplainAccentClass('unknown')).toBe('bg-muted-foreground/40')
  })
})

describe('queryExplainRailClass', () => {
  it('uses the same hue as the accent bar at low opacity', () => {
    expect(queryExplainRailClass('join')).toContain('sky')
    expect(queryExplainRailClass('filter')).toContain('violet')
    expect(queryExplainRailClass('unknown')).toContain('border')
  })
})
