/**
 * Merge dataexplorer LCOV from main run (SKIP_API_TESTS=1) and api run
 * so api.ts coverage is included. Run from repo root after:
 * 1. test:coverage (main) -> dataexplorer/coverage/lcov.info copied to lcov-main.info
 * 2. test:api with coverage -> overwrites dataexplorer/coverage/lcov.info
 * 3. This script: merge lcov-main (all records except api.ts) + api run's api.ts -> lcov.info
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname =
  typeof import.meta.dir !== 'undefined' ? import.meta.dir : dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const COVERAGE = join(ROOT, 'apps/dataexplorer', 'coverage')
const LCOV_MAIN = join(COVERAGE, 'lcov-main.info')
const LCOV_API = join(COVERAGE, 'lcov.info')

function extractRecords(content: string): { sf: string; block: string }[] {
  const records: { sf: string; block: string }[] = []
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('SF:')) {
      const sf = line.slice(3).trim()
      const start = i
      i++
      while (i < lines.length && lines[i] !== 'end_of_record') {
        i++
      }
      const block = lines.slice(start, i + 1).join('\n')
      records.push({ sf, block })
      i++
    } else {
      i++
    }
  }
  return records
}

function main(): void {
  if (!existsSync(LCOV_MAIN)) {
    console.warn(
      'lcov-main.info not found; run main test:coverage first and copy to lcov-main.info'
    )
    process.exit(1)
  }
  if (!existsSync(LCOV_API)) {
    console.warn('lcov.info (api run) not found; run test:api with coverage first')
    process.exit(1)
  }

  const mainContent = readFileSync(LCOV_MAIN, 'utf8')
  const apiContent = readFileSync(LCOV_API, 'utf8')

  const mainRecords = extractRecords(mainContent)
  const apiRecords = extractRecords(apiContent)

  const mainWithoutApi = mainRecords.filter((r) => !r.sf.endsWith('api.ts'))
  const apiApiRecord = apiRecords.find((r) => r.sf.endsWith('api.ts'))

  const mergedBlocks = mainWithoutApi.map((r) => r.block)
  if (apiApiRecord) {
    mergedBlocks.push(apiApiRecord.block)
  }

  const merged = `${mergedBlocks.join('\n\n')}\n`
  writeFileSync(LCOV_API, merged)
  console.log('Merged dataexplorer LCOV (main + api.ts from api run)')
}

main()
