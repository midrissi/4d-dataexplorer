import { describe, expect, test } from 'bun:test'
import { filterAssistantExposedMethods, isAssistantExposedMethod } from './assistant-exposed-method'

describe('assistant-exposed-method', () => {
  test('includes explicitly exposed methods', () => {
    expect(isAssistantExposedMethod({ exposed: true })).toBe(true)
  })

  test('excludes explicitly non-exposed methods', () => {
    expect(isAssistantExposedMethod({ exposed: false })).toBe(false)
  })

  test('excludes publicOnServer scope', () => {
    expect(isAssistantExposedMethod({ scope: 'publicOnServer' })).toBe(false)
    expect(isAssistantExposedMethod({ exposed: false, scope: 'publicOnServer' })).toBe(false)
  })

  test('includes public scope when exposed is unset', () => {
    expect(isAssistantExposedMethod({ scope: 'public' })).toBe(true)
  })

  test('defaults unknown visibility to excluded', () => {
    expect(isAssistantExposedMethod({})).toBe(false)
  })

  test('filterAssistantExposedMethods keeps only assistant-visible methods', () => {
    const filtered = filterAssistantExposedMethods([
      { name: 'searchByDescription', exposed: true },
      { name: '_embeddingClient', scope: 'publicOnServer' },
      { name: 'login', scope: 'public' },
    ] as Array<{ name: string; exposed?: boolean; scope?: string }>)

    expect(filtered.map((method) => method.name)).toEqual(['searchByDescription', 'login'])
  })
})
