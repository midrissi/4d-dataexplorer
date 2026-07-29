import { Button, ClickToCopy, cn, Tabs, TabsContent, TabsList, TabsTrigger } from '@4d/ui'
import {
  Binary,
  Boxes,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileWarning,
  Hash,
  Loader2,
  RefreshCw,
  ScanSearch,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DecodedBinaryContent,
  decodedRootLabel,
  useDecodedBinaryObject,
} from '~/components/DecodedBinary'
import { HexViewer } from '~/components/HexViewer'
import { PdfPreviewPanel } from '~/components/HttpClient/PdfPreviewPanel'
import { TextPreviewPanel } from '~/components/HttpClient/TextPreviewPanel'
import { useTranslation } from '~/i18n'
import { api } from '~/lib/api'
import {
  bytesToBlob,
  bytesToText,
  type DetectedFormat,
  isPreviewableFormat,
  resolvePreviewFormat,
} from '~/lib/detect-binary-format'
import { downloadBytes } from '~/lib/download-bytes'
import { isMobileShell } from '~/lib/platform'
import { formatBytes } from '~/lib/utils'

/** The reserved key 4D uses to serialise a binary/blob value inside an object. */
export const PRIVATE_BINARY_OBJECT_KEY = '__PRIVATE_BINARY_OBJECT'

const HEX_PREVIEW_COUNT = 16
/** Full hex dump is skipped above this size (same ballpark as HTTP Client). */
const MAX_FULL_HEX_BYTES = 2 * 1024 * 1024
/** Inline media preview is skipped above this size. */
const MAX_MEDIA_PREVIEW_BYTES = 12 * 1024 * 1024

/**
 * Detect whether a value is a 4D private binary object, i.e. an object whose
 * single property is {@link PRIVATE_BINARY_OBJECT_KEY} holding a base64 string.
 */
export function isPrivateBinaryObject(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return (
    keys.length === 1 &&
    keys[0] === PRIVATE_BINARY_OBJECT_KEY &&
    typeof (value as Record<string, unknown>)[PRIVATE_BINARY_OBJECT_KEY] === 'string'
  )
}

/** Exact byte length of a base64 payload without decoding the whole string. */
function base64ByteSize(b64: string): number {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (clean.length === 0) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding)
}

/** Decode only the leading bytes of a base64 string (for signature sniffing). */
function decodeBase64Prefix(b64: string, maxBytes = 32): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const charCount = Math.min(clean.length, Math.ceil((maxBytes * 4) / 3))
  const sliceLen = charCount - (charCount % 4)
  if (sliceLen <= 0) return new Uint8Array()
  try {
    const binary = atob(clean.slice(0, sliceLen))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return new Uint8Array()
  }
}

/** Decode an entire base64 payload into bytes (used on explicit download). */
function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Best-effort file-type detection from magic bytes, filename, and text sniffing. */
function detectFormat(bytes: Uint8Array, fileName?: string): DetectedFormat | null {
  return resolvePreviewFormat({ bytes, fileName })
}

function isPreviewable(format: DetectedFormat | null | undefined): boolean {
  return isPreviewableFormat(format)
}

/** First N bytes rendered as a `00 11 22` hex string. */
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

type BinaryTab = 'decoded' | 'hex-preview' | 'full-hex' | 'preview'

interface BinaryObjectViewerProps {
  /** The raw base64 payload stored under {@link PRIVATE_BINARY_OBJECT_KEY}. */
  base64?: string
  /**
   * A deferred REST URI (or absolute URL) for a BLOB attribute served as a
   * downloadable binary. When provided (and `base64` is not), the viewer loads
   * the bytes on demand rather than decoding an inline base64 payload.
   */
  url?: string
  /** Optional field name used to build a friendly download filename. */
  name?: string
  /** Start expanded (useful in result panels). Defaults to collapsed. */
  defaultExpanded?: boolean
  className?: string
}

