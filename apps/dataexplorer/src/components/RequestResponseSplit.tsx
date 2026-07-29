import { cn } from '@4d/ui'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { isMobileShell } from '~/lib/platform'
import {
  getHttpClientRequestHeight,
  getHttpClientRequestWidth,
  getMethodExecutorRequestHeight,
  getMethodExecutorRequestWidth,
  setHttpClientRequestHeight,
  setHttpClientRequestWidth,
  setMethodExecutorRequestHeight,
  setMethodExecutorRequestWidth,
} from '~/lib/storage'
import { ResizableHandle, ResizableVerticalHandle } from './ResizablePanel'

const MIN_WIDTH_PERCENT = 25
const MAX_WIDTH_PERCENT = 75
const DEFAULT_HEIGHT_PERCENT = 45
const MIN_HEIGHT_PERCENT = 20
const MAX_HEIGHT_PERCENT = 70

const SPLIT_CONFIG = {
  methodExecutor: {
    defaultWidthPercent: 40,
    defaultHeightPercent: DEFAULT_HEIGHT_PERCENT,
    dataAttr: 'data-method-executor-split',
    getStoredWidth: getMethodExecutorRequestWidth,
    setStoredWidth: setMethodExecutorRequestWidth,
    getStoredHeight: getMethodExecutorRequestHeight,
    setStoredHeight: setMethodExecutorRequestHeight,
  },
  httpClient: {
    defaultWidthPercent: 50,
    defaultHeightPercent: DEFAULT_HEIGHT_PERCENT,
    dataAttr: 'data-http-client-split',
    getStoredWidth: getHttpClientRequestWidth,
    setStoredWidth: setHttpClientRequestWidth,
    getStoredHeight: getHttpClientRequestHeight,
    setStoredHeight: setHttpClientRequestHeight,
  },
} as const

type RequestResponseSplitProps = {
  kind: keyof typeof SPLIT_CONFIG
  request: ReactNode
  response: ReactNode
  requestClassName?: string
  responseClassName?: string
  className?: string
  /** On mobile shell: show only one full-height pane at a time (request→response stack). */
  mobilePane?: 'request' | 'response'
}

/**
 * Request | response layout: stacked below 1200px (vertically resizable),
 * side-by-side and horizontally resizable at 1200px+.
 * On mobile shell with `mobilePane`, only one pane is shown full-height.
 * Sizes are stored as percentages of the container (same pattern as dataclass list/viewer).
 */
export function RequestResponseSplit({
  kind,
  request,
  response,
  requestClassName,
  responseClassName,
  className,
  mobilePane,
}: RequestResponseSplitProps) {
  const mobile = isMobileShell()
  const stackMobile = mobile && mobilePane != null
  const config = SPLIT_CONFIG[kind]
  const [widthPercent, setWidthPercent] = useState(() => {
    if (typeof window === 'undefined') return config.defaultWidthPercent
    const stored = config.getStoredWidth()
    if (stored >= MIN_WIDTH_PERCENT && stored <= MAX_WIDTH_PERCENT) return stored
    return config.defaultWidthPercent
  })
  const [heightPercent, setHeightPercent] = useState(() => {
    if (typeof window === 'undefined') return config.defaultHeightPercent
    const stored = config.getStoredHeight()
    if (stored >= MIN_HEIGHT_PERCENT && stored <= MAX_HEIGHT_PERCENT) return stored
    return config.defaultHeightPercent
  })

  useEffect(() => {
    const storedWidth = config.getStoredWidth()
    setWidthPercent(Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, storedWidth)))
    const storedHeight = config.getStoredHeight()
    setHeightPercent(Math.min(MAX_HEIGHT_PERCENT, Math.max(MIN_HEIGHT_PERCENT, storedHeight)))
  }, [config])

  useEffect(() => {
    config.setStoredWidth(widthPercent)
  }, [widthPercent, config])

  useEffect(() => {
    config.setStoredHeight(heightPercent)
  }, [heightPercent, config])

  const findVisibleContainer = useCallback(() => {
    return Array.from(document.querySelectorAll<HTMLElement>(`[${config.dataAttr}]`)).find(
      (el) => el.clientWidth > 0 && el.clientHeight > 0
    )
  }, [config.dataAttr])

  const handleHorizontalResize = useCallback(
    (delta: number) => {
      setWidthPercent((prev) => {
        const container = findVisibleContainer()
        if (!container) return prev
        const deltaPercent = (delta / container.clientWidth) * 100
        return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, prev + deltaPercent))
      })
    },
    [findVisibleContainer]
  )

  const handleVerticalResize = useCallback(
    (delta: number) => {
      setHeightPercent((prev) => {
        const container = findVisibleContainer()
        if (!container) return prev
        const deltaPercent = (delta / container.clientHeight) * 100
        return Math.min(MAX_HEIGHT_PERCENT, Math.max(MIN_HEIGHT_PERCENT, prev + deltaPercent))
      })
    },
    [findVisibleContainer]
  )

  const handleHorizontalDoubleClick = useCallback(() => {
    setWidthPercent(config.defaultWidthPercent)
  }, [config.defaultWidthPercent])

  const handleVerticalDoubleClick = useCallback(() => {
    setHeightPercent(config.defaultHeightPercent)
  }, [config.defaultHeightPercent])

  if (stackMobile) {
    return (
      <div
        {...{ [config.dataAttr]: '' }}
        className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}
      >
        {mobilePane === 'request' ? (
          <section className={cn('min-h-0 flex-1 overflow-y-auto', requestClassName)}>
            {request}
          </section>
        ) : (
          <section
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
              responseClassName
            )}
          >
            {response}
          </section>
        )}
      </div>
    )
  }

  return (
    <div
      {...{ [config.dataAttr]: '' }}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden',
        !mobile && 'min-[1200px]:flex-row',
        className
      )}
      style={
        {
          ['--request-pane-width' as string]: `${widthPercent}%`,
          ['--request-pane-height' as string]: `${heightPercent}%`,
        } as React.CSSProperties
      }
    >
      <section
        className={cn(
          'min-h-0 w-full shrink-0 overflow-y-auto',
          mobile
            ? 'h-(--request-pane-height)'
            : 'max-[1199px]:h-(--request-pane-height) min-[1200px]:w-(--request-pane-width) min-[1200px]:border-b-0',
          requestClassName
        )}
      >
        {request}
      </section>

      {/* Drag-to-resize doesn't work with touch; hide the handle on mobile. */}
      {!mobile ? (
        <ResizableVerticalHandle
          className="min-[1200px]:hidden"
          onResize={handleVerticalResize}
          onDoubleClick={handleVerticalDoubleClick}
        />
      ) : null}

      {!mobile ? (
        <ResizableHandle
          className="hidden min-[1200px]:flex"
          onResize={handleHorizontalResize}
          onDoubleClick={handleHorizontalDoubleClick}
        />
      ) : null}

      <section
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', responseClassName)}
      >
        {response}
      </section>
    </div>
  )
}
