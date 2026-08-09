import { afterEach, describe, expect, test } from 'bun:test'
import {
  assertCloudLlmAvailable,
  CLOUD_LLM_OFFLINE_ERROR,
  isCloudLlmOffline,
} from './assistant-llm-configured'
import { configureTestLlm, unconfigureTestLlm } from './metadata-llm.test-helper'

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('assertCloudLlmAvailable', () => {
  afterEach(() => {
    setNavigatorOnline(true)
    unconfigureTestLlm()
  })

  test('throws when unconfigured', () => {
    unconfigureTestLlm()
    expect(() => assertCloudLlmAvailable()).toThrow('LLM not configured')
  })

  test('throws when offline with a remote LLM URL', () => {
    configureTestLlm()
    setNavigatorOnline(false)
    expect(isCloudLlmOffline()).toBe(true)
    expect(() => assertCloudLlmAvailable()).toThrow(CLOUD_LLM_OFFLINE_ERROR)
  })

  test('allows a configured cloud LLM while online', () => {
    configureTestLlm()
    setNavigatorOnline(true)
    expect(isCloudLlmOffline()).toBe(false)
    expect(() => assertCloudLlmAvailable()).not.toThrow()
  })
})
