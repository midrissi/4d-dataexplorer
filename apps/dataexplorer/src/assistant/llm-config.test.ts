import { afterEach, describe, expect, test } from 'bun:test'
import { createDataExplorerLlmSettings } from './llm-config'

type MutableEnv = Record<string, string | undefined>

const env = import.meta.env as unknown as MutableEnv

describe('createDataExplorerLlmSettings', () => {
  const original = { ...env }

  afterEach(() => {
    for (const key of ['VITE_LLM_KEY', 'VITE_LLM_BASE_URL', 'VITE_LLM_MODEL', 'VITE_LLM_MODELS']) {
      if (key in original) env[key] = original[key]
      else delete env[key]
    }
  })

  test('uses defaults when env is empty', () => {
    delete env.VITE_LLM_KEY
    delete env.VITE_LLM_BASE_URL
    delete env.VITE_LLM_MODEL
    delete env.VITE_LLM_MODELS
    const settings = createDataExplorerLlmSettings()
    expect(settings.baseUrl).toBe('https://api.openai.com/v1')
    expect(settings.model).toBe('gpt-4o-mini')
    expect(settings.apiKey).toBeNull()
    expect(settings.models).toBeUndefined()
  })

  test('reads custom values and models list from env', () => {
    env.VITE_LLM_KEY = 'secret'
    env.VITE_LLM_BASE_URL = 'http://localhost:1234/v1'
    env.VITE_LLM_MODEL = 'llama'
    env.VITE_LLM_MODELS = 'llama, mistral, llama'
    const settings = createDataExplorerLlmSettings()
    expect(settings.apiKey).toBe('secret')
    expect(settings.baseUrl).toBe('http://localhost:1234/v1')
    expect(settings.model).toBe('llama')
    // default model is prepended and duplicates removed
    expect(settings.models).toEqual(['llama', 'mistral'])
    expect(settings.enabled).toBe(true)
  })

  test('ignores blank models env', () => {
    env.VITE_LLM_MODELS = '   ,  '
    const settings = createDataExplorerLlmSettings()
    expect(settings.models).toBeUndefined()
  })
})
