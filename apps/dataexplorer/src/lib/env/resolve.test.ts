import { describe, expect, it } from 'bun:test'
import {
  collectEnvTemplateKeys,
  collectUnresolved,
  findEnvironmentById,
  lookupEnvVariable,
  mergeActiveEnvMap,
  parseEnvTemplateSegments,
  resolveEnvTemplates,
  resolveEnvTemplatesDeep,
  variablesToMap,
} from './index'
import type { Environment, EnvVariable } from './types'

const labels = { global: 'Global', profile: 'Profile', base: 'Base' }

function v(key: string, value: string, extras: Partial<EnvVariable> = {}): EnvVariable {
  return { id: `id-${key}`, key, value, type: 'default', enabled: true, ...extras }
}

describe('parseEnvTemplateSegments', () => {
  it('returns empty text segment for empty string', () => {
    expect(parseEnvTemplateSegments('')).toEqual([{ kind: 'text', text: '' }])
  })

  it('splits text and variables', () => {
    expect(parseEnvTemplateSegments('{{baseUrl}}/rest/{{path}}')).toEqual([
      { kind: 'variable', key: 'baseUrl', raw: '{{baseUrl}}' },
      { kind: 'text', text: '/rest/' },
      { kind: 'variable', key: 'path', raw: '{{path}}' },
    ])
  })

  it('trims keys inside braces', () => {
    expect(parseEnvTemplateSegments('{{ baseUrl }}')).toEqual([
      { kind: 'variable', key: 'baseUrl', raw: '{{ baseUrl }}' },
    ])
  })

  it('strips filters from segment key', () => {
    expect(parseEnvTemplateSegments('{{name | upper}}')).toEqual([
      { kind: 'variable', key: 'name', raw: '{{name | upper}}' },
    ])
  })
})

describe('resolveEnvTemplates', () => {
  it('resolves known keys and leaves unresolved literals', () => {
    const map = { baseUrl: 'http://localhost:7080' }
    const result = resolveEnvTemplates('{{baseUrl}}/rest/{{missing}}', map)
    expect(result.text).toBe('http://localhost:7080/rest/{{missing}}')
    expect(result.unresolved).toEqual(['missing'])
  })

  it('supports Map', () => {
    const map = new Map([['token', 'abc']])
    expect(resolveEnvTemplates('Bearer {{token}}', map).text).toBe('Bearer abc')
  })

  it('skips when no templates', () => {
    expect(resolveEnvTemplates('plain', {})).toEqual({ text: 'plain', unresolved: [] })
  })

  it('applies transform filters on env values', () => {
    const result = resolveEnvTemplates('{{name | upper}}', { name: 'ada' })
    expect(result).toEqual({ text: 'ADA', unresolved: [] })
  })

  it('applies chained transforms', () => {
    expect(resolveEnvTemplates('{{title | snake | upper}}', { title: 'Hello World' }).text).toBe(
      'HELLO_WORLD'
    )
  })

  it('leaves unknown filters unresolved', () => {
    const result = resolveEnvTemplates('{{name | nope}}', { name: 'x' })
    expect(result.text).toBe('{{name | nope}}')
    expect(result.unresolved).toEqual(['name | nope'])
  })

  it('rejects generator options on plain env values', () => {
    const result = resolveEnvTemplates('{{name | female}}', { name: 'Ada' })
    expect(result.text).toBe('{{name | female}}')
    expect(result.unresolved).toEqual(['name | female'])
  })

  it('resolves dynamic filters', () => {
    expect(resolveEnvTemplates('{{$faker.number.int | between:7,7}}', {}).text).toBe('7')
  })

  it('applies hash filter on dynamics', () => {
    // firstName is random; pin via hashing a fixed env value instead
    expect(resolveEnvTemplates('{{name | hash:md5}}', { name: 'test' }).text).toBe(
      '098f6bcd4621d373cade4e832627b4f6'
    )
  })

  it('resolves $pick from a list', () => {
    const result = resolveEnvTemplates('{{$pick | from:only}}', {})
    expect(result).toEqual({ text: 'only', unresolved: [] })
  })

  it('resolves $pick from $lists context', () => {
    const result = resolveEnvTemplates(
      '{{$pick | from:$lists.companyKeys}}',
      {},
      {
        lists: { companyKeys: ['42'] },
      }
    )
    expect(result).toEqual({ text: '42', unresolved: [] })
  })

  it('leaves $pick with missing $lists unresolved', () => {
    const result = resolveEnvTemplates('{{$pick | from:$lists.companyKeys}}', {})
    expect(result.text).toBe('{{$pick | from:$lists.companyKeys}}')
    expect(result.unresolved).toEqual(['$pick | from:$lists.companyKeys'])
  })

  it('resolves $repeat as a JSON array string', () => {
    const result = resolveEnvTemplates(
      '{{$repeat | of:$faker.number.int | count:3 | min:2 | max:2}}',
      {}
    )
    expect(result.unresolved).toEqual([])
    expect(result.text).toBe('[2,2,2]')
  })

  it('resolves $vector as a JSON array string', () => {
    const result = resolveEnvTemplates('{{$vector | dims:3 | min:0 | max:0}}', {})
    expect(result.unresolved).toEqual([])
    expect(result.text).toBe('[0,0,0]')
  })

  it('leaves invalid helper templates unresolved', () => {
    const result = resolveEnvTemplates('{{$pick}}', {})
    expect(result.text).toBe('{{$pick}}')
    expect(result.unresolved).toEqual(['$pick'])
  })
})

