/** Ref-count lock so Shortcut Radar can own chords even if focus reports as BODY. */
let shortcutCaptureLocks = 0

export function acquireShortcutCaptureLock(): () => void {
  shortcutCaptureLocks += 1
  return () => {
    shortcutCaptureLocks = Math.max(0, shortcutCaptureLocks - 1)
  }
}

export function isShortcutCaptureLocked(): boolean {
  return shortcutCaptureLocks > 0
}
