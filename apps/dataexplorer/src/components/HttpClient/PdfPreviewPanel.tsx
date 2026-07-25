import { Button, cn } from '@4d/ui'
import { ChevronLeft, ChevronRight, Maximize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'

const DEFAULT_SCALE = 1
const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCROLL_PADDING_PX = 24 // matches p-3 on the scroll area

let workerConfigured = false

function ensurePdfWorker(): void {
  if (workerConfigured) return
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc
  workerConfigured = true
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 100) / 100))
}

type PdfPreviewPanelProps = {
  bytes: Uint8Array
  className?: string
  title?: string
}

/**
 * Canvas-based PDF preview via PDF.js (works in headless Chromium, unlike iframe viewers).
 */
export function PdfPreviewPanel({ bytes, className, title }: PdfPreviewPanelProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ensurePdfWorker()
    let cancelled = false
    let pdf: PDFDocumentProxy | null = null

    setLoading(true)
    setReady(false)
    setError(null)
    setDoc(null)
    setPageNumber(1)
    setPageCount(0)
    setScale(DEFAULT_SCALE)

    const data = bytes.slice()
    const loadingTask = getDocument({ data })

    void (async () => {
      try {
        pdf = await loadingTask.promise
        if (cancelled) {
          await loadingTask.destroy()
          return
        }
        setDoc(pdf)
        setPageCount(pdf.numPages)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        setError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      cancelled = true
      setDoc(null)
      void loadingTask.destroy()
      void pdf?.cleanup()
    }
  }, [bytes])

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null

    void (async () => {
      try {
        setReady(false)
        const page = await doc.getPage(pageNumber)
        if (cancelled) return
        const viewport = page.getViewport({ scale })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        renderTask = page.render({ canvas, viewport })
        await renderTask.promise
        if (!cancelled) setReady(true)
      } catch (err) {
        if (cancelled) return
        if (err instanceof Error && /cancel/i.test(err.message)) return
        setError(err instanceof Error ? err.message : String(err))
        setReady(false)
      }
    })()

    return () => {
      cancelled = true
      try {
        renderTask?.cancel()
      } catch {
        // ignore
      }
    }
  }, [doc, pageNumber, scale])

  const zoomBy = (delta: number) => {
    setScale((prev) => clampScale(prev + delta))
  }

  const resetZoom = useCallback(() => {
    setScale(DEFAULT_SCALE)
  }, [])

  const fitToWidth = useCallback(async () => {
    if (!doc || !scrollRef.current) return
    try {
      const page = await doc.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const available = scrollRef.current.clientWidth - SCROLL_PADDING_PX
      if (available <= 0 || base.width <= 0) return
      setScale(clampScale(available / base.width))
    } catch {
      // ignore — page may have been disposed
    }
  }, [doc, pageNumber])

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-muted/20',
        className
      )}
      data-pdf-preview
      data-pdf-ready={ready ? 'true' : 'false'}
      data-pdf-pages={pageCount || undefined}
    >
      <div className="flex shrink-0 items-center gap-1 border-b bg-background/80 px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          aria-label={t('command.previousPage')}
          title={t('command.previousPage')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-20 text-center text-muted-foreground text-xs tabular-nums">
          {pageCount > 0
            ? t('entity.pageOf', { page: pageNumber, total: pageCount })
            : t('httpClient.pdfLoading')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={pageNumber >= pageCount}
          onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
          aria-label={t('command.nextPage')}
          title={t('command.nextPage')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!doc}
          onClick={() => zoomBy(-0.15)}
          aria-label={t('editor.zoomOut')}
          title={t('editor.zoomOut')}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="min-w-12 cursor-pointer rounded px-1 text-center text-muted-foreground text-xs tabular-nums hover:bg-muted hover:text-foreground"
          disabled={!doc}
          onClick={resetZoom}
          aria-label={t('editor.resetZoom')}
          title={t('editor.resetZoom')}
        >
          {Math.round(scale * 100)}%
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!doc}
          onClick={() => zoomBy(0.15)}
          aria-label={t('editor.zoomIn')}
          title={t('editor.zoomIn')}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!doc}
          onClick={() => void fitToWidth()}
          aria-label={t('httpClient.pdfFitWidth')}
          title={t('httpClient.pdfFitWidth')}
        >
          <Maximize className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!doc || scale === DEFAULT_SCALE}
          onClick={resetZoom}
          aria-label={t('editor.resetZoom')}
          title={t('editor.resetZoom')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {title ? (
          <span className="max-w-48 truncate text-[11px] text-muted-foreground" title={title}>
            {title}
          </span>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {t('httpClient.pdfLoadError')}: {error}
          </p>
        ) : null}
        {loading && !error ? (
          <p className="text-muted-foreground text-sm">{t('httpClient.pdfLoading')}</p>
        ) : null}
        <canvas
          ref={canvasRef}
          title={title ?? t('httpClient.binaryPreviewAlt')}
          className={cn(
            'mx-auto block max-w-none rounded-sm bg-white shadow-sm',
            (!ready || error) && 'invisible'
          )}
        />
      </div>
    </div>
  )
}
