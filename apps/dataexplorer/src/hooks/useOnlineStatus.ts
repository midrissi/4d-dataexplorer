import { useSyncExternalStore } from 'react'
import { getOnlineStatus, subscribeOnlineStatus } from '~/lib/online-status'

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnlineStatus, getOnlineStatus, () => true)
}
