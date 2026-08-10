/** Auto-fetch all entity counts when the catalog has fewer dataclasses than this. */
export const AUTO_COUNT_THRESHOLD = 50

/** Default in-flight limit for batched count requests. */
export const COUNT_FETCH_CONCURRENCY = 8

/**
 * Run `mapper` over `items` with at most `concurrency` promises in flight.
 * Results preserve input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}
