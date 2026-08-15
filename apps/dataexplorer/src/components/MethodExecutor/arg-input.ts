import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

export const ARG_INPUT_ATTR = 'data-method-arg-input'

type ArgumentFlush = () => void
export const pendingArgumentFlushes = new Set<ArgumentFlush>()

/** Push any in-progress argument drafts to parent state (call before Run / Execute). */
export function flushPendingArgumentValues() {
  for (const flush of [...pendingArgumentFlushes]) flush()
}

/**
 * Live values from argument inputs currently in the DOM, keyed by param name (`:1`, `$2`, …).
 */
export function readLiveArgumentInputValues(): Record<string, string> {
  const root = document.querySelector('[data-runtime-arguments]')
  if (!root) return {}
  const values: Record<string, string> = {}
  for (const el of root.querySelectorAll<HTMLInputElement>(
    `input[${ARG_INPUT_ATTR}], textarea[${ARG_INPUT_ATTR}]`
  )) {
    const name = el.getAttribute('data-param-name')
    if (name) values[name] = el.value
  }
  return values
}

/** Tab / Shift+Tab between primary argument value inputs, skipping row chrome. */
export function handleArgInputTabNavigation(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab' || event.altKey || event.metaKey || event.ctrlKey) return
  const current = event.currentTarget
  const container = current.closest('[data-runtime-arguments]')
  if (!container) return
  const inputs = Array.from(container.querySelectorAll<HTMLElement>(`[${ARG_INPUT_ATTR}]`)).filter(
    (el) => !(el instanceof HTMLInputElement && el.disabled)
  )
  const index = inputs.indexOf(current)
  if (index < 0) return
  const next = inputs[index + (event.shiftKey ? -1 : 1)]
  if (!next) return
  event.preventDefault()
  next.focus()
  if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
    next.select()
  }
}

/** Focus a newly added argument value control once it is mounted. */
export function focusArgumentInput(paramName?: string): void {
  const focus = () => {
    const root = document.querySelector('[data-runtime-arguments]')
    if (!root) return false
    const selector = paramName
      ? `input[${ARG_INPUT_ATTR}][data-param-name="${CSS.escape(paramName)}"], textarea[${ARG_INPUT_ATTR}][data-param-name="${CSS.escape(paramName)}"], [${ARG_INPUT_ATTR}][data-param-name="${CSS.escape(paramName)}"]`
      : `input[${ARG_INPUT_ATTR}], textarea[${ARG_INPUT_ATTR}], [${ARG_INPUT_ATTR}]`
    const candidates = root.querySelectorAll<HTMLElement>(selector)
    const target = candidates[candidates.length - 1]
    if (!target) return false
    target.focus()
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select()
    }
    return true
  }

  if (focus()) return
  requestAnimationFrame(() => {
    if (focus()) return
    setTimeout(() => {
      focus()
    }, 0)
  })
}
