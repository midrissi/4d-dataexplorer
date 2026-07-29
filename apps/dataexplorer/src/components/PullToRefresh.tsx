import { cn } from '@4d/ui'
import { Loader2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD_PX = 64
const MAX_PULL_PX = 96

type PullToRefreshProps = {
  onRefresh: () => void | Promise<void>
  /** When true, pull gesture is ignored (e.g. already refreshing from elsewhere). */
  disabled?: boolean
  className?: string
  children: ReactNode
  /** Accessible label for the pull indicator. */
  label?: string
}

/**
 * Native-style pull-to-refresh for touch scroll containers (mobile shell).
 * Only arms when the scrollable content is already at the top.
 */
export function PullToRefresh({
  onRefresh,
  disabled = false,
  className,
  children,
  label = 'Refresh',
}: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullDistanceRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const disabledRef = useRef(disabled)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const setDistance = useCallback((value: number) => {
    pullDistanceRef.current = value
    setPullDistance(value)
  }, [])

  const runRefresh = useCallback(async () => {
    if (disabledRef.current || refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    setDistance(PULL_THRESHOLD_PX)
    try {
      await onRefreshRef.current()
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
      setDistance(0)
    }
  }, [setDistance])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || refreshingRef.current) return
      if (el.scrollTop > 0) {
        pulling.current = false
        return
      }
      startY.current = e.touches[0]?.clientY ?? 0
      pulling.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || disabledRef.current || refreshingRef.current) return
      if (el.scrollTop > 0) {
        pulling.current = false
        setDistance(0)
        return
      }
      const y = e.touches[0]?.clientY ?? 0
      const delta = y - startY.current
      if (delta <= 0) {
        setDistance(0)
        return
      }
      const distance = Math.min(MAX_PULL_PX, delta * 0.45)
      setDistance(distance)
      if (distance > 8) e.preventDefault()
    }

    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      if (pullDistanceRef.current >= PULL_THRESHOLD_PX) {
        void runRefresh()
      } else {
        setDistance(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [runRefresh, setDistance])

  const showIndicator = pullDistance > 0 || refreshing
  const armed = pullDistance >= PULL_THRESHOLD_PX || refreshing
  const indicatorHeight = Math.max(pullDistance, refreshing ? PULL_THRESHOLD_PX : 0)

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center transition-[height,opacity]',
          showIndicator ? 'opacity-100' : 'opacity-0'
        )}
        style={{ height: indicatorHeight }}
        aria-live="polite"
        aria-busy={refreshing}
      >
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-muted-foreground text-xs shadow-sm',
            armed && 'text-foreground'
          )}
        >
          <Loader2
            className={cn('h-3.5 w-3.5', (refreshing || armed) && 'animate-spin')}
            aria-hidden
          />
          <span>{label}</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingTop: showIndicator ? indicatorHeight : undefined }}
      >
        {children}
      </div>
    </div>
  )
}
