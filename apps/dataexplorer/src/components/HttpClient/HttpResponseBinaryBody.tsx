import { Button, cn } from '@4d/ui'
import {
  Binary,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileWarning,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { HexViewer } from '~/components/HexViewer'
import { HttpPreviewStage } from '~/components/HttpClient/HttpPreviewStage'
import { PdfPreviewPanel } from '~/components/HttpClient/PdfPreviewPanel'
import { TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { useTranslation } from '~/i18n'
import { downloadBytes } from '~/lib/download-bytes'
import { formatByteSize, streamDownloadFromUrl } from '~/lib/http-client'
import { formatBytes } from '~/lib/utils'
import type { HttpClientResponse } from '~/store/http-client-types'

type DetectedFormat = {
  label: string
  mime: string
  extension: string
  kind: 'image' | 'pdf' | 'audio' | 'video' | 'other'
}

type FallbackView = 'none' | 'text' | 'binary'

/** In-app media preview (image/pdf/audio/video) is skipped above this size. */
export const MAX_BINARY_MEDIA_PREVIEW_BYTES = 5 * 1024 * 1024 // 5 MiB

/** Text / hex fallback previews are skipped above this size. */
export const MAX_BINARY_FALLBACK_PREVIEW_BYTES = 2 * 1024 * 1024 // 2 MiB

function maxMediaPreviewBytes(kind: DetectedFormat['kind']): number {
  switch (kind) {
    case 'video':
      return 3 * 1024 * 1024 // 3 MiB — video decode is especially costly in desktop webviews
    case 'audio':
      return 5 * 1024 * 1024
    case 'pdf':
      return 8 * 1024 * 1024
    case 'image':
      return 12 * 1024 * 1024
    default:
      return MAX_BINARY_MEDIA_PREVIEW_BYTES
  }
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false
  }
  return true
}

function detectFormatFromBytes(bytes: Uint8Array): DetectedFormat | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return { label: 'PNG', mime: 'image/png', extension: 'png', kind: 'image' }
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { label: 'JPEG', mime: 'image/jpeg', extension: 'jpg', kind: 'image' }
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return { label: 'GIF', mime: 'image/gif', extension: 'gif', kind: 'image' }
  }
  if (startsWith(bytes, [0x42, 0x4d])) {
    return { label: 'BMP', mime: 'image/bmp', extension: 'bmp', kind: 'image' }
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { label: 'WebP', mime: 'image/webp', extension: 'webp', kind: 'image' }
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return { label: 'PDF', mime: 'application/pdf', extension: 'pdf', kind: 'pdf' }
  }
  if (startsWith(bytes, [0x1f, 0x8b])) {
    return { label: 'GZIP', mime: 'application/gzip', extension: 'gz', kind: 'other' }
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    return { label: 'ZIP', mime: 'application/zip', extension: 'zip', kind: 'other' }
  }
  if (startsWith(bytes, [0x49, 0x44, 0x33]) || startsWith(bytes, [0xff, 0xfb])) {
    return { label: 'MP3', mime: 'audio/mpeg', extension: 'mp3', kind: 'audio' }
  }
  // ISO BMFF (MP4 / M4V / MOV): ....ftyp
  if (bytes.length >= 8 && startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    return { label: 'MP4', mime: 'video/mp4', extension: 'mp4', kind: 'video' }
  }
  return null
}

function detectFormatFromContentType(contentType: string | null): DetectedFormat | null {
  if (!contentType) return null
  const ct = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (ct.startsWith('image/')) {
    const extension = ct.slice('image/'.length).replace('jpeg', 'jpg').split('+')[0] || 'img'
    return { label: ct, mime: ct, extension, kind: 'image' }
  }
  if (ct === 'application/pdf') {
    return { label: 'PDF', mime: ct, extension: 'pdf', kind: 'pdf' }
  }
  if (ct.startsWith('audio/')) {
    const extension = ct.slice('audio/'.length).split('+')[0] || 'audio'
    return { label: ct, mime: ct, extension, kind: 'audio' }
  }
  if (ct.startsWith('video/')) {
    const extension = ct.slice('video/'.length).split('+')[0] || 'video'
    return { label: ct, mime: ct, extension, kind: 'video' }
  }
  return null
}

function toHexPreview(bytes: Uint8Array, count = 32): string {
  return Array.from(bytes.slice(0, count))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}

function decodeAsText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function filenameFromUrl(url: string, extension: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'response'
    const safe = last.replace(/[^\w.-]+/g, '_') || 'response'
    if (safe.includes('.')) return safe
    return `${safe}.${extension}`
  } catch {
    return `response.${extension}`
  }
}

function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  // Slice so we don't accidentally share a larger underlying ArrayBuffer.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new Blob([ab as ArrayBuffer], { type: mime })
}

