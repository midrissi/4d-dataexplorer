/**
 * Merge package LCOV files into coverage/lcov.info at repo root for HTML reports.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const LCOV_PATHS = [
  'apps/dataexplorer/coverage/lcov.info',
  'packages/orda-language-service/coverage/lcov.info',
  'packages/rest/coverage/lcov.info',
  'packages/rest-server/coverage/lcov.info',
  'packages/ui/coverage/lcov.info',
]

function main(): void {
  const outDir = join(ROOT, 'coverage')
  const outFile = join(outDir, 'lcov.info')
  mkdirSync(outDir, { recursive: true })

  const parts: string[] = []
  for (const relativePath of LCOV_PATHS) {
    const lcovPath = join(ROOT, relativePath)
    if (!existsSync(lcovPath)) {
      console.warn(`No coverage found: ${lcovPath}`)
      continue
    }
    parts.push(readFileSync(lcovPath, 'utf8').trimEnd())
  }

  if (parts.length === 0) {
    console.error('No coverage data found. Run: bun run test:coverage')
    process.exit(1)
  }

  writeFileSync(outFile, `${parts.join('\n')}\n`)
  console.log(`Merged ${parts.length} LCOV file(s) -> coverage/lcov.info`)
}

main()
