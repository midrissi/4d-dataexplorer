/** Max nodes (objects/arrays/primitives) allowed before expand-all is blocked. */
export const EXPAND_ALL_MAX_NODES = 250

/**
 * Count nodes in a JSON-like value, stopping once `limit` is reached.
 * Circular references are skipped.
 */
export function countObjectTreeNodes(value: unknown, limit = EXPAND_ALL_MAX_NODES): number {
  let count = 0

  const visit = (current: unknown, ancestors: Set<object>) => {
    if (count >= limit) return
    count += 1
    if (current === null || typeof current !== 'object') return
    if (ancestors.has(current)) return

    const next = new Set(ancestors)
    next.add(current)

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item, next)
        if (count >= limit) return
      }
      return
    }

    for (const key of Object.keys(current as object)) {
      visit((current as Record<string, unknown>)[key], next)
      if (count >= limit) return
    }
  }

  visit(value, new Set())
  return count
}

/** True when expanding the whole tree would exceed {@link EXPAND_ALL_MAX_NODES}. */
export function isObjectTreeTooLarge(value: unknown, maxNodes = EXPAND_ALL_MAX_NODES): boolean {
  return countObjectTreeNodes(value, maxNodes + 1) > maxNodes
}
