/** Axis-aligned hit test for a DOMRect / ClientRect-like box. */
export function pointInRect(
  x: number,
  y: number,
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/** True when `node` is a focused `<input>` or `<textarea>`. */
export function isFocusedTextControl(
  node: Element | null
): node is HTMLInputElement | HTMLTextAreaElement {
  if (typeof HTMLElement === 'undefined') return false
  if (!(node instanceof HTMLElement)) return false
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA'
}

export type DocumentWheelScrollHitInput = {
  /** Scrollable element that receives `scrollTop` updates. */
  scrollEl: HTMLElement
  /** Bounds used for pointer hit-testing (defaults to `scrollEl`). */
  hitRoot: Element
  event: Pick<WheelEvent, 'clientX' | 'clientY' | 'target'>
  /** When true, wheel over the focused text control also counts as a hit. */
  includeFocusedTextControl?: boolean
  /** Active element used for the text-control hit (defaults to `document.activeElement`). */
  activeElement?: Element | null
}

/**
 * Whether a wheel event should drive `scrollEl` despite Dialog / RemoveScroll
 * locks (target inside hit root, pointer over hit root, or over focused input).
 */
export function shouldHandleDocumentWheelScroll(input: DocumentWheelScrollHitInput): boolean {
  const { scrollEl, hitRoot, event, includeFocusedTextControl = true } = input

  const target = event.target
  if (
    typeof Node !== 'undefined' &&
    target instanceof Node &&
    (hitRoot.contains(target) || scrollEl.contains(target))
  ) {
    return true
  }

  if (pointInRect(event.clientX, event.clientY, hitRoot.getBoundingClientRect())) {
    return true
  }

  if (!includeFocusedTextControl) return false
  const active =
    input.activeElement ?? (typeof document !== 'undefined' ? document.activeElement : null)
  if (!isFocusedTextControl(active)) return false
  return pointInRect(event.clientX, event.clientY, active.getBoundingClientRect())
}

/**
 * Apply `deltaY` to `scrollEl.scrollTop`. Returns true when the position changed.
 */
export function applyWheelDeltaToScrollTop(scrollEl: HTMLElement, deltaY: number): boolean {
  const max = scrollEl.scrollHeight - scrollEl.clientHeight
  if (max <= 0) return false
  const next = Math.min(max, Math.max(0, scrollEl.scrollTop + deltaY))
  if (next === scrollEl.scrollTop) return false
  scrollEl.scrollTop = next
  return true
}
