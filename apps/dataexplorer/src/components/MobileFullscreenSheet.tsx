import { cn } from '@4d/ui'
import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-viewport sheet for the mobile shell. Portals to `document.body` so it
 * is not clipped by tab `overflow` ancestors, and uses z-50 to sit above the
 * app header/footer (same pattern as the console overlay).
 */
export function MobileFullscreenSheet({
  open,
  children,
  className,
  labelledBy,
}: {
  open: boolean
  children: ReactNode
  className?: string
  labelledBy?: string
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex min-h-0 flex-col bg-background',
        'pt-(--app-safe-top) pb-(--app-safe-bottom)',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {children}
    </div>,
    document.body
  )
}
