import type { Update } from '@tauri-apps/plugin-updater'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useDesktopUpdaterStore } from '~/store/desktop-updater'
import {
  checkForUpdate,
  checkForUpdateAtTag,
  clearSkippedUpdateVersion,
  downloadAndInstall,
  fetchChannelLatestVersion,
  getSkippedUpdateVersion,
  normalizeDesktopVersion,
  relaunchApp,
  setSkippedUpdateVersion,
} from '~desktop/lib/updater'

/** How long to wait after launch before the first background update check (ms). */
const INITIAL_CHECK_DELAY = 4000
/** Interval between periodic background update checks (ms). */
const RECHECK_INTERVAL = 10 * 60 * 1000

/**
 * Headless desktop updater. Owns the Tauri {@link Update} handle and mirrors
 * serializable state into {@link useDesktopUpdaterStore} for the status-bar UI.
 */
export function DesktopUpdaterController() {
  const updateRef = useRef<Update | null>(null)
  const checkingRef = useRef(false)
  const phase = useDesktopUpdaterStore((s) => s.phase)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const checkRequestId = useDesktopUpdaterStore((s) => s.checkRequestId)
  const installRequestId = useDesktopUpdaterStore((s) => s.installRequestId)
  const relaunchRequestId = useDesktopUpdaterStore((s) => s.relaunchRequestId)
  const skipRequestId = useDesktopUpdaterStore((s) => s.skipRequestId)
  const unskipRequestId = useDesktopUpdaterStore((s) => s.unskipRequestId)

  const lastCheckReq = useRef(0)
  const lastInstallReq = useRef(0)
  const lastRelaunchReq = useRef(0)
  const lastSkipReq = useRef(0)
  const lastUnskipReq = useRef(0)

  const replaceUpdate = useEffectEvent(async (next: Update | null) => {
    const prev = updateRef.current
    updateRef.current = next
    if (prev && prev !== next) {
      try {
        await prev.close()
      } catch {
        // Resource may already be consumed after install.
      }
    }
  })

  const runCheck = useEffectEvent(async () => {
    const currentPhase = phaseRef.current
    if (checkingRef.current || currentPhase === 'downloading' || currentPhase === 'ready') {
      return
    }

    checkingRef.current = true
    useDesktopUpdaterStore.getState().applySnapshot({
      phase: 'checking',
      error: null,
      progress: null,
    })

    try {
      const [found, channelLatest] = await Promise.all([
        checkForUpdate(),
        fetchChannelLatestVersion(),
      ])
      const skipped = getSkippedUpdateVersion()
      const checkedAt = Date.now()

      if (found) {
        await replaceUpdate(found)
        const channel = channelLatest ?? found.version
        if (skipped === found.version) {
          useDesktopUpdaterStore.getState().applySnapshot({
            phase: 'skipped',
            currentVersion: found.currentVersion,
            latestVersion: found.version,
            channelLatestVersion: channel,
            releaseNotes: found.body ?? null,
            progress: null,
            error: null,
            lastCheckedAt: checkedAt,
            skippedVersion: skipped,
            installingVersion: null,
          })
          return
        }
        if (skipped && skipped !== found.version) {
          clearSkippedUpdateVersion()
        }
        useDesktopUpdaterStore.getState().applySnapshot({
          phase: 'available',
          currentVersion: found.currentVersion,
          latestVersion: found.version,
          channelLatestVersion: channel,
          releaseNotes: found.body ?? null,
          progress: null,
          error: null,
          lastCheckedAt: checkedAt,
          skippedVersion: null,
          installingVersion: null,
        })
        return
      }

      await replaceUpdate(null)
      // Tauri said the remote tip matches this build. Prefer that over a
      // separately fetched latest.json (CDN can lag) so the UI never proposes
      // "Install latest" while the status bar says up to date.
      const current = normalizeDesktopVersion(
        useDesktopUpdaterStore.getState().currentVersion || ''
      )
      const fetchedTip = channelLatest ? normalizeDesktopVersion(channelLatest) : null
      const tip =
        fetchedTip && current && fetchedTip === current ? fetchedTip : current || fetchedTip
      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'up-to-date',
        latestVersion: null,
        channelLatestVersion: tip,
        releaseNotes: null,
        progress: null,
        error: null,
        lastCheckedAt: checkedAt,
        skippedVersion: skipped,
        installingVersion: null,
      })
    } catch (err) {
      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
        progress: null,
        lastCheckedAt: Date.now(),
        installingVersion: null,
      })
    } finally {
      checkingRef.current = false
    }
  })

  const runInstall = useEffectEvent(async () => {
    if (phaseRef.current === 'downloading') return

    clearSkippedUpdateVersion()

    const targetVersion = useDesktopUpdaterStore.getState().installTargetVersion

    try {
      if (targetVersion) {
        const normalized = normalizeDesktopVersion(targetVersion)
        useDesktopUpdaterStore.getState().applySnapshot({
          phase: 'checking',
          error: null,
          progress: null,
          installingVersion: normalized,
        })
        const tagged = await checkForUpdateAtTag(normalized)
        if (!tagged) {
          throw new Error(
            `No installable package found for v${normalized}. This build may be missing an updater manifest.`
          )
        }
        await replaceUpdate(tagged)
      } else if (!updateRef.current) {
        await runCheck()
      }

      const update = updateRef.current
      if (!update) return

      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'downloading',
        error: null,
        progress: { downloaded: 0, contentLength: null },
        skippedVersion: null,
        latestVersion: update.version,
        installingVersion: update.version,
        currentVersion: update.currentVersion,
        releaseNotes: update.body ?? null,
      })

      await downloadAndInstall(update, (progress) => {
        useDesktopUpdaterStore.getState().applySnapshot({ progress })
      })
      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'ready',
        progress: null,
        error: null,
      })
    } catch (err) {
      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
        progress: null,
        installingVersion: null,
      })
    }
  })

  const runRelaunch = useEffectEvent(async () => {
    try {
      await relaunchApp()
    } catch (err) {
      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  const runSkip = useEffectEvent(() => {
    const update = updateRef.current
    const version = update?.version ?? useDesktopUpdaterStore.getState().latestVersion
    if (!version) return
    if (phaseRef.current === 'downloading' || phaseRef.current === 'ready') return

    setSkippedUpdateVersion(version)
    useDesktopUpdaterStore.getState().applySnapshot({
      phase: 'skipped',
      skippedVersion: version,
      error: null,
    })
  })

  const runUnskip = useEffectEvent(() => {
    const update = updateRef.current
    clearSkippedUpdateVersion()
    if (update) {
      useDesktopUpdaterStore.getState().applySnapshot({
        phase: 'available',
        latestVersion: update.version,
        channelLatestVersion:
          useDesktopUpdaterStore.getState().channelLatestVersion ?? update.version,
        releaseNotes: update.body ?? null,
        skippedVersion: null,
        error: null,
      })
      return
    }
    useDesktopUpdaterStore.getState().applySnapshot({
      phase: 'idle',
      skippedVersion: null,
      latestVersion: null,
      releaseNotes: null,
    })
    void runCheck()
  })

  // Seed skipped version from storage so the footer can reflect it before the first check.
  useEffect(() => {
    const skipped = getSkippedUpdateVersion()
    if (skipped) {
      useDesktopUpdaterStore.getState().applySnapshot({ skippedVersion: skipped })
    }
  }, [])

  useEffect(() => {
    const initial = setTimeout(() => void runCheck(), INITIAL_CHECK_DELAY)
    const interval = setInterval(() => void runCheck(), RECHECK_INTERVAL)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (checkRequestId === lastCheckReq.current) return
    lastCheckReq.current = checkRequestId
    if (checkRequestId === 0) return
    void runCheck()
  }, [checkRequestId])

  useEffect(() => {
    if (installRequestId === lastInstallReq.current) return
    lastInstallReq.current = installRequestId
    if (installRequestId === 0) return
    void runInstall()
  }, [installRequestId])

  useEffect(() => {
    if (relaunchRequestId === lastRelaunchReq.current) return
    lastRelaunchReq.current = relaunchRequestId
    if (relaunchRequestId === 0) return
    void runRelaunch()
  }, [relaunchRequestId])

  useEffect(() => {
    if (skipRequestId === lastSkipReq.current) return
    lastSkipReq.current = skipRequestId
    if (skipRequestId === 0) return
    runSkip()
  }, [skipRequestId])

  useEffect(() => {
    if (unskipRequestId === lastUnskipReq.current) return
    lastUnskipReq.current = unskipRequestId
    if (unskipRequestId === 0) return
    runUnskip()
  }, [unskipRequestId])

  return null
}
