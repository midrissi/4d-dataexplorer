import { parseCsv, stringifyCsv } from '~/lib/csv'
import {
  cellToString,
  coerceCellValue,
  escapeXml,
  inferColumns,
  projectRows,
  sqlLiteral,
} from './helpers'
import type { EntityIoContext, EntityIoFormat } from './types'

function resolveColumns(rows: Record<string, unknown>[], ctx: EntityIoContext): string[] {
  if (ctx.columns?.length) return ctx.columns
  return inferColumns(rows)
}

function rowsFromTable(headers: string[], tableRows: string[][]): Record<string, unknown>[] {
  return tableRows.map((cells) => {
    const row: Record<string, unknown> = {}
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i]
      if (!key) continue
      row[key] = coerceCellValue(cells[i] ?? '')
    }
    return row
  })
}

const jsonFormat: EntityIoFormat = {
  id: 'json',
  extensions: ['json'],
  mime: 'application/json',
  language: 'json',
  capabilities: { export: true, import: true },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    return `${JSON.stringify(projectRows(rows, cols), null, 2)}\n`
  },
  parse(text) {
    const data = JSON.parse(text) as unknown
    if (Array.isArray(data)) {
      return data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    }
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      if (Array.isArray(obj.__ENTITIES)) {
        return obj.__ENTITIES.filter(
          (r): r is Record<string, unknown> => !!r && typeof r === 'object'
        )
      }
      return [obj]
    }
    throw new Error('JSON root must be an array or object')
  },
}

const jsonRestFormat: EntityIoFormat = {
  id: 'json-rest',
  extensions: ['json'],
  mime: 'application/json',
  language: 'json',
  capabilities: { export: true, import: true },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    return `${JSON.stringify(
      {
        __DATACLASS: ctx.dataclassName,
        __COUNT: rows.length,
        __ENTITIES: projectRows(rows, cols),
      },
      null,
      2
    )}\n`
  },
  parse(text) {
    return jsonFormat.parse?.(text, { dataclassName: '' }) ?? []
  },
}

const jsonlFormat: EntityIoFormat = {
  id: 'jsonl',
  extensions: ['jsonl', 'ndjson'],
  mime: 'application/x-ndjson',
  // One JSON document per line: the json mode would report every line after the first as invalid.
  language: 'plaintext',
  capabilities: { export: true, import: true },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    return `${projectRows(rows, cols)
      .map((r) => JSON.stringify(r))
      .join('\n')}\n`
  },
  parse(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.map((line, i) => {
      try {
        const v = JSON.parse(line) as unknown
        if (!v || typeof v !== 'object' || Array.isArray(v)) {
          throw new Error(`Line ${i + 1} is not an object`)
        }
        return v as Record<string, unknown>
      } catch (err) {
        throw new Error(
          `Invalid JSONL at line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    })
  },
}

function makeDelimitedFormat(
  id: 'csv' | 'tsv',
  delim: ',' | '\t',
  extensions: string[],
  mime: string
): EntityIoFormat {
  return {
    id,
    extensions,
    mime,
    language: 'plaintext',
    capabilities: { export: true, import: true },
    serialize(rows, ctx) {
      const cols = resolveColumns(rows, ctx)
      const table = projectRows(rows, cols).map((r) => cols.map((c) => cellToString(r[c])))
      return stringifyCsv(cols, table, delim)
    },
    parse(text) {
      const table = parseCsv(text)
      if (!table) throw new Error(`Empty or invalid ${id.toUpperCase()}`)
      return rowsFromTable(table.headers, table.rows)
    },
  }
}

const csvFormat = makeDelimitedFormat('csv', ',', ['csv'], 'text/csv')
const tsvFormat = makeDelimitedFormat('tsv', '\t', ['tsv', 'txt'], 'text/tab-separated-values')

const sqlFormat: EntityIoFormat = {
  id: 'sql',
  extensions: ['sql'],
  mime: 'application/sql',
  language: 'sql',
  capabilities: { export: true, import: true },
  serialize(rows, ctx) {
    if (rows.length === 0) return `-- no rows for ${ctx.dataclassName}\n`
    const cols = resolveColumns(rows, ctx)
    const table = `"${ctx.dataclassName.replace(/"/g, '""')}"`
    const colList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ')
    return `${rows
      .map((row) => {
        const values = cols.map((c) => sqlLiteral(row[c])).join(', ')
        return `INSERT INTO ${table} (${colList}) VALUES (${values});`
      })
      .join('\n')}\n`
  },
  parse(text) {
    const rows: Record<string, unknown>[] = []
    // INSERT INTO "Table" ("a", "b") VALUES (1, 'x');
    const re = /INSERT\s+INTO\s+(?:"([^"]+)"|(\w+))\s*\(([^)]+)\)\s*VALUES\s*\(([^;]+)\)\s*;?/gi
    for (let match = re.exec(text); match !== null; match = re.exec(text)) {
      const colsRaw = match[3] ?? ''
      const valsRaw = match[4] ?? ''
      const cols = colsRaw.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''))
      const vals = splitSqlValues(valsRaw)
      const row: Record<string, unknown> = {}
      for (let i = 0; i < cols.length; i++) {
        const key = cols[i]
        if (!key) continue
        row[key] = parseSqlLiteral(vals[i] ?? 'NULL')
      }
      rows.push(row)
    }
    if (rows.length === 0) throw new Error('No INSERT statements found')
    return rows
  },
}

