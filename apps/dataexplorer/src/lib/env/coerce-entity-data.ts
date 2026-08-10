/** Attribute types that should be sent as JSON numbers after template resolve. */
const NUMBER_ATTR_TYPES = new Set(['number', 'long', 'long64', 'word', 'byte'])

export function isNumberAttrType(type: string): boolean {
  return NUMBER_ATTR_TYPES.has(type) || type.startsWith('number')
}

/** True when the string still has an unfinished or complete `{{…}}` token. */
export function stringHasEnvTemplate(value: string): boolean {
  return value.includes('{{')
}

/**
 * Normalize a resolved string to `YYYY-MM-DD` for 4D date attributes.
 * Accepts date-only, ISO datetime, and Date.parse-able values (e.g. Postman date vars).
 */
export function toDateOnlyString(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10)
  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * After `resolveEnvDeep`, coerce string leaves to numbers/dates/bools using schema types.
 * Leaves non-matching strings unchanged so the API can still reject invalid input.
 */
export function coerceEntityDataBySchema(
  data: Record<string, unknown>,
  attributes: ReadonlyArray<{ name: string; type: string }>
): Record<string, unknown> {
  const typeByName = new Map(attributes.map((attr) => [attr.name, attr.type]))
  const out: Record<string, unknown> = { ...data }

  for (const [key, value] of Object.entries(data)) {
    const type = typeByName.get(key)
    if (!type || typeof value !== 'string') continue
    if (stringHasEnvTemplate(value)) continue

    if (isNumberAttrType(type)) {
      const trimmed = value.trim()
      if (trimmed === '') {
        out[key] = null
        continue
      }
      const num = Number(trimmed)
      if (Number.isFinite(num)) out[key] = num
      continue
    }

    if (type === 'date') {
      const dateOnly = toDateOnlyString(value)
      if (dateOnly) out[key] = dateOnly
      continue
    }

    if (type === 'bool') {
      const lower = value.trim().toLowerCase()
      if (lower === 'true') out[key] = true
      else if (lower === 'false') out[key] = false
    }
  }

  return out
}

/**
 * Prepare form values before submit: coerce plain number/date strings, keep templates as strings.
 */
export function prepareEntityFormData(
  data: Record<string, unknown>,
  attributes: ReadonlyArray<{ name: string; type: string }>
): Record<string, unknown> {
  return coerceEntityDataBySchema(data, attributes)
}
