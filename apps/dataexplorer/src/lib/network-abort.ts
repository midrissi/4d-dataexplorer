/** In-flight network request aborts, keyed by console entry id. */
const pendingAborts = new Map<string, () => void>()

export function registerNetworkAbort(entryId: string, abort: () => void): void {
  pendingAborts.set(entryId, abort)
}

export function unregisterNetworkAbort(entryId: string): void {
  pendingAborts.delete(entryId)
}

export function abortNetworkRequest(entryId: string): boolean {
  const abort = pendingAborts.get(entryId)
  if (!abort) return false
  abort()
  return true
}

export function hasNetworkAbort(entryId: string): boolean {
  return pendingAborts.has(entryId)
}
