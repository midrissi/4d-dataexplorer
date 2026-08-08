import type { KeyboardShortcut } from '~/store/settings'

/**
 * Calculate checkbox state for a list of shortcuts.
 * Returns true (all enabled), false (none enabled), or 'indeterminate' (some enabled).
 */
export function getShortcutsCheckState(shortcuts: KeyboardShortcut[]): boolean | 'indeterminate' {
  const enabledCount = shortcuts.filter((s) => s.enabled).length
  if (enabledCount === 0) return false
  if (enabledCount === shortcuts.length) return true
  return 'indeterminate'
}
