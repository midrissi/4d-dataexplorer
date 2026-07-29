import { Button, cn, useEscapeToDismiss } from '@4d/ui'
import { BookText, GripHorizontal, Maximize2, Minimize2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'
import { useTabsStore } from '~/store/tabs'
import './assistant-chatbot.css'
import { DataExplorerAssistant } from './DataExplorerAssistant'

type AssistantChatbotProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadingChange?: (loading: boolean) => void
}

const HEIGHT_STORAGE_KEY = 'dataexplorer.assistant-chatbot-height'
const MIN_HEIGHT_PX = 320
const DEFAULT_HEIGHT_VH_OFFSET = 56

function maxHeightPx(): number {
  return Math.max(MIN_HEIGHT_PX, window.innerHeight - DEFAULT_HEIGHT_VH_OFFSET)
}

function clampHeight(height: number): number {
  return Math.min(maxHeightPx(), Math.max(MIN_HEIGHT_PX, Math.round(height)))
}

function readStoredHeight(): number | null {
  try {
    const raw = localStorage.getItem(HEIGHT_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return clampHeight(parsed)
  } catch {
    return null
  }
}

function writeStoredHeight(height: number): void {
  try {
    localStorage.setItem(HEIGHT_STORAGE_KEY, String(clampHeight(height)))
  } catch {
    // ignore quota / private mode
  }
}

function focusAssistantComposer(): boolean {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    '.assistant-chatbot .assistant-composer__textarea:not([disabled])'
  )
  if (!textarea) return false
  textarea.focus({ preventScroll: true })
  return true
}

export function AssistantChatbot({ open, onOpenChange, onLoadingChange }: AssistantChatbotProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const openAssistantMetadataTab = useTabsStore((state) => state.openAssistantMetadataTab)
  const [fullscreen, setFullscreen] = useState(false)
  // Mobile always opens as a full-screen overlay (no windowed/resizable mode).
  const isFullscreen = mobile || fullscreen
  const [preloaded, setPreloaded] = useState(false)
  const [heightPx, setHeightPx] = useState<number | null>(() => readStoredHeight())
  const [isResizing, setIsResizing] = useState(false)
  const startYRef = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open || preloaded) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    const warmup = () => setPreloaded(true)
    const runtime = globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (typeof runtime.requestIdleCallback === 'function') {
      idleId = runtime.requestIdleCallback(warmup)
    } else {
      timeoutId = runtime.setTimeout(warmup, 300)
    }

    return () => {
      if (timeoutId !== null) runtime.clearTimeout(timeoutId)
      if (idleId !== null && typeof runtime.cancelIdleCallback === 'function') {
        runtime.cancelIdleCallback(idleId)
      }
    }
  }, [open, preloaded])

  const handleClose = useCallback(() => {
    setFullscreen(false)
    onOpenChange(false)
  }, [onOpenChange])

  const dismissAssistant = useCallback(() => {
    if (!mobile && fullscreen) {
      setFullscreen(false)
      return
    }
    handleClose()
  }, [mobile, fullscreen, handleClose])

  useEscapeToDismiss(open, dismissAssistant)

  const toggleFullscreen = useCallback(() => {
    setFullscreen((value) => !value)
  }, [])

  const applyHeightDelta = useCallback((deltaY: number) => {
    // Bottom-anchored panel: pointer moving up (negative deltaY) grows height.
    setHeightPx((current) => {
      const measured = panelRef.current?.getBoundingClientRect().height
      const base =
        current ?? (measured != null ? Math.round(measured) : Math.min(maxHeightPx(), 896))
      const next = clampHeight(base - deltaY)
      writeStoredHeight(next)
      return next
    })
  }, [])

  const resetHeight = useCallback(() => {
    setHeightPx(null)
    try {
      localStorage.removeItem(HEIGHT_STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const handleResizeMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setIsResizing(true)
    startYRef.current = event.clientY
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientY - startYRef.current
      startYRef.current = event.clientY
      applyHeightDelta(delta)
    }
    const handleMouseUp = () => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, applyHeightDelta])

  useEffect(() => {
    const onResize = () => {
      setHeightPx((current) => (current == null ? current : clampHeight(current)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!open) {
      setFullscreen(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      onLoadingChange?.(false)
      return
    }

    let attempts = 0
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      onLoadingChange?.(false)
    }

    onLoadingChange?.(true)
    if (focusAssistantComposer()) {
      finish()
      return
    }

    const retryInterval = window.setInterval(() => {
      attempts += 1
      if (focusAssistantComposer() || attempts >= 20) {
        window.clearInterval(retryInterval)
        finish()
      }
    }, 80)

    return () => {
      window.clearInterval(retryInterval)
      finish()
    }
  }, [open, onLoadingChange])

  if (!open && !preloaded) return null

  return (
    <div
      ref={panelRef}
      className={cn(
        'assistant-chatbot fixed z-50',
        mobile && 'assistant-chatbot--mobile',
        !open && 'pointer-events-none invisible opacity-0',
        open && isFullscreen
          ? 'assistant-chatbot--fullscreen'
          : open
            ? 'fade-in slide-in-from-bottom-3 right-3 bottom-10 animate-in duration-300'
            : 'right-3 bottom-10',
        isResizing && 'assistant-chatbot--resizing'
      )}
      style={!isFullscreen && heightPx != null ? { height: `${heightPx}px` } : undefined}
      role="dialog"
      aria-label={t('assistant.headerTitle')}
      aria-hidden={!open}
      aria-modal="false"
    >
      <div className="assistant-chatbot__frame">
        {!isFullscreen ? (
          <button
            type="button"
            className={cn(
              'assistant-chatbot__resize-handle',
              isResizing && 'assistant-chatbot__resize-handle--active'
            )}
            onMouseDown={handleResizeMouseDown}
            onDoubleClick={resetHeight}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                applyHeightDelta(-16)
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                applyHeightDelta(16)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                resetHeight()
              }
            }}
            aria-label={t('assistant.resizeHeightAria')}
            title={t('assistant.resizeHeightHint')}
          >
            <span className="assistant-chatbot__resize-grip" aria-hidden>
              <GripHorizontal className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : null}
        <div className="assistant-chatbot__accent" aria-hidden />
        <div className="assistant-chatbot__actions">
          {!mobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="assistant-chatbot__action"
              onClick={openAssistantMetadataTab}
              aria-label={t('layout.assistantMetadataAria')}
            >
              <BookText className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {!mobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="assistant-chatbot__action"
              onClick={toggleFullscreen}
              aria-label={
                fullscreen ? t('assistant.exitFullscreen') : t('assistant.enterFullscreen')
              }
              aria-pressed={fullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="assistant-chatbot__action"
            onClick={handleClose}
            aria-label={t('assistant.close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <DataExplorerAssistant />
      </div>
    </div>
  )
}
