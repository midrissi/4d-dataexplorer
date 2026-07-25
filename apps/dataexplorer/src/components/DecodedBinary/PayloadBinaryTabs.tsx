import { ClickToCopy, cn, Tabs, TabsContent, TabsList, TabsTrigger } from '@4d/ui'
import { Eye, Hash, ScanSearch, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HexViewer } from '~/components/HexViewer'
import { PdfPreviewPanel } from '~/components/HttpClient/PdfPreviewPanel'
import { TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { useTranslation } from '~/i18n'
import {
  bytesToBlob,
  bytesToText,
  type DetectedFormat,
  isPreviewableFormat,
  resolvePreviewFormat,
} from '~/lib/detect-binary-format'
import { formatBytes } from '~/lib/utils'

const HEX_PREVIEW_COUNT = 16
/** Inline media / text preview is skipped above this size (aligned with BinaryObjectViewer). */
const MAX_MEDIA_PREVIEW_BYTES = 12 * 1024 * 1024
/** Soft cap for text View so huge attachments stay responsive. */
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (!clean) return new Uint8Array()
  try {
    const binary = atob(clean)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return new Uint8Array()
  }
}

function toHexPreview(bytes: Uint8Array, count = HEX_PREVIEW_COUNT): string {
  return Array.from(bytes.slice(0, count))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}

function toAsciiPreview(bytes: Uint8Array, count = HEX_PREVIEW_COUNT): string {
  return Array.from(bytes.slice(0, count))
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·'))
    .join('')
}

type PayloadTab = 'base64' | 'hex-preview' | 'full-hex' | 'view'

/**
 * Compact Hex / Full hex / Base64 (or View for known media / text) switcher for
 * nested decoded payloads (formula, blob data, mail attachments, opaque classes, …).
 */
