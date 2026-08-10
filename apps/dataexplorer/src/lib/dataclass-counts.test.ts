import { describe, expect, test } from 'bun:test'
import {
  AUTO_COUNT_THRESHOLD,
  COUNT_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from './dataclass-counts'

describe('mapWithConcurrency', () => {
  test('preserves order with limited concurrency', async () => {
    const started: number[] = []
    const maxInFlight = { current: 0, peak: 0 }

    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      started.push(n)
      maxInFlight.current += 1
      maxInFlight.peak = Math.max(maxInFlight.peak, maxInFlight.current)
      await Bun.sleep(5)
      maxInFlight.current -= 1
      return n * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50, 60])
    expect(maxInFlight.peak).toBeLessThanOrEqual(2)
    expect(started).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('returns empty array for empty input', async () => {
    expect(await mapWithConcurrency([], 4, async (n) => n)).toEqual([])
  })
})

describe('AUTO_COUNT_THRESHOLD', () => {
  test('auto-loads only below 50 dataclasses', () => {
    expect(AUTO_COUNT_THRESHOLD).toBe(50)
    expect(49 < AUTO_COUNT_THRESHOLD).toBe(true)
    expect(50 < AUTO_COUNT_THRESHOLD).toBe(false)
    expect(COUNT_FETCH_CONCURRENCY).toBeGreaterThan(0)
  })
})
