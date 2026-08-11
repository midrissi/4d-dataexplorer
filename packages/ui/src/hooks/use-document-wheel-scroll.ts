import * as React from 'react'
import {
  applyWheelDeltaToScrollTop,
  shouldHandleDocumentWheelScroll,
} from '../lib/document-wheel-scroll'

export type UseDocumentWheelScrollOptions = {
  /** When false, the document listener is not registered. Defaults to true. */
  enabled?: boolean
  /**
   * Element whose bounds count as “over the overlay” for hit-testing.
   * Defaults to the scroll element itself. For nested scrollers (e.g. list body
   * inside a popover shell), return the outer shell: `(el) => el.parentElement`.
   */
  getHitRoot?: (scrollEl: HTMLElement) => Element | null
  /**
   * When true, wheel events over the focused `<input>` / `<textarea>` also scroll
   * this element (useful for portaled suggest lists under a caret). Defaults to true.
   */
  includeFocusedTextControl?: boolean
}

/**
 * Callback-ref hook: while the scroll element is mounted, capture-phase document
 * `wheel` events that occur over it (or optional hit root / focused text control)
 * update `scrollTop` manually.
 *
 * Needed for body-portaled overlays inside Radix Dialog — `RemoveScroll` calls
 * `preventDefault` on wheels outside the dialog lock, so native overflow scrolling
 * never runs on the portal.
 */
export function useDocumentWheelScroll(
  options?: UseDocumentWheelScrollOptions
): React.RefCallback<HTMLElement> {
  const enabled = options?.enabled ?? true
  const includeFocusedTextControl = options?.includeFocusedTextControl ?? true
  const getHitRoot = options?.getHitRoot

  const cleanupRef = React.useRef<(() => void) | null>(null)
  const optionsRef = React.useRef({ enabled, includeFocusedTextControl, getHitRoot })
  optionsRef.current = { enabled, includeFocusedTextControl, getHitRoot }

  const setRef = React.useCallback((el: HTMLElement | null) => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (!el) return

    const onDocWheel = (event: WheelEvent) => {
      const opts = optionsRef.current
      if (!opts.enabled) return

      const hitRoot = opts.getHitRoot?.(el) ?? el
      if (!hitRoot) return

      if (
        !shouldHandleDocumentWheelScroll({
          scrollEl: el,
          hitRoot,
          event,
          includeFocusedTextControl: opts.includeFocusedTextControl,
        })
      ) {
        return
      }

      if (!applyWheelDeltaToScrollTop(el, event.deltaY)) return

      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('wheel', onDocWheel, { passive: false, capture: true })
    cleanupRef.current = () => document.removeEventListener('wheel', onDocWheel, true)
  }, [])

  React.useEffect(() => () => cleanupRef.current?.(), [])

  return setRef
}
