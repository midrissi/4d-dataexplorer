import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { Hash, Sparkles } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { ObjectTree } from '~/components/Console/ObjectTree'

/** Cell preview: tooltips for truncated/formatted primitives; hover popover for
 * interactive object trees (scroll / binary viewer must not dismiss on wheel). */
export function CellTooltipWrapper({
  children,
  value,
  isObject,
  formatted,
}: {
  children: ReactNode
  value: unknown
  isObject: boolean
  formatted?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [objectOpen, setObjectOpen] = useState(false)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openObjectPreview = useCallback(() => {
    clearCloseTimer()
    setObjectOpen(true)
  }, [clearCloseTimer])

  const scheduleCloseObjectPreview = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setObjectOpen(false)
      closeTimerRef.current = null
    }, 200)
  }, [clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  // Detect actual visual truncation (content wider/taller than the cell).
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (value === null || value === undefined) {
    return <>{children}</>
  }

  const rawString = String(value)
  // Only treat as "dual" when a distinct human-readable formatting exists.
  const hasFormatted = formatted != null && formatted !== '' && formatted !== rawString

  if (isObject) {
    return (
      <Popover open={objectOpen} onOpenChange={setObjectOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full cursor-help overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 text-left font-[inherit] text-inherit"
            onMouseEnter={openObjectPreview}
            onMouseLeave={scheduleCloseObjectPreview}
            onFocus={openObjectPreview}
            onBlur={scheduleCloseObjectPreview}
            onClick={(e) => {
              // Toggle pin; stop row selection from stealing the interaction.
              e.stopPropagation()
              clearCloseTimer()
              setObjectOpen((open) => !open)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-h-[min(28rem,70vh)] w-[min(36rem,90vw)] max-w-[min(36rem,90vw)] overflow-hidden p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={openObjectPreview}
          onMouseLeave={scheduleCloseObjectPreview}
          onWheel={(e) => e.stopPropagation()}
          onInteractOutside={(e) => {
            // Keep open while interacting inside; only outside pointer closes immediately.
            const target = e.target
            if (
              target instanceof Element &&
              target.closest('[data-radix-popper-content-wrapper]')
            ) {
              e.preventDefault()
            }
          }}
        >
          <div
            className="max-h-[min(28rem,70vh)] overflow-auto p-2 font-mono text-xs"
            onWheel={(e) => e.stopPropagation()}
          >
            <ObjectTree value={value} defaultOpen />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Primitives only when truncated or reformatted.
  const shouldShowTooltip = isTruncated || hasFormatted

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={contentRef}
            className={cn(
              'w-full overflow-hidden text-ellipsis whitespace-nowrap',
              shouldShowTooltip && 'cursor-help'
            )}
          >
            {children}
          </div>
        </TooltipTrigger>
        {shouldShowTooltip ? (
          <TooltipContent side="right" className="max-w-lg overflow-hidden p-0">
            {hasFormatted ? (
              <div className="divide-y divide-border">
                <div className="px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Formatted
                  </div>
                  <pre className="wrap-break-word whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
                    {formatted}
                  </pre>
                </div>
                <div className="bg-muted/40 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Hash className="h-3 w-3" />
                    Raw
                  </div>
                  <pre className="wrap-break-word whitespace-pre-wrap font-mono text-muted-foreground text-xs leading-relaxed">
                    {rawString}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-sm bg-muted/50 p-2">
                <pre className="wrap-break-word whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
                  {rawString}
                </pre>
              </div>
            )}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  )
}
