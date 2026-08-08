import { isShortcutCaptureLocked } from '~/lib/shortcut-capture-lock'

/**
 * Detect typing surfaces where most app shortcuts should stay quiet.
 * Monaco, textareas, and contenteditable hosts are included.
 */
export function isEditableKeyboardTarget(event: KeyboardEvent): boolean {
  const candidates: Array<EventTarget | null> = [event.target, document.activeElement]
  for (const candidate of candidates) {
    if (!(candidate instanceof Element)) continue
    if (
      candidate instanceof HTMLTextAreaElement ||
      candidate instanceof HTMLInputElement ||
      candidate instanceof HTMLSelectElement
    ) {
      return true
    }
    if (candidate instanceof HTMLElement && candidate.isContentEditable) {
      return true
    }
    if (
      candidate.closest(
        'textarea, input, select, [contenteditable="true"], [role="textbox"], [data-code-editor], [data-allow-typing], .monaco-editor, .ace_editor, .nokey'
      )
    ) {
      return true
    }
  }
  return false
}

/**
 * Surfaces that intentionally own every key chord (including Cmd/Ctrl),
 * e.g. Shortcut Radar listen/search — never run global app shortcuts there.
 */
export function isShortcutCaptureTarget(event: KeyboardEvent): boolean {
  if (isShortcutCaptureLocked()) return true
  const candidates: Array<EventTarget | null> = [event.target, document.activeElement]
  for (const candidate of candidates) {
    if (!(candidate instanceof Element)) continue
    if (candidate.closest('[data-shortcut-capture]')) return true
  }
  return false
}

/**
 * Cmd/Ctrl chords are app commands, not text input — keep them active while typing
 * (e.g. toggle terminal with ⌘J / Ctrl+J inside the Monaco REPL).
 *
 * Exception: `[data-shortcut-capture]` / capture lock always defers so chord search works.
 */
export function shouldDeferShortcutsForEditableTarget(event: KeyboardEvent): boolean {
  if (isShortcutCaptureTarget(event)) return true
  if (!isEditableKeyboardTarget(event)) return false
  return !(event.metaKey || event.ctrlKey)
}