export function PayloadBinaryTabs({
  label,
  base64,
  contentType,
  fileName,
  className,
}: {
  label: string
  base64: string
  /** Optional MIME hint (e.g. mail attachment Content-Type). */
  contentType?: string
  /** Optional filename for extension-based format detection (e.g. Agency.csv). */
  fileName?: string
  className?: string
}) {
  const { t } = useTranslation()
  const bytes = useMemo(() => decodeBase64ToBytes(base64), [base64])
  const format = useMemo((): DetectedFormat | null => {
    return resolvePreviewFormat({ bytes, contentType, fileName })
  }, [bytes, contentType, fileName])
  const canView = isPreviewableFormat(format)

  const [tab, setTab] = useState<PayloadTab>('hex-preview')
  const hex = useMemo(() => toHexPreview(bytes), [bytes])
  const ascii = useMemo(() => toAsciiPreview(bytes), [bytes])
  const base64Preview = base64.length > 96 ? `${base64.slice(0, 96)}…` : base64
  const previewTooLarge = bytes.length > MAX_MEDIA_PREVIEW_BYTES
  const textTooLarge = bytes.length > MAX_TEXT_PREVIEW_BYTES

  const textContent = useMemo(() => {
    if (format?.kind !== 'text' || textTooLarge) return ''
    return bytesToText(bytes)
  }, [bytes, format, textTooLarge])

  const activeTab: PayloadTab =
    tab === 'view' && !canView ? 'hex-preview' : tab === 'base64' && canView ? 'view' : tab

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!canView || !format || format.kind === 'pdf' || format.kind === 'text' || previewTooLarge) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(bytesToBlob(bytes, format.mime))
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = objectUrl
    setPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      if (previewUrlRef.current === objectUrl) previewUrlRef.current = null
    }
  }, [bytes, canView, format, previewTooLarge])

  return (
    <div className={cn('space-y-1.5 rounded-md border bg-background/60 px-2 py-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {bytes.length.toLocaleString()} B{format ? ` · ${format.label}` : ''}
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as PayloadTab)} className="gap-0">
        <TabsList className="h-6 w-fit justify-start gap-0.5 rounded border bg-muted/40 p-0.5">
          <TabsTrigger
            value="hex-preview"
            className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Hash className="h-2.5 w-2.5 shrink-0 opacity-70" />
            {t('entity.binaryTabHexPreview')}
          </TabsTrigger>
          <TabsTrigger
            value="full-hex"
            className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <ScanSearch className="h-2.5 w-2.5 shrink-0 opacity-70" />
            {t('entity.binaryTabFullHex')}
          </TabsTrigger>
          {canView ? (
            <TabsTrigger
              value="view"
              className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Eye className="h-2.5 w-2.5 shrink-0 opacity-70" />
              {t('entity.binaryTabView')}
            </TabsTrigger>
          ) : (
            <TabsTrigger
              value="base64"
              className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Type className="h-2.5 w-2.5 shrink-0 opacity-70" />
              {t('entity.binaryBase64')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="hex-preview"
          className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
        >
          <div className="flex items-center gap-2 overflow-hidden rounded border bg-muted/25 px-1.5 py-1 font-mono text-[10px] leading-none">
            <span className="w-8 shrink-0 text-muted-foreground">0000</span>
            <code className="min-w-0 flex-1 overflow-x-auto text-foreground/85">{hex || '—'}</code>
            <span className="shrink-0 border-border/50 border-l pl-1.5 text-emerald-700 dark:text-emerald-400">
              {ascii || '—'}
            </span>
            <ClickToCopy
              value={hex}
              tooltipLabel={t('hexViewer.copyHex')}
              tooltipCopiedLabel={t('common.copied')}
              className="inline-flex h-5 shrink-0 items-center rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {t('entity.binaryPathCopyShort')}
            </ClickToCopy>
          </div>
        </TabsContent>

        <TabsContent
          value="full-hex"
          className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
        >
          {bytes.length > 0 ? (
            <HexViewer bytes={bytes} className="h-48 shadow-none" />
          ) : (
            <p className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
              {t('entity.binaryOpaqueEmpty')}
            </p>
          )}
        </TabsContent>

        {canView && format ? (
          <TabsContent
            value="view"
            className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
          >
            {previewTooLarge || (format.kind === 'text' && textTooLarge) ? (
              <p className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
                {t('entity.binaryPreviewTooLarge', {
                  size: formatBytes(bytes.length),
                })}
              </p>
            ) : format.kind === 'text' ? (
              <TextPreviewPanel
                text={textContent}
                className="h-[min(60vh,32rem)] rounded-md"
                initialMode={
                  format.extension === 'csv' || format.extension === 'tsv'
                    ? 'csv'
                    : format.extension === 'json'
                      ? 'json'
                      : format.extension === 'html' || format.extension === 'htm'
                        ? 'html'
                        : format.extension === 'md' || format.extension === 'markdown'
                          ? 'markdown'
                          : undefined
                }
              />
            ) : format.kind === 'pdf' ? (
              <div className="overflow-hidden rounded border bg-muted/20">
                <PdfPreviewPanel
                  bytes={bytes}
                  title={format.label}
                  className="h-[min(70vh,40rem)] rounded-none border-0"
                />
              </div>
            ) : format.kind === 'image' && previewUrl ? (
              <div className="http-preview-checkerboard flex min-h-40 items-center justify-center overflow-hidden rounded border p-2">
                <img
                  src={previewUrl}
                  alt={format.label}
                  className="max-h-[min(70vh,36rem)] max-w-full rounded-sm object-contain shadow-sm"
                />
              </div>
            ) : format.kind === 'audio' && previewUrl ? (
              <div className="flex min-h-20 items-center justify-center rounded border bg-muted/20 p-2">
                {/* biome-ignore lint/a11y/useMediaCaption: binary audio has no captions track */}
                <audio src={previewUrl} controls preload="metadata" className="w-full" />
              </div>
            ) : format.kind === 'video' && previewUrl ? (
              <div className="flex min-h-40 items-center justify-center overflow-hidden rounded border bg-muted/30 p-2">
                {/* biome-ignore lint/a11y/useMediaCaption: binary video has no captions track */}
                <video
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="max-h-[min(70vh,36rem)] max-w-full rounded"
                />
              </div>
            ) : (
              <p className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
                {t('entity.binaryPreviewUnavailable')}
              </p>
            )}
          </TabsContent>
        ) : (
          <TabsContent
            value="base64"
            className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
          >
            <div className="flex items-start gap-2 rounded border bg-muted/25 px-1.5 py-1">
              <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] text-foreground/85">
                {base64Preview || '—'}
              </code>
              <ClickToCopy
                value={base64}
                tooltipLabel={t('entity.binaryCopyBase64')}
                tooltipCopiedLabel={t('common.copied')}
                className="inline-flex h-5 shrink-0 items-center rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {t('entity.binaryPathCopyShort')}
              </ClickToCopy>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
