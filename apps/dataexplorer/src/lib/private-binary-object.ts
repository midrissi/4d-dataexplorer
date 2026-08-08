/** The reserved key 4D uses to serialise a binary/blob value inside an object. */
export const PRIVATE_BINARY_OBJECT_KEY = '__PRIVATE_BINARY_OBJECT'

/**
 * Detect whether a value is a 4D private binary object, i.e. an object whose
 * single property is {@link PRIVATE_BINARY_OBJECT_KEY} holding a base64 string.
 */
export function isPrivateBinaryObject(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return (
    keys.length === 1 &&
    keys[0] === PRIVATE_BINARY_OBJECT_KEY &&
    typeof (value as Record<string, unknown>)[PRIVATE_BINARY_OBJECT_KEY] === 'string'
  )
}
