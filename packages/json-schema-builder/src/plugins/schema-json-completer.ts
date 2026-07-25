/**
 * Schema-based autocomplete for the "Example to test" JSON editor.
 * Suggests property names from schema.properties and values from enum/boolean type.
 */

type SchemaLike = {
  type?: string
  properties?: Record<string, SchemaLike>
  items?: SchemaLike | SchemaLike[]
  enum?: unknown[]
  const?: unknown
  oneOf?: SchemaLike[]
  anyOf?: SchemaLike[]
  allOf?: SchemaLike[]
  $ref?: string
  [key: string]: unknown
}

export type CompletionItem = { value: string; caption?: string; meta?: string; score?: number }

/**
 * Brace depth (object/array) and completion context before cursor.
 */
function getContextAndDepth(
  text: string,
  row: number,
  column: number
): { context: 'key' | 'value'; depth: number } | null {
  const lines = text.split('\n')
  if (row < 0 || row >= lines.length) return null
  const line = lines[row]
  const beforeCursor = (line.slice(0, column) + lines.slice(0, row).join('\n')).trim()

  let depth = 0
  let inString = false
  let isEscaped = false
  let quoteChar = ''
  for (let i = 0; i < beforeCursor.length; i++) {
    const c = beforeCursor[i]
    if (isEscaped) {
      isEscaped = false
      continue
    }
    if (inString) {
      if (c === '\\') isEscaped = true
      else if (c === quoteChar) inString = false
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      quoteChar = c
      continue
    }
    if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') depth--
  }

  const lastNonSpace = beforeCursor.replace(/\s*$/, '').slice(-1)
  const lastFew = beforeCursor.replace(/\s*$/, '').slice(-3)

  if (lastNonSpace === ':' || lastFew.endsWith('":')) return { context: 'value', depth }
  return { context: 'key', depth }
}

/**
 * Get the key we're currently assigning (for value completion). Scan backward for "key":
 */
function getCurrentKey(text: string, row: number, column: number): string | null {
  const lines = text.split('\n')
  const currentLine = lines[row] ?? ''
  const beforeCursor = lines.slice(0, row).join('\n') + currentLine.slice(0, column)
  const match = beforeCursor.match(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*$/)
  return match ? match[1].replace(/\\"/g, '"') : null
}

/**
 * Get properties from schema (handle object type and $ref placeholder).
 */
function getObjectProperties(schema: SchemaLike | null): Record<string, SchemaLike> | null {
  if (!schema || typeof schema !== 'object') return null
  if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
    return schema.properties
  }
  return null
}

/**
 * Get effective type or enum from a schema (simple: no $ref resolution).
 */
function getValueSuggestions(schema: SchemaLike | null): CompletionItem[] {
  if (!schema || typeof schema !== 'object') return []
  const out: CompletionItem[] = []
  if (Array.isArray(schema.enum)) {
    for (const v of schema.enum) {
      const val = typeof v === 'string' ? JSON.stringify(v) : String(v)
      out.push({ value: val, meta: 'enum', score: 100 })
    }
  }
  if (schema.const !== undefined) {
    const val =
      typeof schema.const === 'string' ? JSON.stringify(schema.const) : String(schema.const)
    out.push({ value: val, meta: 'const', score: 101 })
  }
  const type = schema.type
  if (type === 'boolean') {
    out.push({ value: 'true', meta: 'boolean', score: 50 })
    out.push({ value: 'false', meta: 'boolean', score: 50 })
  }
  if (type === 'null') {
    out.push({ value: 'null', meta: 'null', score: 50 })
  }
  return out
}

/**
 * Get keys already present at root in the JSON text (best effort).
 */
function getPresentRootKeys(text: string): Set<string> {
  const keys = new Set<string>()
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const k of Object.keys(parsed)) keys.add(k)
    }
  } catch {
    // Invalid JSON: find keys at top level by tracking brace depth
    let depth = 0
    let inStr = false
    let isEscaped = false
    let q = ''
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (isEscaped) {
        isEscaped = false
        continue
      }
      if (inStr) {
        if (c === '\\') isEscaped = true
        else if (c === q) inStr = false
        continue
      }
      if (c === '"' || c === "'") {
        inStr = true
        q = c
        continue
      }
      if (c === '{' || c === '[') depth++
      else if (c === '}' || c === ']') depth--
      if (depth === 1 && c === '"') {
        const rest = text.slice(i)
        const m = rest.match(/^"([^"]+)"\s*:/)
        if (m) keys.add(m[1])
      }
    }
  }
  return keys
}

/**
 * Compute completions for the example JSON editor based on the schema.
 */
export function getSchemaCompletions(
  schemaText: string,
  exampleText: string,
  row: number,
  column: number
): CompletionItem[] {
  let schema: SchemaLike | null = null
  try {
    schema = JSON.parse(schemaText) as SchemaLike
  } catch {
    return []
  }
  const ctx = getContextAndDepth(exampleText, row, column)
  if (!ctx) return []

  if (ctx.context === 'key') {
    if (ctx.depth !== 1) return []
    const props = getObjectProperties(schema)
    if (!props) return []
    const present = getPresentRootKeys(exampleText)
    const items: CompletionItem[] = []
    for (const key of Object.keys(props)) {
      if (present.has(key)) continue
      const propSchema = props[key]
      const type =
        propSchema && typeof propSchema === 'object' && 'type' in propSchema
          ? String((propSchema as { type?: string }).type)
          : '?'
      items.push({
        value: `"${key.replace(/"/g, '\\"')}"`,
        caption: key,
        meta: type,
        score: 90,
      })
    }
    return items
  }

  if (ctx.context !== 'value') return []
  if (ctx.depth !== 1) return []
  const currentKey = getCurrentKey(exampleText, row, column)
  if (!currentKey) return []
  const props = getObjectProperties(schema)
  if (!props || !(currentKey in props)) return []
  const propSchema = props[currentKey] as SchemaLike
  return getValueSuggestions(propSchema)
}
