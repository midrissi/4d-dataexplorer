export function countEntityFields(obj: unknown, depth = 0): { fields: number; depth: number } {
  if (obj === null || typeof obj !== 'object') {
    return { fields: 0, depth }
  }
  const entries = Array.isArray(obj) ? obj : Object.values(obj)
  let totalFields = entries.length
  let maxDepth = depth

  for (const value of entries) {
    if (value !== null && typeof value === 'object') {
      const nested = countEntityFields(value, depth + 1)
      totalFields += nested.fields
      maxDepth = Math.max(maxDepth, nested.depth)
    }
  }
  return { fields: totalFields, depth: maxDepth }
}