export function HttpResponseBinaryBody({
  response,
  className,
}: {
  response: HttpClientResponse
  className?: string
}) {
  const { t } = useTranslation()
  const bytes = response.bodyBytes
  const [expanded, setExpanded] = useState(false)
  const [fallbackView, setFallbackView] = useState<FallbackView>('none')
  /** Video/audio require an explicit click — auto-loading blob media freezes desktop webviews. */
  const [mediaPreviewArmed, setMediaPreviewArmed] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const responseKey = `${response.url}:${response.sizeBytes}:${response.durationMs}:${response.status}`
  const [seenResponseKey, setSeenResponseKey] = useState(responseKey)
  if (responseKey !== seenResponseKey) {
    setSeenResponseKey(responseKey)
    setFallbackView('none')
    setExpanded(false)
    setMediaPreviewArmed(false)
  }

  const format = useMemo(() => {
    if (!bytes || bytes.length === 0) {
      return detectFormatFromContentType(response.contentType)
    }
    return (
      detectFormatFromBytes(bytes.subarray(0, 32)) ??
      detectFormatFromContentType(response.contentType)
    )
  }, [bytes, response.contentType])

  const hexPreview = useMemo(() => (bytes ? toHexPreview(bytes) : ''), [bytes])
  const mime =
    format?.mime ?? response.contentType?.split(';')[0]?.trim() ?? 'application/octet-stream'
  const extension = format?.extension ?? 'bin'
  const kind = format?.kind ?? 'other'
  const isMediaKind = kind === 'image' || kind === 'pdf' || kind === 'audio' || kind === 'video'
  const needsArmToPreview = kind === 'video' || kind === 'audio'
  const size = bytes?.length ?? 0
  const tooLargeForMedia = isMediaKind && size > maxMediaPreviewBytes(kind)
  const tooLargeForFallback = size > MAX_BINARY_FALLBACK_PREVIEW_BYTES
  const canPreviewMedia =
    isMediaKind && !tooLargeForMedia && (!needsArmToPreview || mediaPreviewArmed)
  const downloadOnly = tooLargeForMedia || (tooLargeForFallback && !isMediaKind)
  const showMediaGate =
    isMediaKind &&
    !tooLargeForMedia &&
    needsArmToPreview &&
    !mediaPreviewArmed &&
    fallbackView === 'none'

  // Decode text only when the user opens the text fallback (never for video/audio blobs).
  const textPreview = useMemo(() => {
    if (fallbackView !== 'text' || !bytes || tooLargeForFallback) return ''
    return decodeAsText(bytes)
  }, [bytes, fallbackView, tooLargeForFallback])

  useEffect(() => {
    // PDF uses PDF.js canvases from raw bytes — no object URL needed.
    if (!bytes || !canPreviewMedia || kind === 'pdf') {
      setObjectUrl(null)
      return
    }
    const blob = bytesToBlob(bytes, mime)
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      if (objectUrlRef.current === url) objectUrlRef.current = null
      setObjectUrl(null)
    }
  }, [bytes, canPreviewMedia, kind, mime])

  const handleDownload = async () => {
    const name = filenameFromUrl(response.url, extension)
    if (bytes && bytes.length > 0) {
      await downloadBytes({
        filename: name,
        bytes,
        mime,
      })
      return
    }
    // Body was skipped (video/audio / too large) — re-fetch as a download stream.
    await streamDownloadFromUrl({
      url: response.url,
      filename: name,
      mime,
    })
  }

  if (!bytes || bytes.length === 0) {
    const skipped = Boolean(response.bodySkipped || response.bodyBinary)
    return (
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
        <EmptyPanel
          icon={skipped ? EyeOff : FileWarning}
          badgeIcon={Binary}
          badgeTone="muted"
          title={skipped ? t('httpClient.binaryNotBufferedTitle') : t('httpClient.binaryEmpty')}
          description={
            skipped
              ? t('httpClient.binaryNotBuffered')
              : (response.bodyPreview ?? t('httpClient.binaryEmpty'))
          }
          ghost="cards"
          bordered
          size="sm"
          className="min-h-0 flex-1"
          chips={[
            {
              label: format?.label ?? t('entity.binaryUnknownFormat'),
              tone: 'default',
            },
            {
              label: formatByteSize(response.sizeBytes || 0),
              tone: 'default',
            },
          ]}
          action={
            skipped ? (
              <EmptyPanelAction icon={Download} onClick={() => void handleDownload()}>
                {t('entity.binaryDownload')}
              </EmptyPanelAction>
            ) : undefined
          }
        />
      </div>
    )
  }

  const formatLabel = format?.label ?? t('entity.binaryUnknownFormat')
  const sizeMeta = `${formatBytes(bytes.length)}${response.contentType ? ` · ${response.contentType}` : ''}`
  const showInlineMediaPreview = canPreviewMedia && (kind === 'pdf' || Boolean(objectUrl))

  const binaryChromeActions = (
    <>
      {!canPreviewMedia && !downloadOnly && fallbackView !== 'none' ? (
        <div className="flex items-center rounded-md border p-0.5">
          {(
            [
              ['text', t('httpClient.binaryAsText')],
              ['binary', t('httpClient.binaryAsBinary')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'cursor-pointer rounded px-2 py-0.5 text-[11px] transition-colors',
                fallbackView === id
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setFallbackView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => void handleDownload()}
        aria-label={t('entity.binaryDownload')}
        title={t('entity.binaryDownload')}
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? t('entity.binaryHideDetails') : t('entity.binaryShowDetails')}
        title={expanded ? t('entity.binaryHideDetails') : t('entity.binaryShowDetails')}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
    </>
  )

  const binaryDetails = expanded ? (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">{t('entity.binarySize')}</dt>
          <dd className="font-mono">{formatByteSize(bytes.length)}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">{t('entity.binaryFormat')}</dt>
          <dd className="font-mono">{formatLabel}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">{t('httpClient.contentType')}</dt>
          <dd className="truncate font-mono">{response.contentType ?? '—'}</dd>
        </div>
      </dl>
      {hexPreview ? (
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">{t('entity.binaryHexPreview')}</span>
          <code className="block overflow-x-auto rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-[11px] text-foreground/80">
            {hexPreview}
          </code>
        </div>
      ) : null}
    </div>
  ) : null

  if (showInlineMediaPreview) {
    const stageKind =
      kind === 'pdf' ? 'pdf' : kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'audio'

    return (
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
        <HttpPreviewStage
          kind={stageKind}
          url={response.url}
          title={t('httpClient.binaryBody')}
          meta={sizeMeta}
          badge={formatLabel}
          actions={binaryChromeActions}
          details={binaryDetails}
          className="min-h-0 flex-1"
        >
          {kind === 'pdf' ? (
            <PdfPreviewPanel
              bytes={bytes}
              title={t('httpClient.binaryPreviewAlt')}
              className="h-full min-h-0 rounded-none border-0"
            />
          ) : (
            <div className="flex h-full min-h-0 w-full items-center justify-center overflow-auto p-4">
              {kind === 'image' && objectUrl ? (
                <img
                  src={objectUrl}
                  alt={t('httpClient.binaryPreviewAlt')}
                  className="max-h-full max-w-full object-contain drop-shadow-md"
                />
              ) : null}
              {kind === 'audio' && objectUrl ? (
                // biome-ignore lint/a11y/useMediaCaption: response audio has no captions track
                <audio src={objectUrl} controls preload="metadata" className="w-full max-w-xl" />
              ) : null}
              {kind === 'video' && objectUrl ? (
                // biome-ignore lint/a11y/useMediaCaption: response video has no captions track
                <video
                  src={objectUrl}
                  controls
                  preload="metadata"
                  className="max-h-full max-w-full rounded-md"
                />
              ) : null}
            </div>
          )}
        </HttpPreviewStage>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-3 overflow-hidden', className)}>
      <div className="shrink-0 overflow-hidden rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2.5 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Binary className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{t('httpClient.binaryBody')}</span>
              <span className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                {formatLabel}
              </span>
            </div>
            <span className="text-muted-foreground text-xs">{sizeMeta}</span>
          </div>
          {binaryChromeActions}
        </div>
        {binaryDetails ? (
          <div className="border-t bg-background/60 p-3">{binaryDetails}</div>
        ) : null}
      </div>

      {showMediaGate || downloadOnly || fallbackView === 'none' ? (
        <EmptyPanel
          icon={EyeOff}
          badgeIcon={Binary}
          badgeTone="muted"
          title={
            downloadOnly
              ? t('httpClient.binaryTooLargeTitle')
              : showMediaGate
                ? t('httpClient.binaryMediaPreviewTitle')
                : t('httpClient.binaryNoPreviewTitle')
          }
          description={
            downloadOnly
              ? t('httpClient.binaryTooLarge', { size: formatByteSize(bytes.length) })
              : showMediaGate
                ? t('httpClient.binaryMediaPreview')
                : t('httpClient.binaryNoPreview')
          }
          ghost="cards"
          bordered
          size="sm"
          className="min-h-0 flex-1"
          chips={[
            {
              label: formatLabel,
              tone: 'default',
            },
            {
              label: formatByteSize(bytes.length),
              tone: 'default',
            },
          ]}
          action={
            <>
              <EmptyPanelAction icon={Download} onClick={() => void handleDownload()}>
                {t('entity.binaryDownload')}
              </EmptyPanelAction>
              {showMediaGate ? (
                <EmptyPanelAction icon={Eye} onClick={() => setMediaPreviewArmed(true)}>
                  {t('httpClient.previewMedia')}
                </EmptyPanelAction>
              ) : null}
              {!downloadOnly && !showMediaGate ? (
                <>
                  <EmptyPanelAction icon={FileText} onClick={() => setFallbackView('text')}>
                    {t('httpClient.previewAsText')}
                  </EmptyPanelAction>
                  <EmptyPanelAction icon={Binary} onClick={() => setFallbackView('binary')}>
                    {t('httpClient.previewAsBinary')}
                  </EmptyPanelAction>
                </>
              ) : null}
            </>
          }
        />
      ) : fallbackView === 'text' ? (
        <TextPreviewPanel text={textPreview} baseUrl={response.url} className="min-h-0 flex-1" />
      ) : (
        <HexViewer bytes={bytes} className="min-h-0 flex-1" />
      )}
    </div>
  )
}
