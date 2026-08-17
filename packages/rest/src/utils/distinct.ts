/** Normalize a 4D `$distinct` payload into scalar values for one attribute. */
export function parseDistinctResponse(result: unknown, attribute: string): unknown[] {
  if (Array.isArray(result)) return unwrapDistinctItems(result, attribute)
  if (!result || typeof result !== 'object') return []
  const record = result as Record<string, unknown>
  // 4D error payloads use `__ERROR: [...]` — never treat that as distinct values.
  if (Array.isArray(record.__ERROR)) return []
  if (Array.isArray(record.__ENTITIES)) return unwrapDistinctItems(record.__ENTITIES, attribute)
  const named = record[attribute]
  if (Array.isArray(named)) return unwrapDistinctItems(named, attribute)
  return []
}

function unwrapDistinctItems(items: unknown[], attribute: string): unknown[] {
  return items.map((item) => unwrapDistinctItem(item, attribute))
}

function unwrapDistinctItem(item: unknown, attribute: string): unknown {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  const record = item as Record<string, unknown>
  if (attribute in record) return record[attribute]
  if ('__KEY' in record) return record.__KEY
  return item
}
