import { beforeEach, describe, expect, it } from 'bun:test'
import { useDesktopUpdaterStore } from './desktop-updater'

describe('useDesktopUpdaterStore', () => {
  beforeEach(() => {
    useDesktopUpdaterStore.setState({
      phase: 'idle',
      currentVersion: '1.0.0',
      latestVersion: null,
      releaseNotes: null,
      progress: null,
      error: null,
      lastCheckedAt: null,
      skippedVersion: null,
      checkRequestId: 0,
      installRequestId: 0,
      relaunchRequestId: 0,
      skipRequestId: 0,
      unskipRequestId: 0,
    })
  })

  it('applies controller snapshots for the status bar', () => {
    useDesktopUpdaterStore.getState().applySnapshot({
      phase: 'available',
      latestVersion: '1.4.0-abc',
      currentVersion: '1.3.0',
    })
    expect(useDesktopUpdaterStore.getState()).toMatchObject({
      phase: 'available',
      latestVersion: '1.4.0-abc',
      currentVersion: '1.3.0',
    })

    useDesktopUpdaterStore.getState().applySnapshot({ phase: 'ready' })
    expect(useDesktopUpdaterStore.getState().phase).toBe('ready')
  })

  it('queues user actions for the desktop controller', () => {
    const store = useDesktopUpdaterStore.getState()
    store.checkForUpdates()
    store.installUpdate()
    store.relaunchApp()
    store.skipUpdate()
    store.unskipUpdate()

    expect(useDesktopUpdaterStore.getState()).toMatchObject({
      checkRequestId: 1,
      installRequestId: 1,
      relaunchRequestId: 1,
      skipRequestId: 1,
      unskipRequestId: 1,
    })
  })
})
