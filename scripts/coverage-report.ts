/**
 * Merge LCOV files from all packages and display an overall project coverage report.
 * Run from repo root. Expects coverage/lcov.info in each package after test:coverage.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname =
  typeof import.meta.dir !== 'undefined' ? import.meta.dir : dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const COVERAGE_PATHS: { prefix: string; label: string }[] = [
  { prefix: 'apps/dataexplorer', label: '@4d/dataexplorer' },
  { prefix: 'packages/orda-language-service', label: '@4d/orda-language-service' },
  { prefix: 'packages/rest', label: '@4d/rest' },
  { prefix: 'packages/rest-server', label: '@4d/rest-server' },
  { prefix: 'packages/ui', label: '@4d/ui' },
]

/** Exclude test/setup, instrumentation gaps, and cross-package UI paths from dataexplorer lcov. */
const COVERAGE_EXCLUDE_SUFFIXES = ['/test-setup.ts', '/test-rest-mock.ts', 'src/lib/storage.ts']

function shouldExcludeRecord(sf: string): boolean {
  if (COVERAGE_EXCLUDE_SUFFIXES.some((s) => sf.endsWith(s))) return true
  // Cross-imported package sources from dataexplorer tests are measured in their
  // own package coverage (or are out-of-scope deps), not @4d/dataexplorer coverage.
  if (sf.startsWith('apps/dataexplorer/') && sf.includes('/packages/')) return true
  return false
}

type Record = {
  sf: string
  fnf: number
  fnh: number
  lf: number
  lh: number
}

function parseLcov(content: string, pathPrefix: string): Record[] {
  const records: Record[] = []
  let current: Partial<Record> = {}
  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      current = { sf: `${pathPrefix}/${line.slice(3).trim()}` }
    } else if (line.startsWith('FNF:')) {
      current.fnf = Number(line.slice(4))
    } else if (line.startsWith('FNH:')) {
      current.fnh = Number(line.slice(4))
    } else if (line.startsWith('LF:')) {
      current.lf = Number(line.slice(3))
    } else if (line.startsWith('LH:')) {
      current.lh = Number(line.slice(3))
    } else if (line === 'end_of_record' && current.sf) {
      records.push({
        sf: current.sf,
        fnf: current.fnf ?? 0,
        fnh: current.fnh ?? 0,
        lf: current.lf ?? 0,
        lh: current.lh ?? 0,
      })
      current = {}
    }
  }
  return records
}

function mergeRecords(recordLists: Record[][]): Map<string, Record> {
  const merged = new Map<string, Record>()
  for (const records of recordLists) {
    for (const r of records) {
      const existing = merged.get(r.sf)
      if (existing) {
        existing.lf += r.lf
        existing.lh += r.lh
        existing.fnf += r.fnf
        existing.fnh += r.fnh
      } else {
        merged.set(r.sf, { ...r })
      }
    }
  }
  return merged
}

function pct(num: number, den: number): string {
  if (den === 0) return '100.00'
  return ((num / den) * 100).toFixed(2)
}

function main(): void {
  const allRecords: Record[] = []
  const byPackage: { label: string; records: Record[] }[] = []

  for (const { prefix, label } of COVERAGE_PATHS) {
    const lcovPath = join(ROOT, prefix, 'coverage', 'lcov.info')
    if (!existsSync(lcovPath)) {
      console.warn(`No coverage found: ${lcovPath}`)
      continue
    }
    const content = readFileSync(lcovPath, 'utf8')
    const records = parseLcov(content, prefix).filter((r) => !shouldExcludeRecord(r.sf))
    allRecords.push(...records)
    byPackage.push({ label, records })
  }

  if (allRecords.length === 0) {
    console.error('No coverage data found. Run: bun run test:coverage')
    process.exit(1)
  }

  const merged = mergeRecords([allRecords])
  const rows: { label: string; lf: number; lh: number; fnf: number; fnh: number }[] = []

  for (const { label, records } of byPackage) {
    let lf = 0
    let lh = 0
    let fnf = 0
    let fnh = 0
    for (const r of records) {
      lf += r.lf
      lh += r.lh
      fnf += r.fnf
      fnh += r.fnh
    }
    rows.push({ label, lf, lh, fnf, fnh })
  }

  let totalLf = 0
  let totalLh = 0
  let totalFnf = 0
  let totalFnh = 0
  for (const r of merged.values()) {
    totalLf += r.lf
    totalLh += r.lh
    totalFnf += r.fnf
    totalFnh += r.fnh
  }
  rows.push({
    label: 'All files',
    lf: totalLf,
    lh: totalLh,
    fnf: totalFnf,
    fnh: totalFnh,
  })

  const w = 20
  const sep = `${'-'.repeat(w)}|${'-'.repeat(10)}|${'-'.repeat(10)}|`
  console.log(`\n${'='.repeat(52)}`)
  console.log('  Overall project coverage (including packages)')
  console.log('='.repeat(52))
  console.log(sep)
  console.log(`${'Package'.padEnd(w)}|${'% Funcs'.padStart(9)} |${'% Lines'.padStart(9)} |`)
  console.log(sep)
  for (const row of rows) {
    const fnPct = pct(row.fnh, row.fnf)
    const linePct = pct(row.lh, row.lf)
    console.log(`${row.label.padEnd(w)}|${`${fnPct}%`.padStart(9)} |${`${linePct}%`.padStart(9)} |`)
  }
  console.log(sep)
  console.log('')
}

main()
