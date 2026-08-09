import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '~/hooks/useOnlineStatus'

/** How long the “back online” chip stays in the status bar. */
export const ONLINE_STATUS_FLASH_MS = 4000

export type OnlineStatusChipKind = 'hidden' | 'offline' | 'online'

export function resolveOnlineStatusChipKind(
  online: boolean,
  flashOnline: boolean
): OnlineStatusChipKind {
  if (!online) return 'offline'
  if (flashOnline) return 'online'
  return 'hidden'
}

/** Offline stays visible; after reconnect, flash “online” then hide. */
export function useOnlineStatusFlash(durationMs = ONLINE_STATUS_FLASH_MS): {
  online: boolean
  flashOnline: boolean
  kind: OnlineStatusChipKind
  dismissFlash: () => void
} {
  const online = useOnlineStatus()
  const [flashOnline, setFlashOnline] = useState(false)
  const seenOfflineRef = useRef(false)

  useEffect(() => {
    if (!online) {
      seenOfflineRef.current = true
      setFlashOnline(false)
      return
    }
    if (!seenOfflineRef.current) return
    seenOfflineRef.current = false
    setFlashOnline(true)
    const id = window.setTimeout(() => setFlashOnline(false), durationMs)
    return () => window.clearTimeout(id)
  }, [durationMs, online])

  const dismissFlash = useCallback(() => {
    setFlashOnline(false)
  }, [])

  return {
    online,
    flashOnline,
    kind: resolveOnlineStatusChipKind(online, flashOnline),
    dismissFlash,
  }
}
