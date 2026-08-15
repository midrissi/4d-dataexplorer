/**
 * Minimal RFC 4180-ish CSV parser for preview tables.
 * Supports commas, CRLF/LF, and double-quoted fields with "" escapes.
 */

export type CsvTable = {
  headers: string[]
  rows: string[][]
}

function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const firstLine = sample.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  const counts: Array<{ delim: ',' | ';' | '\t'; count: number }> = [
    { delim: ',', count: (firstLine.match(/,/g) ?? []).length },
    { delim: ';', count: (firstLine.match(/;/g) ?? []).length },
    { delim: '\t', count: (firstLine.match(/\t/g) ?? []).length },
  ]
  counts.sort((a, b) => b.count - a.count)
  return counts[0].count > 0 ? counts[0].delim : ','
}

/** Parse a CSV/TSV string into headers + data rows. */
export function parseCsv(text: string): CsvTable | null {
  const trimmed = text.replace(/^\uFEFF/, '')
  if (!trimmed.trim()) return null

  const delim = detectDelimiter(trimmed)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    const next = trimmed[i + 1]

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delim) {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n') {
      row.push(field)
      field = ''
      // Skip empty trailing line
      if (row.some((cell) => cell.length > 0) || rows.length === 0) {
        rows.push(row)
      }
      row = []
      continue
    }
    if (ch === '\r') continue
    field += ch
  }

  // Final field/row
  if (field.length > 0 || row.length > 0 || (!trimmed.endsWith('\n') && rows.length === 0)) {
    row.push(field)
    if (row.some((cell) => cell.length > 0) || rows.length === 0) {
      rows.push(row)
    }
  }

  if (rows.length === 0) return null

  const width = Math.max(...rows.map((r) => r.length))
  if (width < 1) return null

  const normalized = rows.map((r) => {
    const copy = r.slice()
    while (copy.length < width) copy.push('')
    return copy
  })

  const [headerRow, ...dataRows] = normalized
  // If there's only one row, treat it as a data row with generated headers.
  if (dataRows.length === 0) {
    return {
      headers: headerRow.map((_, i) => `Column ${i + 1}`),
      rows: [headerRow],
    }
  }

  return { headers: headerRow, rows: dataRows }
}

/** Heuristic: looks like delimited tabular text (CSV/TSV). */
export function looksLikeCsv(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return false
  // Avoid treating JSON/HTML/MD as CSV.
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<')) return false

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return false

  const delim = detectDelimiter(trimmed)
  const counts = lines.slice(0, 12).map((line) => {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (!inQuotes && ch === delim) count += 1
    }
    return count
  })

  const first = counts[0]
  if (first < 1) return false
  const consistent = counts.filter((c) => c === first).length
  return consistent >= Math.ceil(counts.length * 0.7)
}

export function isCsvContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  return (
    ct.includes('text/csv') ||
    ct.includes('application/csv') ||
    ct.includes('text/tab-separated-values') ||
    ct.includes('text/tsv')
  )
}

/** Escape a single CSV/TSV field (RFC 4180-ish). */
export function escapeCsvField(value: string, delim: ',' | ';' | '\t' = ','): string {
  if (
    value.includes('"') ||
    value.includes(delim) ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Serialize headers + rows to CSV/TSV text. */
export function stringifyCsv(
  headers: string[],
  rows: string[][],
  delim: ',' | ';' | '\t' = ','
): string {
  const lines = [
    headers.map((h) => escapeCsvField(h, delim)).join(delim),
    ...rows.map((row) => headers.map((_, i) => escapeCsvField(row[i] ?? '', delim)).join(delim)),
  ]
  return `${lines.join('\n')}\n`
}
