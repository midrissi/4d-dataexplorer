import {
  configureAssistantLlm,
  createLlmSettingsStorage,
  isLlmConfigured,
  mergeLlmSettings,
} from '@4djs/assistant/core'
import { createDataExplorerLlmSettings } from '~/assistant/llm-config'
import { getOnlineStatus } from '~/lib/online-status'

export const CLOUD_LLM_OFFLINE_ERROR = 'Internet connection required'

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

/** True for loopback, .local, and RFC1918 hosts that work without public internet. */
export function isLocalLlmBaseUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const parsed = new URL(url.includes('://') ? url : `http://${url}`)
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      return true
    }
    if (host.endsWith('.local')) return true
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
    if (!ipv4) return false
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 10 || (a === 192 && b === 168)) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    return false
  } catch {
    return false
  }
}

/** Configured cloud LLM while the device reports offline. */
export function isCloudLlmOffline(): boolean {
  if (getOnlineStatus()) return false
  if (!isAssistantLlmConfigured()) return false
  return !isLocalLlmBaseUrl(getMergedAssistantLlmSettings().baseUrl)
}

export function assertCloudLlmAvailable(): void {
  if (!isAssistantLlmConfigured()) {
    throw new Error('LLM not configured')
  }
  if (isCloudLlmOffline()) {
    throw new Error(CLOUD_LLM_OFFLINE_ERROR)
  }
}

// Metadata generation and other features call requestLlmCompletion outside the
// chat panel. Register merged settings globally so they work even when the
// assistant UI has never been opened.
configureAssistantLlm(() => getMergedAssistantLlmSettings())
