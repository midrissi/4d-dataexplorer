/** Browser stand-in for Node `querystring.stringify` / `querystring.parse`. */

export function stringify(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.append(key, String(value))
    }
  }
  return params.toString()
}

export function parse(input: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  const params = new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
  params.forEach((value, key) => {
    const existing = query[key]
    if (existing === undefined) {
      query[key] = value
      return
    }
    if (Array.isArray(existing)) {
      existing.push(value)
      return
    }
    query[key] = [existing, value]
  })
  return query
}
