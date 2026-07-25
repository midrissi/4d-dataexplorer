import type { AssistantLlmSettings } from '@4djs/assistant/core'
import { DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL, isLlmConfigured } from '@4djs/assistant/core'
import systemPrompt from './system-prompt.md?raw'

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readModelsFromEnv(defaultModel: string): string[] | undefined {
  const raw = readEnv('VITE_LLM_MODELS')
  if (!raw) return undefined
  const models = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return models.length ? [...new Set([defaultModel, ...models])] : undefined
}

export function createDataExplorerLlmSettings(): AssistantLlmSettings {
  const apiKey = readEnv('VITE_LLM_KEY') ?? null
  const baseUrl = readEnv('VITE_LLM_BASE_URL') ?? DEFAULT_LLM_BASE_URL
  const model = readEnv('VITE_LLM_MODEL') ?? DEFAULT_LLM_MODEL
  const models = readModelsFromEnv(model)
  return {
    enabled: isLlmConfigured({
      enabled: true,
      baseUrl,
      apiKey,
      model,
    }),
    baseUrl,
    apiKey,
    model,
    models,
    systemPrompt: systemPrompt.trim(),
  }
}
