import { cn } from '@4d/ui'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import {
  getHttpClientRequestWidth,
  getMethodExecutorRequestWidth,
  setHttpClientRequestWidth,
  setMethodExecutorRequestWidth,
} from '~/lib/storage'
import { ResizableHandle } from './ResizablePanel'

const MIN_WIDTH_PERCENT = 25
const MAX_WIDTH_PERCENT = 75

const SPLIT_CONFIG = {
  methodExecutor: {
    defaultWidthPercent: 40,
    dataAttr: 'data-method-executor-split',
    getStoredWidth: getMethodExecutorRequestWidth,
    setStoredWidth: setMethodExecutorRequestWidth,
  },
  httpClient: {
    defaultWidthPercent: 50,
    dataAttr: 'data-http-client-split',
    getStoredWidth: getHttpClientRequestWidth,
    setStoredWidth: setHttpClientRequestWidth,
  },
} as const

type RequestResponseSplitProps = {
  kind: keyof typeof SPLIT_CONFIG
  request: ReactNode
  response: ReactNode
  requestClassName?: string
  responseClassName?: string
  className?: string
}

/**
 * Request | response layout: stacked below `lg`, horizontally resizable at `lg+`.
 * Width is stored as a percentage of the container (same pattern as dataclass list/viewer).
 */
export function RequestResponseSplit({
  kind,
  request,
  response,
  requestClassName,
  responseClassName,
  className,
}: RequestResponseSplitProps) {
  const config = SPLIT_CONFIG[kind]
  const [widthPercent, setWidthPercent] = useState(() => {
    if (typeof window === 'undefined') return config.defaultWidthPercent
    const stored = config.getStoredWidth()
    if (stored >= MIN_WIDTH_PERCENT && stored <= MAX_WIDTH_PERCENT) return stored
    return config.defaultWidthPercent
  })

  useEffect(() => {
    const stored = config.getStoredWidth()
    setWidthPercent(Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, stored)))
  }, [config])

  useEffect(() => {
    config.setStoredWidth(widthPercent)
  }, [widthPercent, config])

  const handleResize = useCallback(
    (delta: number) => {
      setWidthPercent((prev) => {
        const container = Array.from(
          document.querySelectorAll<HTMLElement>(`[${config.dataAttr}]`)
        ).find((el) => el.clientWidth > 0)
        if (!container) return prev
        const deltaPercent = (delta / container.clientWidth) * 100
        return Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, prev + deltaPercent))
      })
    },
    [config.dataAttr]
  )

  const handleDoubleClick = useCallback(() => {
    setWidthPercent(config.defaultWidthPercent)
  }, [config.defaultWidthPercent])

  return (
    <div
      {...{ [config.dataAttr]: '' }}
      className={cn('flex h-full min-h-0 flex-col overflow-hidden lg:flex-row', className)}
    >
      <section
        className={cn(
          'min-h-0 w-full shrink-0 overflow-y-auto border-b lg:w-(--request-pane-width) lg:border-b-0',
          requestClassName
        )}
        style={{ ['--request-pane-width' as string]: `${widthPercent}%` }}
      >
        {request}
      </section>

      <ResizableHandle
        className="hidden lg:flex"
        onResize={handleResize}
        onDoubleClick={handleDoubleClick}
      />

      <section
        className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', responseClassName)}
      >
        {response}
      </section>
    </div>
  )
}
