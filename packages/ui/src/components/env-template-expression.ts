/** One filter in a Liquid-style template expression (`name` or `name:arg1,arg2`). */
export type EnvTemplateFilter = {
  name: string
  args: string[]
}

/** Parsed `{{ key | filter:args | … }}` interior (without braces). */
export type EnvTemplateExpression = {
  key: string
  filters: EnvTemplateFilter[]
}

/**
 * Parse the interior of `{{…}}` into a base key and optional pipe filters.
 * Returns `null` when the key is empty after trim.
 *
 * Examples:
 * - `baseUrl` → `{ key: 'baseUrl', filters: [] }`
 * - `$faker.number.int | between:1,10` → `{ key: '$faker.number.int', filters: [{ name: 'between', args: ['1','10'] }] }`
 * - ` name | upper ` → `{ key: 'name', filters: [{ name: 'upper', args: [] }] }`
 */
export function parseTemplateExpression(inner: string): EnvTemplateExpression | null {
  const trimmed = inner.trim()
  if (!trimmed) return null

  const parts = trimmed.split('|').map((part) => part.trim())
  const key = parts[0] ?? ''
  if (!key) return null

  const filters: EnvTemplateFilter[] = []
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    const colon = part.indexOf(':')
    if (colon === -1) {
      filters.push({ name: part, args: [] })
      continue
    }
    const name = part.slice(0, colon).trim()
    if (!name) continue
    const argsRaw = part.slice(colon + 1)
    const args = argsRaw
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
    filters.push({ name, args })
  }

  return { key, filters }
}

/** Base variable key from a brace interior (strips `| filters`). */
export function getEnvTemplateBaseKey(inner: string): string {
  return parseTemplateExpression(inner)?.key ?? inner.trim()
}
