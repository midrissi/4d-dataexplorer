import { describe, expect, it } from 'bun:test'
import { wrapEntity, wrapSelection } from './create-ds'
import { executeSnippet, isExpressionCode } from './execute-snippet'

describe('isExpressionCode', () => {
  it('detects simple expressions', () => {
    expect(isExpressionCode('ds.Car.all()')).toBe(true)
    expect(isExpressionCode('1 + 2')).toBe(true)
    expect(isExpressionCode('await ds.Car.get(1)')).toBe(true)
  })

  it('rejects statements', () => {
    expect(isExpressionCode('const x = 1')).toBe(false)
    expect(isExpressionCode('let y = 2; y')).toBe(false)
  })
})

describe('executeSnippet', () => {
  it('returns expression values and captures console.log', async () => {
    const ds = {
      Car: {
        get: (key: number) =>
          Promise.resolve(wrapEntity({ __KEY: String(key), __STAMP: 1, name: 'Test' }, 'Car')),
      },
    }
    const result = await executeSnippet(
      `const car = await ds.Car.get(12)
console.log(car)
`,
      ds,
      { mirrorToAppConsole: false }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0]?.args[0]).toMatchObject({ name: 'Test' })
    expect(result.value).toBeUndefined()
  })

  it('returns expression result for single-line calls', async () => {
    const ds = {
      Car: {
        all: () =>
          Promise.resolve(
            wrapSelection(
              {
                __entityModel: 'Car',
                __COUNT: 0,
                __SENT: 0,
                __FIRST: 0,
                __ENTITIES: [],
                __ENTITYSET: '/rest/Car/$entityset/abc',
              },
              'Car'
            )
          ),
      },
    }
    const result = await executeSnippet('ds.Car.all()', ds, { mirrorToAppConsole: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ __COUNT: 0, __entityModel: 'Car' })
  })

  it('surfaces runtime errors', async () => {
    const result = await executeSnippet(
      'throw new Error("boom")',
      {},
      { mirrorToAppConsole: false }
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('boom')
  })

  it('exposes app.environment and resolves {{var}} in source', async () => {
    const { useEnvironmentsStore } = await import('~/store/environments')
    useEnvironmentsStore
      .getState()
      .setGlobals([{ id: 'g1', key: 'greeting', value: 'hello', type: 'default', enabled: true }])
    const setResult = await executeSnippet(
      `app.environment.globals.set("token", "abc")
return app.environment.globals.get("token")`,
      {},
      { mirrorToAppConsole: false, resolveEnvTemplatesInSource: false }
    )
    expect(setResult.ok).toBe(true)
    if (!setResult.ok) return
    expect(setResult.value).toBe('abc')

    const tpl = await executeSnippet('"{{greeting}}-world"', {}, { mirrorToAppConsole: false })
    expect(tpl.ok).toBe(true)
    if (!tpl.ok) return
    expect(tpl.value).toBe('hello-world')
  })

  it('sets variables on the active profile environment', async () => {
    const { useEnvironmentsStore } = await import('~/store/environments')
    useEnvironmentsStore.getState().setProfileBlock({
      environments: [
        {
          id: 'env-1',
          name: 'Local',
          color: '#38bdf8',
          variables: [],
        },
      ],
      activeEnvironmentId: 'env-1',
    })

    const result = await executeSnippet(
      `const ok = app.environment.profile.set("baseUrl", "https://example.test")
return { ok, value: app.environment.profile.get("baseUrl"), listed: app.environment.profile.list() }`,
      {},
      { mirrorToAppConsole: false, resolveEnvTemplatesInSource: false }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      ok: true,
      value: 'https://example.test',
      listed: { baseUrl: 'https://example.test' },
    })
  })
})
