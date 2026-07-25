import { cn } from '@4d/ui'
import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '~/lib/api'
import { getImageUri } from '~/lib/fieldPaths'
import { getBaseUrl, isDesktop, onConnectionChange } from '~/lib/platform'

/** Cached blob object URLs keyed by absolute image URI (desktop only). */
const blobCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

function clearBlobCache() {
  for (const url of blobCache.values()) URL.revokeObjectURL(url)
  blobCache.clear()
  inflight.clear()
}

// Drop cached images when the active server connection changes.
if (typeof window !== 'undefined') {
  onConnectionChange(clearBlobCache)
}

function toAbsoluteUrl(uri: string): string {
  if (/^(https?:|data:|blob:)/i.test(uri)) return uri
  return `${getBaseUrl()}${uri.startsWith('/') ? '' : '/'}${uri}`
}

/**
 * Resolve an image URI for display. On web, absolute REST URLs work via the
 * Vite proxy / same-origin cookies. On desktop, `<img>` cannot use Tauri's
 * cookie jar, so we fetch through the platform HTTP client and return a blob URL.
 */
async function resolveDisplaySrc(uri: string): Promise<string> {
  const absolute = toAbsoluteUrl(uri)
  if (/^(data:|blob:)/i.test(absolute) || !isDesktop()) {
    return absolute
  }

  const cached = blobCache.get(absolute)
  if (cached) return cached

  let pending = inflight.get(absolute)
  if (!pending) {
    pending = api.fetchBinary(absolute).then(({ bytes, contentType }) => {
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: contentType || 'image/*',
      })
      const objectUrl = URL.createObjectURL(blob)
      blobCache.set(absolute, objectUrl)
      inflight.delete(absolute)
      return objectUrl
    })
    inflight.set(absolute, pending)
  }
  return pending
}

type DeferredImageProps = {
  /** Deferred 4D picture value (`{ __deferred: { image, uri } }`). */
  value?: unknown
  /** Explicit image URL (absolute, relative REST path, data:, or blob:). */
  src?: string | null
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  /** Show a compact placeholder when the image is missing or fails to load. Default true. */
  showPlaceholder?: boolean
}

function ImagePlaceholder({ className, label }: { className?: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-8 min-w-8 items-center justify-center overflow-hidden',
        'border border-border/70 border-dashed bg-muted/50 text-muted-foreground/70',
        className
      )}
    >
      <ImageOff className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
    </span>
  )
}

/**
 * Renders a 4D deferred picture (or any REST image URL) so it works in both
 * web (proxied same-origin) and desktop (authenticated Tauri fetch → blob URL).
 * Failed or empty images show a muted placeholder instead of the browser's broken-image icon.
 */
export function DeferredImage({
  value,
  src,
  alt = '',
  className,
  loading = 'lazy',
  showPlaceholder = true,
}: DeferredImageProps) {
  const input = src ?? (value !== undefined ? getImageUri(value) : null)
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const fallbackLabel = alt.trim() || 'Image unavailable'

  useEffect(() => {
    if (!input) {
      setDisplaySrc(null)
      setStatus('idle')
      return
    }

    setStatus('loading')

    // data:/blob: and web absolute URLs can paint immediately.
    const absolute = toAbsoluteUrl(input)
    if (/^(data:|blob:)/i.test(absolute) || !isDesktop()) {
      setDisplaySrc(absolute)
      setStatus('ready')
      return
    }

    let cancelled = false
    setDisplaySrc(null)
    void resolveDisplaySrc(input)
      .then((url) => {
        if (cancelled) return
        setDisplaySrc(url)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setDisplaySrc(null)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [input])

  if (!input) {
    if (!showPlaceholder) return null
    return <ImagePlaceholder className={className} label={fallbackLabel} />
  }

  if (status === 'error' || (status === 'ready' && !displaySrc)) {
    if (!showPlaceholder) return null
    return <ImagePlaceholder className={className} label={fallbackLabel} />
  }

  if (status === 'loading' || !displaySrc) {
    return (
      <span
        aria-hidden
        className={cn('inline-block min-h-8 min-w-8 animate-pulse bg-muted/60', className)}
      />
    )
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        setStatus('error')
        setDisplaySrc(null)
      }}
    />
  )
}
