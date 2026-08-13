/** True when the user holds ⌘ (macOS) or Ctrl (Windows/Linux) during a click. */
export function isModClick(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}
