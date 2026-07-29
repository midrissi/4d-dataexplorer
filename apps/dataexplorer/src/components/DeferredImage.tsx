import { cn } from '@4d/ui'
import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '~/lib/api'
import { detectBinaryFormat } from '~/lib/detect-binary-format'
import { getImageUri } from '~/lib/fieldPaths'
import { getBaseUrl, isDesktop, onConnectionChange } from '~/lib/platform'

/** Cached blob object URLs keyed by absolute image URI (native shells only). */
const blobCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

function clearBlobCache() {
  for (const url of blobCache.values()) URL.revokeObjectURL(url)
  blobCache.clear()
  inflight.clear()
}

// Only drop cached images when the server base URL changes. Cookie jar updates
// also notify onConnectionChange (via setCookies), and revoking blobs then
// makes every <img src="blob:…"> fire onError → ImageOff placeholders.
if (typeof window !== 'undefined') {
  let cachedBaseUrl = getBaseUrl()
  onConnectionChange(() => {
    const next = getBaseUrl()
    if (next === cachedBaseUrl) return
    cachedBaseUrl = next
    clearBlobCache()
  })
}

function toAbsoluteUrl(uri: string): string {
  if (/^(https?:|data:|blob:)/i.test(uri)) return uri
  return `${getBaseUrl()}${uri.startsWith('/') ? '' : '/'}${uri}`
}

function mimeForImageBytes(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = contentType?.split(';')[0]?.trim().toLowerCase()
  if (fromHeader?.startsWith('image/') && fromHeader !== 'image/*') {
    return fromHeader
  }
  const detected = detectBinaryFormat(bytes)
  if (detected?.kind === 'image') return detected.mime
  return fromHeader && fromHeader !== 'application/octet-stream' ? fromHeader : 'image/jpeg'
}

/**
 * Resolve an image URI for display. On web, absolute REST URLs work via the
 * Vite proxy / same-origin cookies. On desktop/mobile, `<img>` cannot use
 * Tauri's cookie jar, so we fetch through the platform HTTP client and return
 * a blob URL.
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
    pending = api
      .fetchBinary(absolute)
      .then(({ bytes, contentType }) => {
        // Copy into a standalone buffer — never pass a TypedArray's shared
        // `.buffer` (may be larger / offset) into Blob.
        const copy = new Uint8Array(bytes.byteLength)
        copy.set(bytes)
        const blob = new Blob([copy], { type: mimeForImageBytes(bytes, contentType) })
        const objectUrl = URL.createObjectURL(blob)
        blobCache.set(absolute, objectUrl)
        return objectUrl
      })
      .finally(() => {
        inflight.delete(absolute)
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

    let cancelled = false
    setStatus('loading')
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

  // Blob URLs are already fully fetched — never lazy-load them. AG Grid (and
  // other overflow containers) break native lazy loading via IntersectionObserver.
  const imgLoading =
    displaySrc.startsWith('blob:') || displaySrc.startsWith('data:') ? 'eager' : loading

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      loading={imgLoading}
      decoding="async"
      onError={() => {
        setStatus('error')
        setDisplaySrc(null)
      }}
    />
  )
}
