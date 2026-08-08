/**
 * Parse Method Executor wrapper JSON.
 * Empty / whitespace → undefined (POST body stays a bare params array).
 * Otherwise must be a plain object (not array / null / scalar).
 */
export function parseWrapperText(text?: string): Record<string, unknown> | undefined {
  const trimmed = text?.trim()
  if (!trimmed) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('INVALID_WRAPPER_JSON')
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('INVALID_WRAPPER_OBJECT')
  }

  return parsed as Record<string, unknown>
}
