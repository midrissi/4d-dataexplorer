import {
  configureAssistantLlm,
  createLlmSettingsStorage,
  isLlmConfigured,
  mergeLlmSettings,
} from '@4djs/assistant/core'
import { createDataExplorerLlmSettings } from '~/assistant/llm-config'

const LLM_SETTINGS_STORAGE_KEY = 'dataexplorer-llm-settings'

let storage: ReturnType<typeof createLlmSettingsStorage> | null = null

function getStorage() {
  if (!storage) {
    storage = createLlmSettingsStorage(LLM_SETTINGS_STORAGE_KEY)
  }
  return storage
}

export function getMergedAssistantLlmSettings() {
  const base = createDataExplorerLlmSettings()
  const stored = getStorage().load(base)
  return mergeLlmSettings(base, stored)
}

export function isAssistantLlmConfigured(): boolean {
  const settings = getMergedAssistantLlmSettings()
  return isLlmConfigured(settings)
}

// Metadata generation and other features call requestLlmCompletion outside the
// chat panel. Register merged settings globally so they work even when the
// assistant UI has never been opened.
configureAssistantLlm(() => getMergedAssistantLlmSettings())
