/**
 * Sync CSS safe-area + soft-keyboard viewport variables for the mobile shell.
 *
 * Prefer native-published `--app-safe-*` (set by the iOS edge-to-edge plugin from
 * `UIWindow.safeAreaInsets`). Fall back to `env(safe-area-inset-*)`.
 *
 * When the layout viewport is already safe-area sized (`inner + insets ≈ screen`),
 * keep top padding (notch) but use compact bottom padding so we don't double-inset.
 *
 * Soft keyboard: edge-to-edge disables WKWebView auto scroll-insets, so the shell
 * must shrink to `visualViewport` or the bottom-pinned Monaco / form fields stay
 * under the IME.
 */

/** Overlap between the layout viewport and the visual viewport (soft keyboard). */
export function computeKeyboardOverlap(
  innerHeight: number,
  visualHeight: number,
  offsetTop: number
): number {
  return Math.max(0, Math.round(innerHeight - visualHeight - offsetTop))
}

/**
 * Sync CSS safe-area variables for the mobile shell.
 */
export function syncWebviewSafeAreaMode(): 'full-bleed' | 'pre-inset' {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'full-bleed'
  }

  const root = document.documentElement
  const existingTop = Number.parseFloat(root.style.getPropertyValue('--app-safe-top')) || 0
  const existingBottom = Number.parseFloat(root.style.getPropertyValue('--app-safe-bottom')) || 0

  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const envTop = Number.parseFloat(getComputedStyle(probe).paddingTop) || 0
  const envBottom = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0
  probe.remove()

  const safeTop = Math.max(existingTop, envTop, 0)
  const safeBottom = Math.max(existingBottom, envBottom, 0)

  const screenH = window.screen?.height ?? 0
  const inner = window.innerHeight
  // Full-bleed: layout height matches the screen (plugin expanded the webview).
  const fullBleed = screenH > 0 && Math.abs(inner - screenH) <= 2
  // Legacy: webview already inset; env insets still reported.
  const preInset =
    !fullBleed && screenH > 0 && Math.abs(inner + safeTop + safeBottom - screenH) <= 2

  root.dataset.webviewInset = preInset ? 'pre' : 'full'
  root.style.setProperty('--app-safe-top', `${safeTop}px`)

  if (preInset) {
    root.style.setProperty('--app-safe-bottom', '8px')
    return 'pre-inset'
  }

  root.style.setProperty('--app-safe-bottom', `${safeBottom}px`)
  return 'full-bleed'
}

/**
 * Publish `--app-viewport-*` / `--app-keyboard-inset` from `visualViewport`.
 * When the keyboard is open, clear bottom safe-area so the home indicator is not
 * double-counted above the IME.
 */
export function syncWebviewKeyboardInset(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 0
  }

  const root = document.documentElement
  const vv = window.visualViewport

  if (!vv) {
    root.style.setProperty('--app-keyboard-inset', '0px')
    root.style.setProperty('--app-viewport-height', `${window.innerHeight}px`)
    root.style.setProperty('--app-viewport-offset-top', '0px')
    root.dataset.keyboardOpen = 'false'
    return 0
  }

  const inset = computeKeyboardOverlap(window.innerHeight, vv.height, vv.offsetTop)
  root.style.setProperty('--app-keyboard-inset', `${inset}px`)
  root.style.setProperty('--app-viewport-height', `${Math.round(vv.height)}px`)
  root.style.setProperty('--app-viewport-offset-top', `${Math.round(vv.offsetTop)}px`)
  root.dataset.keyboardOpen = inset > 0 ? 'true' : 'false'

  if (inset > 0) {
    root.style.setProperty('--app-safe-bottom', '0px')
  }

  return inset
}

/** Safe-area then keyboard — call on visualViewport resize/scroll and window resize. */
export function syncWebviewLayout(): void {
  syncWebviewSafeAreaMode()
  syncWebviewKeyboardInset()
}
