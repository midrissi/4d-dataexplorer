import { invoke } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import {
  type DesktopReleaseRef,
  fetchChannelLatestVersion,
  listDesktopReleases,
  normalizeDesktopVersion,
} from '~/lib/desktop-releases'
import { isDesktop } from '~/lib/platform'

export type { DesktopReleaseRef }
export { fetchChannelLatestVersion, listDesktopReleases, normalizeDesktopVersion }

/**
 * Thin wrapper around the Tauri updater/process plugins.
 *
 * Updater/process plugins are imported lazily so unused desktop features stay
 * out of the critical path. `@tauri-apps/api/core` is already in the desktop
 * bundle (HTTP bridge), so `invoke` is a static import.
 */

export type DownloadProgress = {
  /** Bytes downloaded so far. */
  downloaded: number
  /** Total bytes to download, when the server advertised a content length. */
  contentLength: number | null
}

/**
 * Check the configured release endpoint for a newer version.
 *
 * @returns the pending {@link Update} when one is available, otherwise `null`.
 */
export async function checkForUpdate(): Promise<Update | null> {
  if (!isDesktop()) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  // Releases are stamped `<semver>-<gitsha>`. SemVer treats that as a
  // prerelease (so 1.3.3-abc < 1.3.3), and SHAs are not ordered — accept any
  // different remote version; `/releases/latest` is the source of truth.
  // Prefer octet-stream so GitHub Releases does not serve a stale
  // Accept: application/json CDN mapping after latest.json is replaced.
  return check({
    allowDowngrades: true,
    headers: { Accept: 'application/octet-stream' },
  })
}

/**
 * Resolve an installable update for a specific GitHub release tag.
 * Supports upgrades, downgrades, and reinstall of the same version.
 */
export async function checkForUpdateAtTag(tagOrVersion: string): Promise<Update | null> {
  if (!isDesktop()) return null
  const { Update } = await import('@tauri-apps/plugin-updater')

  const metadata = await invoke<{
    rid: number
    currentVersion: string
    version: string
    date?: string
    body?: string
    rawJson: Record<string, unknown>
  } | null>('check_desktop_update_for_tag', {
    tag: normalizeDesktopVersion(tagOrVersion),
  })

  return metadata ? new Update(metadata) : null
}

/**
 * Download and install a pending update, reporting byte-level progress.
 *
 * The caller is responsible for prompting the user beforehand and for calling
 * {@link relaunchApp} afterwards once the install has finished.
 */
export async function downloadAndInstall(
  update: Update,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  let contentLength: number | null = null
  let downloaded = 0

  await update.downloadAndInstall(
    (event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? null
          downloaded = 0
          onProgress?.({ downloaded, contentLength })
          break
        case 'Progress':
          downloaded += event.data.chunkLength
          onProgress?.({ downloaded, contentLength })
          break
        case 'Finished':
          onProgress?.({ downloaded: contentLength ?? downloaded, contentLength })
          break
      }
    },
    { headers: { Accept: 'application/octet-stream' } }
  )
}

/** Relaunch the application so the freshly installed update takes effect. */
export async function relaunchApp(): Promise<void> {
  if (!isDesktop()) return
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

const SKIPPED_UPDATE_KEY = 'desktop-updater:skipped-version'

/** Version the user chose to permanently skip (until a different release). */
export function getSkippedUpdateVersion(): string | null {
  try {
    return localStorage.getItem(SKIPPED_UPDATE_KEY)
  } catch {
    return null
  }
}

/** Persist a skipped update version so background prompts stay quiet. */
export function setSkippedUpdateVersion(version: string): void {
  try {
    localStorage.setItem(SKIPPED_UPDATE_KEY, version)
  } catch {
    // Private mode / quota — skip persistence; in-memory dismiss still works.
  }
}

/** Clear a skipped version (e.g. after the user updates or a new release appears). */
export function clearSkippedUpdateVersion(): void {
  try {
    localStorage.removeItem(SKIPPED_UPDATE_KEY)
  } catch {
    // ignore
  }
}
