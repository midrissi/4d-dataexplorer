import { describe, expect, test } from 'bun:test'
import { resolveOnlineStatusChipKind } from './useOnlineStatusFlash'

describe('resolveOnlineStatusChipKind', () => {
  test('hides when online and not flashing', () => {
    expect(resolveOnlineStatusChipKind(true, false)).toBe('hidden')
  })

  test('shows offline while disconnected', () => {
    expect(resolveOnlineStatusChipKind(false, false)).toBe('offline')
    expect(resolveOnlineStatusChipKind(false, true)).toBe('offline')
  })

  test('shows online flash after reconnect', () => {
    expect(resolveOnlineStatusChipKind(true, true)).toBe('online')
  })
})
