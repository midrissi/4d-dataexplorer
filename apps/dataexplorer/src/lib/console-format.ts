import type { ConsoleEntry, NetworkDetails } from '~/store/console'

/** ISO time-of-day fragment (`HH:mm:ss.sss`) for console log timestamps. */
export function formatConsoleTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23)
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb < 10 ? kb.toFixed(1) : kb.toFixed(0)} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(2) : mb.toFixed(1)} MB`
}

export function splitNetworkUrl(url: string): { origin: string; pathWithQuery: string } {
  try {
    const parsed = new URL(url)
    return {
      origin: parsed.origin,
      pathWithQuery: `${parsed.pathname}${parsed.search}${parsed.hash}` || '/',
    }
  } catch {
    return { origin: '', pathWithQuery: url }
  }
}

export function networkMethodToneClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
    case 'POST':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'PUT':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
    case 'PATCH':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    case 'HEAD':
    case 'OPTIONS':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-foreground'
  }
}

export function isFailedNetwork(details: Pick<NetworkDetails, 'error' | 'status'>): boolean {
  return details.error !== undefined || (details.status !== undefined && details.status >= 400)
}

export function failedNetworkBackground(entry: ConsoleEntry): string | false {
  const details = entry.network
  if (!details) return false
  return isFailedNetwork(details) && 'bg-destructive/[0.03] hover:bg-destructive/10'
}
