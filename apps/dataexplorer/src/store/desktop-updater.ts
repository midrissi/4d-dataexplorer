import { create } from 'zustand'

/** Lifecycle of the desktop updater, owned by the headless controller. */
export type DesktopUpdaterPhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'skipped'
  | 'downloading'
  | 'ready'
  | 'error'

export type DesktopUpdaterProgress = {
  downloaded: number
  contentLength: number | null
}

export type DesktopUpdaterSnapshot = {
  phase: DesktopUpdaterPhase
  currentVersion: string
  /** Tip of `/releases/latest` when an update differs from the installed build. */
  latestVersion: string | null
  /**
   * Channel tip version even when the app is already on it (for the version picker).
   * Falls back to {@link latestVersion} when an update is pending.
   */
  channelLatestVersion: string | null
  releaseNotes: string | null
  progress: DesktopUpdaterProgress | null
  error: string | null
  lastCheckedAt: number | null
  skippedVersion: string | null
  /** Version currently being installed (channel tip or a picked older build). */
  installingVersion: string | null
}

type DesktopUpdaterRequests = {
  checkRequestId: number
  installRequestId: number
  /** When set with installRequestId, install this tag/version instead of the channel tip. */
  installTargetVersion: string | null
  relaunchRequestId: number
  skipRequestId: number
  unskipRequestId: number
}

type DesktopUpdaterActions = {
  /** Controller-only: replace serializable UI state. */
  applySnapshot: (patch: Partial<DesktopUpdaterSnapshot>) => void
  checkForUpdates: () => void
  /** Install the pending channel update (or re-check then install latest). */
  installUpdate: () => void
  /** Install a specific release tag/version from the catalog. */
  installVersion: (version: string) => void
  relaunchApp: () => void
  skipUpdate: () => void
  /** Clear a skipped version and treat it as available again. */
  unskipUpdate: () => void
}

export type DesktopUpdaterState = DesktopUpdaterSnapshot &
  DesktopUpdaterRequests &
  DesktopUpdaterActions

const INITIAL_SNAPSHOT: DesktopUpdaterSnapshot = {
  phase: 'idle',
  currentVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
  latestVersion: null,
  channelLatestVersion: null,
  releaseNotes: null,
  progress: null,
  error: null,
  lastCheckedAt: null,
  skippedVersion: null,
  installingVersion: null,
}

/**
 * Shared bridge between the desktop updater controller and the Layout footer.
 * Web builds never drive this store; the footer stays hidden via `isDesktop()`.
 */
export const useDesktopUpdaterStore = create<DesktopUpdaterState>((set) => ({
  ...INITIAL_SNAPSHOT,
  checkRequestId: 0,
  installRequestId: 0,
  installTargetVersion: null,
  relaunchRequestId: 0,
  skipRequestId: 0,
  unskipRequestId: 0,
  applySnapshot: (patch) => set((state) => ({ ...state, ...patch })),
  checkForUpdates: () => set((state) => ({ checkRequestId: state.checkRequestId + 1 })),
  installUpdate: () =>
    set((state) => ({
      installRequestId: state.installRequestId + 1,
      installTargetVersion: null,
    })),
  installVersion: (version) =>
    set((state) => ({
      installRequestId: state.installRequestId + 1,
      installTargetVersion: version,
    })),
  relaunchApp: () => set((state) => ({ relaunchRequestId: state.relaunchRequestId + 1 })),
  skipUpdate: () => set((state) => ({ skipRequestId: state.skipRequestId + 1 })),
  unskipUpdate: () => set((state) => ({ unskipRequestId: state.unskipRequestId + 1 })),
}))