/**
 * Compact, expandable viewer for 4D binary values. Works with either an inline
 * base64 payload (private binary objects) or a deferred BLOB URL, surfacing the
 * size, a best-effort detected format, hex preview / full hex editor, and a
 * media preview when the format is known.
 */
export function BinaryObjectViewer({
  base64,
  url,
  name,
  defaultExpanded = false,
  className,
}: BinaryObjectViewerProps) {
  const { t } = useTranslation()
  // Hex dumps and decoded-object trees are dev/debug tooling that doesn't
  // translate well to touch screens — mobile keeps only the format-aware
  // media preview and the download action.
  const mobile = isMobileShell()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [activeTab, setActiveTab] = useState<BinaryTab>('hex-preview')

  // URL mode loads bytes lazily; base64 mode has them inline from the start.
  const isUrlMode = base64 == null && url != null
  const [fetchedBytes, setFetchedBytes] = useState<Uint8Array | null>(null)
  const [decodedBase64Bytes, setDecodedBase64Bytes] = useState<Uint8Array | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    isUrlMode ? 'idle' : 'loaded'
  )
  const [isReloading, setIsReloading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDecoding, setIsDecoding] = useState(false)

  // Revoke any object URL created for an inline media preview on unmount.
  const previewUrlRef = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  // Unconditionally (re)fetch the BLOB bytes from `url`. Used both for the
  // initial lazy load and to reload after the URL changes (entity switch).
  const fetchBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (!url) return null
    const preserveContent = fetchedBytes != null
    setIsReloading(preserveContent)
    if (!preserveContent) setLoadState('loading')
    setLoadError(null)
    try {
      const { bytes } = await api.fetchBinary(url)
      setFetchedBytes(bytes)
      setLoadState('loaded')
      setIsReloading(false)
      return bytes
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('entity.binaryLoadError'))
      setLoadState('error')
      setIsReloading(false)
      return null
    }
  }, [url, t, fetchedBytes])

  // Fetch the BLOB bytes once (URL mode). Returns the bytes so callers can chain
  // an action (download/preview) immediately after the initial load.
  const ensureBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (fetchedBytes) return fetchedBytes
    return fetchBytes()
  }, [fetchedBytes, fetchBytes])

  /** Full payload bytes when available (URL fetch or decoded base64). */
  const fullBytes = isUrlMode ? fetchedBytes : decodedBase64Bytes

  const ensureFullBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (isUrlMode) return ensureBytes()
    if (decodedBase64Bytes) return decodedBase64Bytes
    if (!base64) return null
    setIsDecoding(true)
    try {
      // Yield so the decoding spinner can paint before a large atob.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const bytes = decodeBase64(base64)
      setDecodedBase64Bytes(bytes)
      return bytes
    } catch {
      return null
    } finally {
      setIsDecoding(false)
    }
  }, [isUrlMode, ensureBytes, decodedBase64Bytes, base64])

  // The BLOB URL changes when the user selects a different entity. Any bytes we
  // already hold belong to the previous entity and must be discarded. Preserve
  // the expanded/collapsed UI state and the active tab: if expanded, reload the
  // new entity's bytes immediately; if collapsed, reset to the "not loaded"
  // state so the header no longer shows the previous entity's size/format.
  const prevUrlRef = useRef(url)
  useEffect(() => {
    if (!isUrlMode) return
    if (prevUrlRef.current === url) return
    prevUrlRef.current = url
    setLoadError(null)
    if (expanded) {
      void fetchBytes()
    } else {
      setFetchedBytes(null)
      setPreviewUrl(null)
      setIsReloading(false)
      setLoadState('idle')
    }
  }, [url, isUrlMode, expanded, fetchBytes])

  // Reset decoded base64 when the inline payload changes.
  const prevBase64Ref = useRef(base64)
  useEffect(() => {
    if (isUrlMode) return
    if (prevBase64Ref.current === base64) return
    prevBase64Ref.current = base64
    setDecodedBase64Bytes(null)
    setPreviewUrl(null)
  }, [base64, isUrlMode])

  const meta = useMemo(() => {
    if (isUrlMode) {
      if (!fetchedBytes) return null
      const sample = fetchedBytes.subarray(0, Math.min(4096, fetchedBytes.length))
      return {
        byteSize: fetchedBytes.length,
        base64Length: 0,
        format: detectFormat(sample, name),
        hex: toHexPreview(fetchedBytes),
        ascii: toAsciiPreview(fetchedBytes),
        prefix: fetchedBytes.subarray(0, HEX_PREVIEW_COUNT),
      }
    }
    const prefix = decodeBase64Prefix(base64 ?? '', 4096)
    return {
      byteSize: base64ByteSize(base64 ?? ''),
      base64Length: (base64 ?? '').replace(/\s/g, '').length,
      format: detectFormat(prefix, name),
      hex: toHexPreview(prefix),
      ascii: toAsciiPreview(prefix),
      prefix: prefix.subarray(0, Math.min(HEX_PREVIEW_COUNT, prefix.length)),
    }
  }, [isUrlMode, fetchedBytes, base64, name])

  const decodedValue = useDecodedBinaryObject(base64, isUrlMode ? fetchedBytes : null)
  const decodedName =
    decodedRootLabel(decodedValue) ??
    (decodedValue
      ? Array.isArray(decodedValue)
        ? t('entity.binaryDecodedArray')
        : t('entity.binaryDecodedTree')
      : null)
  const formatLabel = decodedName ?? meta?.format?.label ?? t('entity.binaryUnknownFormat')
  const typeLabel = isUrlMode ? t('entity.binaryBlob') : t('entity.binaryObject')
  const isFetching = loadState === 'loading' || isReloading
  const canPreview = isPreviewable(meta?.format)
  const hasDecoded = decodedValue != null
  // Mobile only ever shows the preview tab, so prefer it over the (hidden)
  // decoded/hex tabs to make sure full bytes get fetched for the preview.
  const defaultTab: BinaryTab = mobile
    ? canPreview
      ? 'preview'
      : 'hex-preview'
    : hasDecoded
      ? 'decoded'
      : canPreview
        ? 'preview'
        : 'hex-preview'

  // Prefer hex preview (or media preview) once format is known on first expand only.
  const didAutoSelectPreview = useRef(false)
  useEffect(() => {
    if (!expanded || !meta || didAutoSelectPreview.current) return
    // Wait for URL-mode decode attempt until bytes are present.
    if (isUrlMode && !fetchedBytes) return
    didAutoSelectPreview.current = true
    setActiveTab(defaultTab)
  }, [expanded, meta, defaultTab, isUrlMode, fetchedBytes])

  // If the kept tab is unavailable for the new payload, fall back to hex.
  useEffect(() => {
    if (activeTab === 'decoded' && !hasDecoded) {
      setActiveTab('hex-preview')
      return
    }
    if (activeTab === 'preview' && !canPreview) {
      setActiveTab('hex-preview')
    }
  }, [activeTab, hasDecoded, canPreview])

  const saveBytes = useCallback(
    async (bytes: Uint8Array, format: DetectedFormat | null) => {
      const mime = format?.mime ?? 'application/octet-stream'
      const extension = format?.extension ?? 'bin'
      const filename = `${name?.replace(/[^\w.-]+/g, '_') || 'binary-object'}.${extension}`
      await downloadBytes({ filename, bytes, mime })
    },
    [name]
  )

  const handleDownload = useCallback(async () => {
    if (isUrlMode) {
      const bytes = await ensureBytes()
      if (bytes) await saveBytes(bytes, detectFormat(bytes, name))
      return
    }
    try {
      const bytes = decodeBase64(base64 ?? '')
      await saveBytes(bytes, detectFormat(bytes, name))
    } catch {
      // Malformed base64 — nothing to download.
    }
  }, [isUrlMode, ensureBytes, saveBytes, base64, name])

  // Toggle details. In URL mode, expanding triggers the initial byte load so the
  // size/format/hex (and media preview) become available.
  const handleToggleExpand = useCallback(async () => {
    const next = !expanded
    setExpanded(next)
    if (next && isUrlMode && !fetchedBytes) {
      await ensureBytes()
    }
  }, [expanded, isUrlMode, fetchedBytes, ensureBytes])

  // Decode / fetch full bytes when the user opens a tab that needs them.
  useEffect(() => {
    if (!expanded) return
    if (activeTab !== 'full-hex' && activeTab !== 'preview') return
    void ensureFullBytes()
  }, [expanded, activeTab, ensureFullBytes])

  // Build an object URL for image / audio / video previews once full bytes exist.
  useEffect(() => {
    const format = meta?.format
    if (
      !fullBytes ||
      !format ||
      format.kind === 'other' ||
      format.kind === 'pdf' ||
      format.kind === 'text'
    ) {
      return
    }
    if (fullBytes.length > MAX_MEDIA_PREVIEW_BYTES) return

    const blob = bytesToBlob(fullBytes, format.mime)
    const objectUrl = URL.createObjectURL(blob)
    previewUrlRef.current = objectUrl
    setPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      previewUrlRef.current = null
      setPreviewUrl(null)
    }
  }, [fullBytes, meta?.format])

  const hexTooLarge = (meta?.byteSize ?? 0) > MAX_FULL_HEX_BYTES
  const previewTooLarge = (meta?.byteSize ?? 0) > MAX_MEDIA_PREVIEW_BYTES

  const previewContent =
    meta &&
    (isDecoding || (isUrlMode && loadState === 'loading' && !fullBytes) ? (
      <div className="flex h-28 items-center justify-center gap-1.5 rounded border bg-muted/20 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('entity.binaryLoading')}
      </div>
    ) : previewTooLarge ? (
      <BinaryGate
        title={t('entity.binaryPreviewTooLargeTitle')}
        description={t('entity.binaryPreviewTooLarge', {
          size: formatBytes(meta.byteSize),
        })}
        onDownload={handleDownload}
        downloadLabel={t('entity.binaryDownload')}
      />
    ) : meta.format?.kind === 'text' && fullBytes ? (
      <TextPreviewPanel
        text={bytesToText(fullBytes)}
        className="h-[min(60vh,32rem)] rounded-md"
        initialMode={
          meta.format.extension === 'csv' || meta.format.extension === 'tsv'
            ? 'csv'
            : meta.format.extension === 'json'
              ? 'json'
              : meta.format.extension === 'html' || meta.format.extension === 'htm'
                ? 'html'
                : meta.format.extension === 'md' || meta.format.extension === 'markdown'
                  ? 'markdown'
                  : undefined
        }
      />
    ) : meta.format?.kind === 'pdf' && fullBytes ? (
      <div className="overflow-hidden rounded border bg-muted/20">
        <PdfPreviewPanel
          bytes={fullBytes}
          title={name ?? typeLabel}
          className="h-[min(70vh,40rem)] rounded-none border-0"
        />
      </div>
    ) : meta.format?.kind === 'image' && previewUrl ? (
      <div className="http-preview-checkerboard flex min-h-40 items-center justify-center overflow-hidden rounded border p-2">
        <img
          src={previewUrl}
          alt={name ?? typeLabel}
          className="max-h-[min(70vh,36rem)] max-w-full rounded-sm object-contain shadow-sm"
        />
      </div>
    ) : meta.format?.kind === 'audio' && previewUrl ? (
      <div className="flex min-h-20 items-center justify-center rounded border bg-muted/20 p-2">
        {/* biome-ignore lint/a11y/useMediaCaption: binary audio has no captions track */}
        <audio src={previewUrl} controls preload="metadata" className="w-full" />
      </div>
    ) : meta.format?.kind === 'video' && previewUrl ? (
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
      <BinaryGate
        title={t('entity.binaryPreviewUnavailableTitle')}
        description={t('entity.binaryPreviewUnavailable')}
        onDownload={handleDownload}
        downloadLabel={t('entity.binaryDownload')}
      />
    ))

  return (
    <div className={cn('overflow-hidden rounded-md border bg-muted/15 text-[11px]', className)}>
      {/* Dense header: identity + size chips + actions */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none hover:opacity-90 focus-visible:ring-1 focus-visible:ring-ring"
          onClick={handleToggleExpand}
          aria-expanded={expanded}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border bg-background text-muted-foreground">
            <Binary className="h-3 w-3" />
          </span>
          <span className="truncate font-medium text-foreground">{typeLabel}</span>
          <span className="shrink-0 rounded border bg-background px-1 py-px font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
            {formatLabel}
          </span>
          {meta ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                {formatBytes(meta.byteSize)}
              </span>
              {!isUrlMode && meta.base64Length > 0 ? (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="hidden shrink-0 font-mono text-muted-foreground tabular-nums sm:inline">
                    b64 {meta.base64Length.toLocaleString()}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">{t('entity.binaryNotLoaded')}</span>
          )}
          {isReloading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" /> : null}
          <span className="ml-auto shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {!isUrlMode && (
          <ClickToCopy
            value={base64 ?? ''}
            tooltipLabel={t('entity.binaryCopyBase64')}
            tooltipCopiedLabel={t('common.copied')}
            className="inline-flex h-5 shrink-0 items-center rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {t('entity.binaryBase64')}
          </ClickToCopy>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={handleDownload}
          disabled={loadState === 'loading'}
          aria-label={t('entity.binaryDownload')}
          title={t('entity.binaryDownload')}
        >
          {loadState === 'loading' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
        </Button>

        {isUrlMode && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => void fetchBytes()}
            disabled={isFetching}
            aria-label={t('entity.binaryReload')}
            title={t('entity.binaryReload')}
          >
            <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-1.5 border-t px-2 pt-1.5 pb-2">
          {loadState === 'loading' && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('entity.binaryLoading')}
            </div>
          )}

          {loadState === 'error' && (
            <div className="flex items-center justify-between gap-2 text-destructive">
              <span className="truncate">{loadError ?? t('entity.binaryLoadError')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => {
                  void ensureBytes()
                }}
              >
                {t('entity.binaryRetry')}
              </Button>
            </div>
          )}

          {meta && mobile ? (
            // Mobile: prefer the decoded 4D object view when available (most
            // private binaries), then format-aware media preview, else download.
            hasDecoded && decodedValue ? (
              <div className="mt-0.5 min-h-0 overflow-auto">
                <DecodedBinaryContent value={decodedValue} className="max-h-[min(60vh,28rem)]" />
              </div>
            ) : canPreview ? (
              <div className="mt-0.5">{previewContent}</div>
            ) : (
              <div className="mt-0.5 space-y-2">
                <div className="flex items-center gap-2 overflow-hidden rounded border bg-muted/25 px-2 py-1.5 font-mono text-[11px] leading-none">
                  <span className="w-8 shrink-0 text-muted-foreground">0000</span>
                  <code className="min-w-0 flex-1 overflow-x-auto text-foreground/85">
                    {meta.hex}
                  </code>
                  <span className="shrink-0 border-border/50 border-l pl-1.5 text-emerald-700 dark:text-emerald-400">
                    {meta.ascii}
                  </span>
                </div>
                <BinaryGate
                  title={t('entity.binaryPreviewUnavailableTitle')}
                  description={t('entity.binaryPreviewUnavailable')}
                  onDownload={handleDownload}
                  downloadLabel={t('entity.binaryDownload')}
                />
              </div>
            )
          ) : (
            meta && (
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as BinaryTab)}
                className="gap-0"
              >
                <TabsList className="h-6 w-fit justify-start gap-0.5 rounded border bg-muted/40 p-0.5">
                  <TabsTrigger
                    value="hex-preview"
                    className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <Hash className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    {t('entity.binaryTabHexPreview')}
                  </TabsTrigger>
                  {hasDecoded ? (
                    <TabsTrigger
                      value="decoded"
                      className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      <Boxes className="h-2.5 w-2.5 shrink-0 opacity-70" />
                      {t('entity.binaryTabDecoded')}
                    </TabsTrigger>
                  ) : null}
                  <TabsTrigger
                    value="full-hex"
                    className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <ScanSearch className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    {t('entity.binaryTabFullHex')}
                  </TabsTrigger>
                  {canPreview ? (
                    <TabsTrigger
                      value="preview"
                      className="h-5 gap-1 rounded-sm px-1.5 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      <Eye className="h-2.5 w-2.5 shrink-0 opacity-70" />
                      {t('entity.binaryTabPreview')}
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent
                  value="hex-preview"
                  className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
                >
                  <div className="flex items-center gap-2 overflow-hidden rounded border bg-muted/25 px-1.5 py-1 font-mono text-[10px] leading-none">
                    <span className="w-8 shrink-0 text-muted-foreground">0000</span>
                    <code className="min-w-0 flex-1 overflow-x-auto text-foreground/85">
                      {meta.hex}
                    </code>
                    <span className="shrink-0 border-border/50 border-l pl-1.5 text-emerald-700 dark:text-emerald-400">
                      {meta.ascii}
                    </span>
                  </div>
                </TabsContent>

                {hasDecoded && decodedValue ? (
                  <TabsContent
                    value="decoded"
                    className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
                  >
                    <DecodedBinaryContent value={decodedValue} />
                  </TabsContent>
                ) : null}

                <TabsContent
                  value="full-hex"
                  className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
                >
                  {isDecoding || (isUrlMode && loadState === 'loading') ? (
                    <div className="flex h-28 items-center justify-center gap-1.5 rounded border bg-muted/20 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('entity.binaryLoading')}
                    </div>
                  ) : hexTooLarge ? (
                    <BinaryGate
                      title={t('entity.binaryHexTooLargeTitle')}
                      description={t('entity.binaryHexTooLarge', {
                        size: formatBytes(meta.byteSize),
                      })}
                      onDownload={handleDownload}
                      downloadLabel={t('entity.binaryDownload')}
                    />
                  ) : fullBytes ? (
                    <HexViewer bytes={fullBytes} className="h-56 shadow-none" />
                  ) : (
                    <BinaryGate
                      title={t('entity.binaryDecodeErrorTitle')}
                      description={t('entity.binaryDecodeError')}
                      onDownload={handleDownload}
                      downloadLabel={t('entity.binaryDownload')}
                    />
                  )}
                </TabsContent>

                {canPreview ? (
                  <TabsContent
                    value="preview"
                    className="mt-1.5 h-fit outline-none data-[state=inactive]:hidden"
                  >
                    {previewContent}
                  </TabsContent>
                ) : null}
              </Tabs>
            )
          )}
        </div>
      )}
    </div>
  )
}

function BinaryGate({
  title,
  description,
  onDownload,
  downloadLabel,
}: {
  title: string
  description: string
  onDownload: () => void
  downloadLabel: string
}) {
  const mobile = isMobileShell()
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded border border-dashed bg-muted/20 px-3 py-4 text-center',
        mobile && 'gap-2 rounded-xl px-4 py-5'
      )}
    >
      <FileWarning className={cn('text-muted-foreground', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
      <div className="space-y-0.5">
        <p className={cn('font-medium', mobile ? 'text-sm' : 'text-[11px]')}>{title}</p>
        <p
          className={cn(
            'max-w-xs text-muted-foreground',
            mobile ? 'text-xs leading-relaxed' : 'text-[10px]'
          )}
        >
          {description}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('mt-0.5 gap-1', mobile ? 'h-11 px-4 text-sm' : 'h-6 text-[10px]')}
        onClick={onDownload}
      >
        <Download className={cn(mobile ? 'h-4 w-4' : 'h-3 w-3')} />
        {downloadLabel}
      </Button>
    </div>
  )
}
