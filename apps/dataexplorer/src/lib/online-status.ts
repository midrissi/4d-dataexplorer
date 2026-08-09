const listeners = new Set<() => void>()

function emitOnlineStatus(): void {
  for (const listener of listeners) listener()
}

export function getOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function subscribeOnlineStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', emitOnlineStatus)
  window.addEventListener('offline', emitOnlineStatus)
}
