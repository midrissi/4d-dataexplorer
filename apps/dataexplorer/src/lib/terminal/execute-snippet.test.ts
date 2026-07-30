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
})
