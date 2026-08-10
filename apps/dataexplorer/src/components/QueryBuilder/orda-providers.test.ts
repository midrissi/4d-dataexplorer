import { describe, expect, test } from 'bun:test'
import { clearOrdaProviders, replaceOrdaProviders } from './orda-providers'

describe('orda-providers', () => {
  test('replaceOrdaProviders disposes the previous registration set', () => {
    let firstDisposed = 0
    let secondDisposed = 0

    replaceOrdaProviders([
      {
        dispose() {
          firstDisposed += 1
        },
      },
    ])
    replaceOrdaProviders([
      {
        dispose() {
          secondDisposed += 1
        },
      },
    ])

    expect(firstDisposed).toBe(1)
    expect(secondDisposed).toBe(0)

    clearOrdaProviders()
    expect(secondDisposed).toBe(1)
  })
})
