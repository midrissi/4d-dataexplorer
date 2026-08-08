import { joinOriginAndPath, resolveHttpMethod } from '~/lib/http-client'
import { getBaseUrl } from '~/lib/platform'
import type { HttpClientSeed } from '~/store/http-client-types'

export { formatRelativeTime as formatHttpRelativeTime } from '~/components/SavedListPanel'

export function httpMethodTone(method: string): { text: string; bg: string } {
  switch (method.toUpperCase()) {
    case 'GET':
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
      }
    case 'POST':
      return {
        text: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/25',
      }
    case 'PUT':
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/25',
      }
    case 'PATCH':
      return {
        text: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/25',
      }
    case 'DELETE':
      return {
        text: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/25',
      }
    default:
      return {
        text: 'text-muted-foreground',
        bg: 'bg-muted/60 border-border/70',
      }
  }
}

export function httpRequestLabel(seed: HttpClientSeed): {
  method: string
  path: string
  fullUrl: string
  isCustomOrigin: boolean
} {
  const method = resolveHttpMethod({
    method: seed.method ?? 'GET',
    customMethod: seed.customMethod ?? '',
  })
  const currentOrigin = getBaseUrl().replace(/\/$/, '') || ''
  const isCustomOrigin = seed.targetMode === 'custom'
  const origin = isCustomOrigin
    ? (seed.customOrigin ?? '').trim().replace(/\/$/, '')
    : currentOrigin
  const path = seed.path || '/'
  const fullUrl = origin ? joinOriginAndPath(origin, path) : path
  return { method, path, fullUrl, isCustomOrigin }
}

export function httpStatusTone(status?: number, error?: string): string {
  if (error) return 'text-destructive bg-destructive/10 border-destructive/25'
  if (status == null) return 'text-muted-foreground bg-muted/50 border-border/60'
  if (status >= 200 && status < 300)
    return 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
  if (status >= 300 && status < 400)
    return 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25'
  if (status >= 400) return 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/25'
  return 'text-muted-foreground bg-muted/50 border-border/60'
}

export function httpAccentBarClass(status?: number, error?: string): string {
  if (error || (status != null && status >= 400)) return 'bg-destructive'
  if (status != null && status >= 300 && status < 400) return 'bg-amber-500'
  if (status != null && status >= 200 && status < 300) return 'bg-emerald-500'
  return 'bg-muted-foreground/40'
}
