import { Button, cn } from '@4d/ui'
import { Download, Loader2, Share } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DeferredImage } from '~/components/DeferredImage'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import { canShareFiles, downloadBytes, shareBytes } from '~/lib/download-bytes'
import { getBaseUrl } from '~/lib/platform'

function toAbsoluteUrl(uri: string): string {
  if (/^(https?:|data:|blob:)/i.test(uri)) return uri
  return `${getBaseUrl()}${uri.startsWith('/') ? '' : '/'}${uri}`
}

function extensionFromMime(mime: string | null | undefined): string {
  if (!mime) return 'bin'
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  if (base === 'image/png') return 'png'
  if (base === 'image/jpeg' || base === 'image/jpg') return 'jpg'
  if (base === 'image/webp') return 'webp'
  if (base === 'image/gif') return 'gif'
  if (base === 'image/svg+xml') return 'svg'
  if (base === 'image/heic' || base === 'image/heif') return 'heic'
  if (base.startsWith('image/')) return 'img'
  return 'bin'
}

function suggestedFilename(name: string, mime: string | null): string {
  const safe = name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'image'
  if (safe.includes('.')) return safe
  return `${safe}.${extensionFromMime(mime)}`
}

async function bytesFromDataOrBlobUrl(
  url: string
): Promise<{ bytes: Uint8Array; mime: string | null }> {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  return {
    bytes: new Uint8Array(buffer),
    mime: res.headers.get('content-type'),
  }
}

type DownloadableImageProps = {
  src: string
  alt?: string
  /** Used to build a friendly download filename. */
  name?: string
  className?: string
  imgClassName?: string
  /** Compact control for tight layouts (relation cells). */
  compact?: boolean
}

type LoadedImage = {
  filename: string
  bytes: Uint8Array
  mime?: string
}

/**
 * Picture preview with download (and share when available).
 * Prefetches bytes so share/download stay inside the iOS user-gesture window.
 */
export function DownloadableImage({
  src,
  alt = '',
  name = 'image',
  className,
  imgClassName,
  compact = false,
}: DownloadableImageProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)
  const cachedRef = useRef<LoadedImage | null>(null)
  const loadPromiseRef = useRef<Promise<LoadedImage> | null>(null)

  const loadImage = useCallback(async (): Promise<LoadedImage> => {
    if (cachedRef.current) return cachedRef.current
    if (loadPromiseRef.current) return loadPromiseRef.current

    const pending = (async () => {
      const absolute = toAbsoluteUrl(src)
      let bytes: Uint8Array
      let mime: string | null
      if (/^(data:|blob:)/i.test(absolute)) {
        ;({ bytes, mime } = await bytesFromDataOrBlobUrl(absolute))
      } else {
        const result = await api.fetchBinary(absolute)
        bytes = result.bytes
        mime = result.contentType
      }
      const loaded: LoadedImage = {
        filename: suggestedFilename(name, mime),
        bytes,
        mime: mime ?? undefined,
      }
      cachedRef.current = loaded
      return loaded
    })()

    loadPromiseRef.current = pending
    try {
      return await pending
    } finally {
      if (loadPromiseRef.current === pending) loadPromiseRef.current = null
    }
  }, [name, src])

  // Prefetch so tap handlers don't await network (iOS drops user activation).
  useEffect(() => {
    cachedRef.current = null
    loadPromiseRef.current = null
    let cancelled = false
    void loadImage().catch(() => {
      if (!cancelled) cachedRef.current = null
    })
    return () => {
      cancelled = true
    }
  }, [loadImage])

  const handleDownload = useCallback(async () => {
    if (busy) return
    setBusy('download')
    try {
      // Prefer cache so mobile share-backed download keeps user activation.
      const file = cachedRef.current ?? (await loadImage())
      await downloadBytes(file)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('entity.failedToDownloadImage'))
    } finally {
      setBusy(null)
    }
  }, [busy, loadImage, t])

  const handleShare = useCallback(async () => {
    if (busy) return
    setBusy('share')
    try {
      // Prefer already-cached bytes so navigator.share keeps user activation.
      const file = cachedRef.current ?? (await loadImage())
      await shareBytes(file)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return
      alert(err instanceof Error ? err.message : t('entity.failedToShareImage'))
    } finally {
      setBusy(null)
    }
  }, [busy, loadImage, t])

  const shareAvailable = canShareFiles()

  const iconSize = compact ? 'iconXs' : 'icon'
  const iconClass = compact ? 'h-8 w-8' : 'h-9 w-9 sm:h-8 sm:w-8'
  const actionsDisabled = busy !== null

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('w-fit rounded-md border bg-muted/30 p-1', compact && 'p-0.5')}>
        <DeferredImage
          src={src}
          alt={alt}
          className={cn(
            'max-h-48 max-w-full rounded object-contain',
            compact && 'max-h-32',
            imgClassName
          )}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size={iconSize}
          className={iconClass}
          aria-label={t('entity.downloadImage')}
          title={t('entity.downloadImage')}
          onClick={(e) => {
            e.stopPropagation()
            void handleDownload()
          }}
          disabled={actionsDisabled}
        >
          {busy === 'download' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
        {shareAvailable ? (
          <Button
            type="button"
            variant="outline"
            size={iconSize}
            className={iconClass}
            aria-label={t('entity.shareImage')}
            title={t('entity.shareImage')}
            onClick={(e) => {
              e.stopPropagation()
              void handleShare()
            }}
            disabled={actionsDisabled}
          >
            {busy === 'share' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Share className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