function splitSqlValues(raw: string): string[] {
  const parts: string[] = []
  let cur = ''
  let inStr = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (ch === "'" && raw[i + 1] === "'") {
        cur += "''"
        i += 1
        continue
      }
      if (ch === "'") {
        inStr = false
        cur += ch
        continue
      }
      cur += ch
      continue
    }
    if (ch === "'") {
      inStr = true
      cur += ch
      continue
    }
    if (ch === ',') {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function parseSqlLiteral(raw: string): unknown {
  const t = raw.trim()
  if (/^null$/i.test(t)) return null
  if (/^true$/i.test(t)) return true
  if (/^false$/i.test(t)) return false
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'")
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  return t
}

const xmlFormat: EntityIoFormat = {
  id: 'xml',
  extensions: ['xml'],
  mime: 'application/xml',
  language: 'xml',
  capabilities: { export: true, import: true },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    const body = projectRows(rows, cols)
      .map((row) => {
        const fields = cols
          .map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return `    <${c} xsi:nil="true"/>`
            return `    <${c}>${escapeXml(cellToString(v))}</${c}>`
          })
          .join('\n')
        return `  <entity>\n${fields}\n  </entity>`
      })
      .join('\n')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<entities dataclass="${escapeXml(ctx.dataclassName)}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n${body}\n</entities>\n`
  },
  parse(text) {
    const entities: Record<string, unknown>[] = []
    const entityRe = /<entity\b[^>]*>([\s\S]*?)<\/entity>/gi
    for (let em = entityRe.exec(text); em !== null; em = entityRe.exec(text)) {
      const inner = em[1] ?? ''
      const row: Record<string, unknown> = {}
      const fieldRe = /<([A-Za-z_][\w.]*)\b([^>]*)(?:\/>|>([\s\S]*?)<\/\1>)/g
      for (let fm = fieldRe.exec(inner); fm !== null; fm = fieldRe.exec(inner)) {
        const name = fm[1] ?? ''
        const attrs = fm[2] ?? ''
        const content = fm[3]
        if (/\bxsi:nil\s*=\s*["']true["']/i.test(attrs) || content === undefined) {
          row[name] = null
        } else {
          row[name] = coerceCellValue(decodeXml(content))
        }
      }
      entities.push(row)
    }
    if (entities.length === 0) throw new Error('No <entity> elements found')
    return entities
  },
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

const yamlFormat: EntityIoFormat = {
  id: 'yaml',
  extensions: ['yaml', 'yml'],
  mime: 'application/yaml',
  language: 'yaml',
  capabilities: { export: true, import: true },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    if (rows.length === 0) return '[]\n'
    return `${projectRows(rows, cols)
      .map((row) => {
        const lines = cols.map((c) => {
          const v = row[c]
          if (v === null || v === undefined) return `  ${c}: null`
          if (typeof v === 'boolean' || typeof v === 'number') return `  ${c}: ${v}`
          const s = cellToString(v)
          if (/[:#\n"'{}[\],&*?|>%@`]/.test(s) || s === '' || /^(true|false|null)$/i.test(s)) {
            return `  ${c}: ${JSON.stringify(s)}`
          }
          return `  ${c}: ${s}`
        })
        return `- ${lines[0]?.trimStart() ?? ''}\n${lines.slice(1).join('\n')}`
      })
      .join('\n')}\n`
  },
  parse(text) {
    // Minimal YAML list-of-maps parser (export subset)
    const trimmed = text.replace(/^\uFEFF/, '').trim()
    if (!trimmed || trimmed === '[]') return []
    const blocks = trimmed.split(/\n(?=- )/)
    const rows: Record<string, unknown>[] = []
    for (const block of blocks) {
      const lines = block.replace(/^- /, '').split('\n')
      const row: Record<string, unknown> = {}
      for (const line of lines) {
        const m = /^(\s*)([\w.]+):\s*(.*)$/.exec(line)
        if (!m) continue
        const key = m[2] ?? ''
        const raw = (m[3] ?? '').trim()
        if (raw === 'null' || raw === '~' || raw === '') row[key] = null
        else if (raw === 'true') row[key] = true
        else if (raw === 'false') row[key] = false
        else if (
          (raw.startsWith('"') && raw.endsWith('"')) ||
          (raw.startsWith("'") && raw.endsWith("'"))
        ) {
          try {
            row[key] = JSON.parse(raw.startsWith("'") ? JSON.stringify(raw.slice(1, -1)) : raw)
          } catch {
            row[key] = raw.slice(1, -1)
          }
        } else if (/^-?\d+(\.\d+)?$/.test(raw)) row[key] = Number(raw)
        else row[key] = raw
      }
      if (Object.keys(row).length > 0) rows.push(row)
    }
    if (rows.length === 0) throw new Error('No YAML entities found')
    return rows
  },
}

const markdownFormat: EntityIoFormat = {
  id: 'markdown',
  extensions: ['md'],
  mime: 'text/markdown',
  language: 'markdown',
  capabilities: { export: true, import: false },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    if (cols.length === 0) return '_empty_\n'
    const header = `| ${cols.join(' | ')} |`
    const sep = `| ${cols.map(() => '---').join(' | ')} |`
    const body = projectRows(rows, cols)
      .map((r) => `| ${cols.map((c) => cellToString(r[c]).replace(/\|/g, '\\|')).join(' | ')} |`)
      .join('\n')
    return `${header}\n${sep}\n${body}\n`
  },
}

const htmlFormat: EntityIoFormat = {
  id: 'html',
  extensions: ['html', 'htm'],
  mime: 'text/html',
  language: 'html',
  capabilities: { export: true, import: false },
  serialize(rows, ctx) {
    const cols = resolveColumns(rows, ctx)
    const head = cols.map((c) => `<th>${escapeXml(c)}</th>`).join('')
    const body = projectRows(rows, cols)
      .map(
        (r) => `<tr>${cols.map((c) => `<td>${escapeXml(cellToString(r[c]))}</td>`).join('')}</tr>`
      )
      .join('\n')
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeXml(ctx.dataclassName)}</title></head>
<body>
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</body></html>
`
  },
}

export const ENTITY_IO_FORMATS: EntityIoFormat[] = [
  jsonFormat,
  jsonRestFormat,
  jsonlFormat,
  csvFormat,
  tsvFormat,
  sqlFormat,
  xmlFormat,
  yamlFormat,
  markdownFormat,
  htmlFormat,
]
