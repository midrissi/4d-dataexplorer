/** Convert inventory `{param}` placeholders to Postman `{{param}}`. */
export function toPostmanPath(path: string): string {
  return path.replace(/\{([^{}]+)\}/g, '{{$1}}')
}

export function pathParamNames(path: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of path.matchAll(/\{([^{}]+)\}/g)) {
    const name = match[1]
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}
