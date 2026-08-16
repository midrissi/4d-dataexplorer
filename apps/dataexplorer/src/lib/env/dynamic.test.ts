import { describe, expect, it } from 'bun:test'
import {
  __FAKER_MODULES_FOR_TEST,
  DYNAMIC_ENV_VARS,
  isDynamicEnvVar,
  isFakerPathKey,
  listAllDynamicEnvVarDefs,
  listDynamicEnvVarKeys,
  resolveDynamicEnvVar,
} from './dynamic'
import { lookupEnvVariable, resolveEnvTemplates } from './index'

const labels = {
  global: 'Global',
  profile: 'Profile',
  base: 'Base',
  dynamic: 'Dynamic',
}

describe('dynamic env vars', () => {
  it('lists only clock aliases (Faker covers the rest)', () => {
    const aliasKeys = DYNAMIC_ENV_VARS.map((item) => item.key)
    expect(aliasKeys).toEqual(['$timestamp', '$isoTimestamp'])
    expect(aliasKeys.every((key) => key.startsWith('$'))).toBe(true)
    expect(isDynamicEnvVar('$guid')).toBe(false)
    expect(isDynamicEnvVar('$randomFirstName')).toBe(false)
    expect(isDynamicEnvVar('$randomInt')).toBe(false)
  })

  it('lists faker path keys for every module', () => {
    const keys = listDynamicEnvVarKeys()
    expect(keys.length).toBe(listAllDynamicEnvVarDefs().length)
    expect(keys).toContain('$timestamp')
    expect(keys).toContain('$faker.person.fullName')
    expect(keys).toContain('$faker.string.uuid')
    expect(keys).toContain('$faker.airline.airline')
    expect(keys).toContain('$faker.food.dish')
    for (const moduleName of __FAKER_MODULES_FOR_TEST) {
      expect(keys.some((key) => key.startsWith(`$faker.${moduleName}.`))).toBe(true)
    }
  })

  it('resolves clock aliases', () => {
    expect(isDynamicEnvVar('$timestamp')).toBe(true)
    const ts = resolveDynamicEnvVar('$timestamp')
    expect(ts).toMatch(/^\d+$/)
    expect(Number(ts)).toBeGreaterThan(1_600_000_000)

    const iso = resolveDynamicEnvVar('$isoTimestamp')
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('resolves $faker.module.method paths', () => {
    expect(isFakerPathKey('$faker.person.fullName')).toBe(true)
    expect(isDynamicEnvVar('$faker.person.fullName')).toBe(true)

    const guid = resolveDynamicEnvVar('$faker.string.uuid')
    expect(guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

    const name = resolveDynamicEnvVar('$faker.person.fullName')
    expect(name).toBeDefined()
    expect(name?.length).toBeGreaterThan(0)

    const dish = resolveDynamicEnvVar('$faker.food.dish')
    expect(dish).toBeDefined()
    expect(dish?.length).toBeGreaterThan(0)

    const airline = resolveDynamicEnvVar('$faker.airline.airline')
    expect(airline).toBeDefined()
    expect(airline?.startsWith('{') || (airline?.length ?? 0) > 0).toBe(true)
  })

  it('accepts Faker v8 userName alias for internet.username', () => {
    expect(isFakerPathKey('$faker.internet.username')).toBe(true)
    expect(isFakerPathKey('$faker.internet.userName')).toBe(true)
    const modern = resolveDynamicEnvVar('$faker.internet.username')
    const legacy = resolveDynamicEnvVar('$faker.internet.userName')
    expect(modern?.length).toBeGreaterThan(0)
    expect(legacy?.length).toBeGreaterThan(0)
  })

  it('returns undefined for unknown dynamic keys', () => {
    expect(resolveDynamicEnvVar('$notARealDynamicVar')).toBeUndefined()
    expect(isDynamicEnvVar('timestamp')).toBe(false)
    expect(isFakerPathKey('$faker.nope.method')).toBe(false)
    expect(resolveDynamicEnvVar('$faker.nope.method')).toBeUndefined()
  })

  it('resolves templates without treating them as unresolved', () => {
    const result = resolveEnvTemplates('ts={{$timestamp}} missing={{gone}}', {})
    expect(result.unresolved).toEqual(['gone'])
    expect(result.text).toMatch(/^ts=\d+ missing=\{\{gone\}\}$/)
  })

  it('resolves faker paths inside templates', () => {
    const result = resolveEnvTemplates('{{$faker.lorem.word}}', {})
    expect(result.unresolved).toEqual([])
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.text.includes('{{')).toBe(false)
  })

  it('lets user-defined map values override dynamic keys', () => {
    const result = resolveEnvTemplates('{{$timestamp}}', { $timestamp: 'fixed' })
    expect(result.text).toBe('fixed')
    expect(result.unresolved).toEqual([])
  })

  it('honors gender options for faker person names and portraits', () => {
    for (let i = 0; i < 20; i++) {
      const fakerFemale = resolveDynamicEnvVar('$faker.person.firstName', { gender: 'female' })
      const fakerMale = resolveDynamicEnvVar('$faker.person.firstName', { gender: 'male' })
      expect(fakerFemale).toBeDefined()
      expect(fakerMale).toBeDefined()
      expect(fakerFemale?.length).toBeGreaterThan(0)
      expect(fakerMale?.length).toBeGreaterThan(0)
    }
    expect(resolveDynamicEnvVar('$faker.image.personPortrait', { gender: 'female' })).toContain(
      '/female/'
    )
  })

  it('honors int between options on faker.number.int', () => {
    for (let i = 0; i < 30; i++) {
      const fakerN = Number(resolveDynamicEnvVar('$faker.number.int', { min: 10, max: 20 }))
      expect(fakerN).toBeGreaterThanOrEqual(10)
      expect(fakerN).toBeLessThanOrEqual(20)
    }
  })

  it('honors date after/before options on faker.date.between', () => {
    for (let i = 0; i < 20; i++) {
      const between = resolveDynamicEnvVar('$faker.date.between', {
        after: '2020-01-01',
        before: '2020-01-31',
      })
      expect(between).toBeDefined()
      expect(between ?? '').toMatch(/^\d{4}-\d{2}-\d{2}T/)
      const day = between?.slice(0, 10) ?? ''
      expect(day >= '2020-01-01').toBe(true)
      expect(day <= '2020-01-31').toBe(true)
    }
  })

  it('resolves pipe filters on faker dynamics', () => {
    const result = resolveEnvTemplates('{{$faker.number.int | between:5,5}}', {})
    expect(result.unresolved).toEqual([])
    expect(result.text).toBe('5')
  })

  it('hashes faker output', () => {
    const result = resolveEnvTemplates('{{$faker.string.alpha | hash:md5}}', {})
    expect(result.unresolved).toEqual([])
    expect(result.text).toMatch(/^[a-f0-9]{32}$/)
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

    const fakerHit = lookupEnvVariable(
      '$faker.internet.email',
      { globals: [], profileEnv: null, baseEnv: null },
      labels
    )
    expect(fakerHit.unresolved).toBe(false)
    expect(fakerHit.dynamic).toBe(true)
    expect(fakerHit.value).toContain('@')
  })
})