describe('collectEnvTemplateKeys / collectUnresolved', () => {
  it('dedupes keys', () => {
    expect(collectEnvTemplateKeys('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })

  it('collects base keys when filters are present', () => {
    expect(
      collectEnvTemplateKeys('{{ $faker.number.int | between:1,5 }} {{name | upper}}')
    ).toEqual(['$faker.number.int', 'name'])
  })

  it('lists unresolved only', () => {
    expect(collectUnresolved('{{a}} {{b}}', { a: '1' })).toEqual(['b'])
  })
})

describe('resolveEnvTemplatesDeep', () => {
  it('walks nested objects and arrays', () => {
    const result = resolveEnvTemplatesDeep(
      { url: '{{base}}/x', nested: [{ h: '{{token}}' }], n: 1 },
      { base: 'http://h', token: 't' }
    )
    expect(result.value).toEqual({
      url: 'http://h/x',
      nested: [{ h: 't' }],
      n: 1,
    })
    expect(result.unresolved).toEqual([])
  })

  it('collects unresolved from deep strings', () => {
    const result = resolveEnvTemplatesDeep({ a: '{{x}}', b: '{{y}}' }, { x: '1' })
    expect(result.value).toEqual({ a: '1', b: '{{y}}' })
    expect(result.unresolved).toEqual(['y'])
  })

  it('rehydrates exact $object and $repeat leaves', () => {
    const result = resolveEnvTemplatesDeep(
      {
        person: '{{$object | name:Ada | age:$faker.number.int | min:30 | max:30}}',
        ids: '{{$repeat | of:$faker.number.int | count:2 | min:1 | max:1}}',
        embedding: '{{$vector | dims:2 | min:0 | max:0}}',
        label: 'Status: {{$pick | from:ok}}',
      } as Record<string, unknown>,
      {}
    )
    expect(result.unresolved).toEqual([])
    expect(result.value).toEqual({
      person: { name: 'Ada', age: 30 },
      ids: [1, 1],
      embedding: [0, 0],
      label: 'Status: ok',
    })
  })
})

describe('mergeActiveEnvMap', () => {
  it('applies base > profile > globals', () => {
    const globals = [v('a', 'g'), v('b', 'g'), v('c', 'g')]
    const profileEnv: Environment = {
      id: 'p1',
      name: 'Dev',
      variables: [v('a', 'p'), v('b', 'p')],
    }
    const baseEnv: Environment = {
      id: 'b1',
      name: 'Local',
      variables: [v('a', 'b')],
    }
    const map = mergeActiveEnvMap({ globals, profileEnv, baseEnv })
    expect(map.get('a')).toBe('b')
    expect(map.get('b')).toBe('p')
    expect(map.get('c')).toBe('g')
  })

  it('ignores disabled variables', () => {
    const map = variablesToMap([v('x', '1', { enabled: false }), v('y', '2')])
    expect(map.has('x')).toBe(false)
    expect(map.get('y')).toBe('2')
  })

  it('falls back to initialValue when current value is empty', () => {
    const map = variablesToMap([
      v('key', '', { initialValue: '11' }),
      v('filled', 'now', { initialValue: 'was' }),
    ])
    expect(map.get('key')).toBe('11')
    expect(map.get('filled')).toBe('now')
  })
})

describe('lookupEnvVariable', () => {
  it('returns scope metadata from winning layer', () => {
    const layers = {
      globals: [v('token', 'g', { type: 'secret' as const })],
      profileEnv: {
        id: 'p',
        name: 'Dev',
        color: '#f00',
        variables: [v('token', 'p')],
      } satisfies Environment,
      baseEnv: null,
    }
    const hit = lookupEnvVariable('token', layers, labels)
    expect(hit).toMatchObject({
      value: 'p',
      scope: 'profile',
      scopeLabel: 'Profile',
      scopeColor: '#f00',
      secret: false,
      unresolved: false,
    })
  })

  it('marks unresolved when missing', () => {
    const hit = lookupEnvVariable('nope', { globals: [], profileEnv: null, baseEnv: null }, labels)
    expect(hit.unresolved).toBe(true)
  })
})

describe('findEnvironmentById', () => {
  it('finds or returns null', () => {
    const envs: Environment[] = [{ id: '1', name: 'A', variables: [] }]
    expect(findEnvironmentById(envs, '1')?.name).toBe('A')
    expect(findEnvironmentById(envs, null)).toBeNull()
  })
})
