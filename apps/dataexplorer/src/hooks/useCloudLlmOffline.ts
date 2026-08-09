import { useSyncExternalStore } from 'react'
import { subscribeAssistantLlmConfigured } from '~/hooks/useAssistantLlmConfigured'
import { isCloudLlmOffline } from '~/lib/assistant-llm-configured'
import { subscribeOnlineStatus } from '~/lib/online-status'

function subscribe(listener: () => void): () => void {
  const unsubOnline = subscribeOnlineStatus(listener)
  const unsubLlm = subscribeAssistantLlmConfigured(listener)
  return () => {
    unsubOnline()
    unsubLlm()
  }
}

export function useCloudLlmOffline(): boolean {
  return useSyncExternalStore(subscribe, isCloudLlmOffline, () => false)
}
