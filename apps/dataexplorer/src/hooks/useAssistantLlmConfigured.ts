import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { isAssistantLlmConfigured } from '~/lib/assistant-llm-configured'

const LLM_SETTINGS_STORAGE_KEY = 'dataexplorer-llm-settings'

let configuredSnapshot = isAssistantLlmConfigured()
const listeners = new Set<() => void>()

function emitChange() {
  configuredSnapshot = isAssistantLlmConfigured()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): boolean {
  return configuredSnapshot
}

/** Call after LLM settings are saved so footer/menus update without a reload. */
export function notifyAssistantLlmConfiguredChanged(): void {
  emitChange()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LLM_SETTINGS_STORAGE_KEY || event.key === null) {
      emitChange()
    }
  })
}

export function useAssistantLlmConfigured(): boolean {
  const configured = useSyncExternalStore(subscribe, getSnapshot, () => false)

  // Re-check when the tab becomes visible (settings may have changed in-panel)
  const recheck = useCallback(() => {
    emitChange()
  }, [])

  useEffect(() => {
    const onFocus = () => recheck()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(recheck, 2000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [recheck])

  return configured
}

/** One-shot check for non-reactive call sites (prefer the hook in components). */
export function readAssistantLlmConfigured(): boolean {
  return isAssistantLlmConfigured()
}
