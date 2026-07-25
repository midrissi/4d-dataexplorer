import { useEffect } from 'react'

type UseEscapeToDismissOptions = {
  /** When false, the listener is not registered. Defaults to true. */
  enabled?: boolean
}

/**
 * Close a custom (non-Radix) modal/overlay when Escape is pressed.
 * Uses capture phase so it runs before most bubbling handlers.
 * Radix Dialog already closes on Escape — use this only for custom overlays.
 */
export function useEscapeToDismiss(
  open: boolean,
  onDismiss: () => void,
  options?: UseEscapeToDismissOptions
): void {
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!open || !enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.defaultPrevented) return
      event.preventDefault()
      event.stopPropagation()
      onDismiss()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, enabled, onDismiss])
}
