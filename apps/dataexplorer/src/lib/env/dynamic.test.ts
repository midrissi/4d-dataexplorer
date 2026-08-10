import { describe, expect, it } from 'bun:test'
import {
  DYNAMIC_ENV_VARS,
  isDynamicEnvVar,
  listDynamicEnvVarKeys,
  lookupEnvVariable,
  resolveDynamicEnvVar,
  resolveEnvTemplates,
} from './index'

const labels = {
  global: 'Global',
  profile: 'Profile',
  base: 'Base',
  dynamic: 'Dynamic',
}

describe('dynamic env vars', () => {
  it('lists Postman-style keys with leading $', () => {
    const keys = listDynamicEnvVarKeys()
    expect(keys).toContain('$timestamp')
    expect(keys).toContain('$isoTimestamp')
    expect(keys).toContain('$guid')
    expect(keys).toContain('$randomInt')
    expect(keys.every((key) => key.startsWith('$'))).toBe(true)
    expect(DYNAMIC_ENV_VARS.length).toBe(keys.length)
  })

  it('resolves common dynamic values', () => {
    expect(isDynamicEnvVar('$timestamp')).toBe(true)
    const ts = resolveDynamicEnvVar('$timestamp')
    expect(ts).toMatch(/^\d+$/)
    expect(Number(ts)).toBeGreaterThan(1_600_000_000)

    const iso = resolveDynamicEnvVar('$isoTimestamp')
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const guid = resolveDynamicEnvVar('$guid')
    expect(guid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )

    const n = Number(resolveDynamicEnvVar('$randomInt'))
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThanOrEqual(1000)
  })

  it('returns undefined for unknown dynamic keys', () => {
    expect(resolveDynamicEnvVar('$notARealDynamicVar')).toBeUndefined()
    expect(isDynamicEnvVar('timestamp')).toBe(false)
  })

  it('resolves templates without treating them as unresolved', () => {
    const result = resolveEnvTemplates('ts={{$timestamp}} missing={{gone}}', {})
    expect(result.unresolved).toEqual(['gone'])
    expect(result.text).toMatch(/^ts=\d+ missing=\{\{gone\}\}$/)
  })

  it('lets user-defined map values override dynamic keys', () => {
    const result = resolveEnvTemplates('{{$timestamp}}', { $timestamp: 'fixed' })
    expect(result.text).toBe('fixed')
    expect(result.unresolved).toEqual([])
  })

  it('lookup marks dynamic scope for UI chips', () => {
    const hit = lookupEnvVariable(
      '$isoTimestamp',
      { globals: [], profileEnv: null, baseEnv: null },
      labels
    )
    expect(hit.unresolved).toBe(false)
    expect(hit.dynamic).toBe(true)
    expect(hit.scope).toBe('dynamic')
    expect(hit.scopeLabel).toBe('Dynamic')
    expect(hit.value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
