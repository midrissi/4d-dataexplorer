import { isMobileShell } from '~/lib/platform'
import { useAiTasksStore } from '~/store/ai-tasks'
import { useSettingsStore } from '~/store/settings'

/**
 * Mobile dock overlays that should be mutually exclusive.
 * Opening one dismisses the others (console ↔ dataclasses catalog ↔ AI tasks).
 */
export type MobileOverlayId = 'console' | 'catalog' | 'aiHistory'

let closeCatalogFn: (() => void) | null = null

/** Registered by {@link MobileCatalogProvider} so store openers can dismiss the catalog. */
export function registerMobileCatalogCloser(fn: (() => void) | null): void {
  closeCatalogFn = fn
}

/**
 * Close every mobile overlay except `except`. No-op outside the mobile shell
 * so desktop console / AI history stay independent.
 *
 * Uses `setState` (not action setters) so we do not re-enter prepare when
 * settings/ai-tasks open paths also call this helper.
 */
export function prepareMobileOverlay(except: MobileOverlayId): void {
  if (!isMobileShell()) return

  if (except !== 'console') {
    useSettingsStore.setState({ consoleOpen: false })
  }
  if (except !== 'aiHistory') {
    useAiTasksStore.setState({ historyOpen: false, selectedTaskId: null })
  }
  if (except !== 'catalog') {
    closeCatalogFn?.()
  }
}
