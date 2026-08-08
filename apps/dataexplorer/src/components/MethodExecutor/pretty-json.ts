/** Pretty-print JSON for read-only editors; falls back to `String(value)`. */
export function prettyJson(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2)
  return serialized === undefined ? String(value) : serialized
}
