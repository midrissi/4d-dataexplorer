import { Button, cn } from '@4d/ui'
import { Eye, EyeOff, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { DownloadableImage } from '~/components/DownloadableImage'
import { useTranslation } from '~/i18n'
import type { NetworkDetails } from '~/store/console'

/** Matches placeholders from `logging-fetch` for skipped binary bodies. */
const BINARY_BODY_PLACEHOLDER = /^\[(.+?) body\]$/i

function headerContentType(headers?: Record<string, string>): string | undefined {
  if (!headers) return undefined
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') return value
  }
  return undefined
}

/**
 * Returns an image MIME type when this network entry’s response was logged as a
 * skipped image body (bytes were never buffered — preview must re-fetch).
 */
export function imageMimeFromNetworkDetails(details: NetworkDetails): string | null {
  const fromHeader = headerContentType(details.responseHeaders)
  if (fromHeader) {
    const base = fromHeader.split(';')[0]?.trim().toLowerCase() ?? ''
    if (base.startsWith('image/') && base !== 'image/svg+xml') return base
  }

  if (typeof details.responseBody === 'string') {
    const match = BINARY_BODY_PLACEHOLDER.exec(details.responseBody.trim())
    const mime = match?.[1]?.trim().toLowerCase()
    if (mime?.startsWith('image/') && mime !== 'image/svg+xml') return mime
  }

  return null
}

function canPreviewImageResponse(details: NetworkDetails): boolean {
  if (details.method.toUpperCase() !== 'GET') return false
  if (!details.url) return false
  return imageMimeFromNetworkDetails(details) !== null
}

/**
 * On-demand preview for console network entries whose response body was only
 * recorded as `[image/… body]` (binary bodies are not cloned while logging).
 */
export function ConsoleNetworkImageBody({
  details,
  className,
}: {
  details: NetworkDetails
  className?: string
}) {
  const { t } = useTranslation()
  const [showPreview, setShowPreview] = useState(false)

  if (!canPreviewImageResponse(details)) return null

  return (
    <div className={cn('ml-4 space-y-1.5 py-0.5', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 gap-1.5 px-2 text-[10px] text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation()
          setShowPreview((current) => !current)
        }}
        aria-expanded={showPreview}
      >
        {showPreview ? (
          <EyeOff className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <Eye className="h-3 w-3 shrink-0" aria-hidden />
        )}
        {showPreview ? t('console.hideImage') : t('console.loadImage')}
      </Button>

      {showPreview ? (
        <div className="max-w-md space-y-1">
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <ImageIcon className="h-3 w-3 shrink-0" aria-hidden />
            <span>{t('console.imagePreviewHint')}</span>
          </p>
          <DownloadableImage
            src={details.url}
            alt={t('console.imagePreviewAlt')}
            name="response"
            compact
          />
        </div>
      ) : null}
    </div>
  )
}
