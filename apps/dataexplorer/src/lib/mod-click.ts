/** True when the user holds ⌘ (macOS) or Ctrl (Windows/Linux) during a click. */
export function isModClick(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}

/** True when ⌘/Ctrl is held together with Shift (e.g. open in HTTP Client). */
export function isModShiftClick(event: {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}): boolean {
  return isModClick(event) && event.shiftKey
}
