import { cn } from '@4d/ui'

/** Shared Floating UI collision props for touch menus on mobile. */
export const mobileMenuCollisionProps = {
  avoidCollisions: true,
  collisionPadding: 16,
  sideOffset: 8,
} as const

/**
 * Touch-friendly menu surface. Leaves transform/position to Radix so menus can
 * flip and shift when they would collide with the viewport (or safe areas).
 */
export function mobileMenuContentClass(extra?: string) {
  return cn(
    'z-50 max-h-[min(70dvh,28rem)] w-[min(calc(100vw-2rem),22rem)] max-w-[calc(100vw-2rem)]',
    'overflow-y-auto overscroll-contain rounded-xl p-2 shadow-lg',
    extra
  )
}

export function mobileMenuItemClass(extra?: string) {
  return cn('min-h-12 gap-3 rounded-lg px-3 py-3 text-sm', extra)
}

export function mobileMenuHeaderClass(extra?: string) {
  return cn('px-3 py-2.5', extra)
}

/**
 * Full-viewport dialog surface for mobile. Resets the kit Dialog’s centered
 * `left/top 50% + translate(-50%)` so content isn’t clipped. Enter/exit use
 * the kit’s center zoom/fade (no edge slides).
 */
export function mobileFullscreenDialogClass(extra?: string) {
  return cn(
    'inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-full origin-center',
    'translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0',
    'pt-(--app-safe-top) pb-(--app-safe-bottom)',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
    extra
  )
}

/**
 * Centered modal on mobile — kit centering + touch-friendly size/radius.
 * Scales in from the middle of the viewport (no edge slides).
 */
export function mobileCenteredDialogClass(extra?: string) {
  return cn(
    'top-1/2 left-1/2 w-[min(calc(100vw-2rem),24rem)] max-w-[calc(100vw-2rem)] origin-center',
    'translate-x-[-50%] translate-y-[-50%] rounded-2xl border-border p-5 shadow-lg',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
    extra
  )
}
