import { cn } from '@4d/ui'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { type ReactNode, useEffect, useEffectEvent, useRef } from 'react'

const COMMIT_PX = 72
const COMMIT_RATIO = 0.22
const DECIDE_PX = 10
const OFF_AXIS_RATIO = 0.65
const FOLLOW = 0.92
const BLOCKED_FOLLOW = 0.22
const EXIT_MS = 160

type AxisLock = 'none' | 'horizontal' | 'vertical'

type SwipeNavigateProps = {
  enabled?: boolean
  /** Show a soft loading veil behind/over the sheet (page or entity fetch). */
  loading?: boolean
  loadingLabel?: string
  /** Finger left → next. */
  onSwipeLeft?: () => void
  /** Finger right → previous. */
  onSwipeRight?: () => void
  canSwipeLeft?: boolean
  canSwipeRight?: boolean
  nextLabel?: string
  previousLabel?: string
  className?: string
  children: ReactNode
}

/**
 * Touch sheet with light Tinder-style feedback. A muted backdrop + optional
 * loading veil keep the viewport from flashing empty/black during commits.
 */
export function SwipeNavigate({
  enabled = true,
  loading = false,
  loadingLabel,
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft = true,
  canSwipeRight = true,
  nextLabel,
  previousLabel,
  className,
  children,
}: SwipeNavigateProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const leftHintRef = useRef<HTMLDivElement>(null)
  const rightHintRef = useRef<HTMLDivElement>(null)

  const onSwipeLeftEvent = useEffectEvent(() => {
    onSwipeLeft?.()
  })
  const onSwipeRightEvent = useEffectEvent(() => {
    onSwipeRight?.()
  })

  useEffect(() => {
    const root = rootRef.current
    const sheet = sheetRef.current
    const leftHint = leftHintRef.current
    const rightHint = rightHintRef.current
    if (!root || !sheet) return

    // Always clear any leftover transform / hints when the sheet remounts or toggles.
    sheet.style.transition = 'none'
    sheet.style.transform = 'translate3d(0,0,0)'
    sheet.style.opacity = '1'

    const clearHints = () => {
      if (leftHint) {
        leftHint.style.opacity = '0'
        leftHint.style.transform = 'translateX(-4px) scale(0.9)'
      }
      if (rightHint) {
        rightHint.style.opacity = '0'
        rightHint.style.transform = 'translateX(4px) scale(0.9)'
      }
    }
    clearHints()

    if (!enabled) return

    let startX = 0
    let startY = 0
    let lock: AxisLock = 'none'
    let offsetX = 0
    let animating = false
    let active = false
    let raf = 0
    let exitTimer = 0

    const width = () => root.getBoundingClientRect().width || window.innerWidth

    const setHints = (x: number) => {
      if (x === 0) {
        clearHints()
        return
      }
      const w = width()
      const progress = Math.min(1, Math.abs(x) / Math.max(COMMIT_PX, w * COMMIT_RATIO))
      const goingPrev = x > 0
      const goingNext = x < 0

      if (leftHint) {
        const show = goingPrev && canSwipeRight
        leftHint.style.opacity = show ? String(0.35 + progress * 0.65) : '0'
        leftHint.style.transform = `translateX(${show ? progress * 6 : -4}px) scale(${
          show ? 0.92 + progress * 0.12 : 0.9
        })`
      }
      if (rightHint) {
        const show = goingNext && canSwipeLeft
        rightHint.style.opacity = show ? String(0.35 + progress * 0.65) : '0'
        rightHint.style.transform = `translateX(${show ? -progress * 6 : 4}px) scale(${
          show ? 0.92 + progress * 0.12 : 0.9
        })`
      }
    }

    const paint = (x: number, withTransition: boolean) => {
      offsetX = x
      if (withTransition) {
        sheet.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EXIT_MS}ms ease`
      } else {
        sheet.style.transition = 'none'
      }
      // Keep the sheet mostly opaque so the backdrop never reads as a black void.
      const opacity = 1 - Math.min(0.12, (Math.abs(x) / Math.max(width(), 1)) * 0.2)
      sheet.style.transform = `translate3d(${x}px, 0, 0)`
      sheet.style.opacity = String(opacity)
      setHints(x)
    }

    const resetSheet = (animate: boolean) => {
      clearHints()
      paint(0, animate)
      if (!animate) {
        requestAnimationFrame(() => {
          sheet.style.transition = 'none'
          sheet.style.opacity = '1'
          clearHints()
        })
      }
    }

    const finishCommit = (direction: 'left' | 'right') => {
      animating = true
      // Hide chevrons immediately — navigation may disable gestures mid-exit.
      clearHints()
      // Navigate first so the next content can mount under the outgoing sheet.
      if (direction === 'left') onSwipeLeftEvent()
      else onSwipeRightEvent()

      const exitX = direction === 'left' ? -width() * 0.35 : width() * 0.35
      // Paint exit without re-showing hints.
      offsetX = exitX
      sheet.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EXIT_MS}ms ease`
      sheet.style.transform = `translate3d(${exitX}px, 0, 0)`
      sheet.style.opacity = '0.88'
      clearHints()

      window.clearTimeout(exitTimer)
      exitTimer = window.setTimeout(() => {
        resetSheet(false)
        sheet.style.opacity = '1'
        clearHints()
        animating = false
        active = false
        lock = 'none'
      }, EXIT_MS)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (animating || e.touches.length !== 1) return
      const target = e.target
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [data-no-horizontal-swipe], button, a'
        )
      ) {
        active = false
        return
      }
      const touch = e.touches[0]
      if (!touch) return
      startX = touch.clientX
      startY = touch.clientY
      lock = 'none'
      active = true
      sheet.style.transition = 'none'
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!active || animating) return
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY

      if (lock === 'none') {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return
        if (Math.abs(dy) > Math.abs(dx) * OFF_AXIS_RATIO && Math.abs(dy) > DECIDE_PX) {
          lock = 'vertical'
          active = false
          resetSheet(false)
          return
        }
        if (Math.abs(dx) >= Math.abs(dy)) {
          lock = 'horizontal'
        } else {
          return
        }
      }

      if (lock !== 'horizontal') return
      e.preventDefault()

      const allowed = dx < 0 ? canSwipeLeft : dx > 0 ? canSwipeRight : true
      const follow = allowed ? FOLLOW : BLOCKED_FOLLOW
      const nextX = dx * follow

      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => paint(nextX, false))
    }

    const onTouchEnd = () => {
      if (!active || animating) {
        active = false
        lock = 'none'
        return
      }
      active = false
      if (lock !== 'horizontal') {
        lock = 'none'
        return
      }
      lock = 'none'

      const w = width()
      const threshold = Math.max(COMMIT_PX, w * COMMIT_RATIO)
      if (offsetX < -threshold && canSwipeLeft) {
        finishCommit('left')
        return
      }
      if (offsetX > threshold && canSwipeRight) {
        finishCommit('right')
        return
      }
      resetSheet(true)
      window.clearTimeout(exitTimer)
      exitTimer = window.setTimeout(() => {
        sheet.style.transition = 'none'
      }, EXIT_MS)
    }

    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd)
    root.addEventListener('touchcancel', onTouchEnd)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(exitTimer)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
      sheet.style.transition = 'none'
      sheet.style.transform = 'translate3d(0,0,0)'
      sheet.style.opacity = '1'
      clearHints()
    }
  }, [enabled, canSwipeLeft, canSwipeRight])

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background',
        className
      )}
    >
      {/* Backdrop so slide-away never exposes a blank void. */}
      <div className="pointer-events-none absolute inset-0 bg-muted/30" aria-hidden />

      {loading ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-[2px]"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          {loadingLabel ? <p className="text-muted-foreground text-sm">{loadingLabel}</p> : null}
        </div>
      ) : null}

      <div
        ref={leftHintRef}
        className="pointer-events-none absolute inset-y-0 left-1 z-10 flex items-center opacity-0 transition-opacity duration-fast"
        aria-hidden
      >
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border border-primary/25',
            'bg-primary/10 text-primary shadow-sm backdrop-blur-sm'
          )}
          title={previousLabel}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <div
        ref={rightHintRef}
        className="pointer-events-none absolute inset-y-0 right-1 z-10 flex items-center opacity-0 transition-opacity duration-fast"
        aria-hidden
      >
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border border-primary/25',
            'bg-primary/10 text-primary shadow-sm backdrop-blur-sm'
          )}
          title={nextLabel}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div
        ref={sheetRef}
        className="relative z-1 flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background will-change-transform"
        style={{ transform: 'translate3d(0,0,0)' }}
      >
        {children}
      </div>
    </div>
  )
}
