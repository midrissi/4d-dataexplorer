import { afterEach, describe, expect, test } from 'bun:test'
import { getOnlineStatus, subscribeOnlineStatus } from './online-status'

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('online-status', () => {
  afterEach(() => {
    setNavigatorOnline(true)
  })

  test('getOnlineStatus reads navigator.onLine', () => {
    setNavigatorOnline(true)
    expect(getOnlineStatus()).toBe(true)
    setNavigatorOnline(false)
    expect(getOnlineStatus()).toBe(false)
  })

  test('notifies subscribers on online and offline events', () => {
    setNavigatorOnline(true)
    let calls = 0
    const unsub = subscribeOnlineStatus(() => {
      calls += 1
    })

    setNavigatorOnline(false)
    window.dispatchEvent(new Event('offline'))
    expect(calls).toBe(1)
    expect(getOnlineStatus()).toBe(false)

    setNavigatorOnline(true)
    window.dispatchEvent(new Event('online'))
    expect(calls).toBe(2)
    expect(getOnlineStatus()).toBe(true)

    unsub()
    window.dispatchEvent(new Event('offline'))
    expect(calls).toBe(2)
  })
})
