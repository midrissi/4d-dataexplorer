/**
 * Full-fidelity `suggestCanonicalClasses` lint (same engine as Tailwind IntelliSense).
 *
 * IntelliSense does not maintain a static rule list — it calls
 * `designSystem.canonicalizeCandidates()` from Tailwind CSS v4. This script does
 * the same, so Biome/CI can catch every transform IntelliSense would suggest.
 *
 * Editor: enable `tailwindCSS.lint.suggestCanonicalClasses` (see `.vscode/settings.json`).
 * Class sort order is enforced by Biome `nursery/useSortedClasses` (unsafe fix —
 * applied by `bun run check:fix`).
 *
 * Usage:
 *   bun scripts/lint-canonical-tailwind-classes.ts
 *   bun scripts/lint-canonical-tailwind-classes.ts --fix   # rewrite files in place
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Glob } from 'bun'
import { __unstable__loadDesignSystem } from 'tailwindcss'

const ROOT = path.resolve(import.meta.dir, '..')
const REM = 16
const shouldFix = process.argv.includes('--fix')

const GLOBS = [
  'apps/dataexplorer/src/**/*.{tsx,jsx}',
  'apps/desktop/src/**/*.{tsx,jsx}',
  'packages/ui/src/**/*.{tsx,jsx}',
  'packages/json-schema-builder/src/**/*.{tsx,jsx}',
]

type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>

async function loadDesignSystem(): Promise<DesignSystem> {
  const require = createRequire(import.meta.url)
  const twRoot = path.dirname(require.resolve('tailwindcss/package.json'))
  const indexCss = fs.readFileSync(path.join(twRoot, 'index.css'), 'utf8')

  async function loadStylesheet(id: string, base: string) {
    if (id === 'tailwindcss') {
      return { path: id, base, content: indexCss }
    }
    if (id.startsWith('tailwindcss/')) {
      const file = id.replace('tailwindcss/', '')
      const filePath = path.join(twRoot, file.endsWith('.css') ? file : `${file}.css`)
      return {
        path: filePath,
        base: twRoot,
        content: fs.readFileSync(filePath, 'utf8'),
      }
    }
    throw new Error(`Unhandled stylesheet import: ${id} (from ${base})`)
  }

  return __unstable__loadDesignSystem('@import "tailwindcss";', {
    base: ROOT,
    loadStylesheet,
  })
}

const STRING_RE = /(?<quote>['"`])(?<body>(?:\\.|(?!\k<quote>|\$\{)[^\\])*?)\k<quote>/g

const CONTEXT_RE = /(?:class(?:Name)?\s*=\s*|[\s,(](?:cn|clsx|cva|tw(?:Merge)?)\s*\()\s*$/

function lineCol(source: string, index: number): { line: number; col: number } {
  let line = 1
  let lastNl = -1
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') {
      line++
      lastNl = i
    }
  }
  return { line, col: index - lastNl }
}

type Hit = {
  className: string
  canonical: string
  index: number
  end: number
  line: number
  col: number
}

function extractClassLiterals(source: string): { value: string; index: number; end: number }[] {
  const out: { value: string; index: number; end: number }[] = []
  STRING_RE.lastIndex = 0
  let match = STRING_RE.exec(source)
  while (match) {
    const quote = match.groups?.quote
    const body = match.groups?.body
    if (quote && body != null) {
      // Skip template literals with interpolations (regex already excludes `${`)
      const before = source.slice(Math.max(0, match.index - 80), match.index)
      if (CONTEXT_RE.test(before)) {
        out.push({
          value: body.replace(/\\(.)/g, '$1'),
          index: match.index,
          end: match.index + match[0].length,
        })
      }
    }
    match = STRING_RE.exec(source)
  }
  return out
}

function splitClasses(value: string): { className: string; start: number; end: number }[] {
  const parts: { className: string; start: number; end: number }[] = []
  const re = /\S+/g
  let m = re.exec(value)
  while (m) {
    parts.push({ className: m[0], start: m.index, end: m.index + m[0].length })
    m = re.exec(value)
  }
  return parts
}

async function lintFile(
  filePath: string,
  ds: DesignSystem
): Promise<{ hits: Hit[]; fixed?: string }> {
  const source = fs.readFileSync(filePath, 'utf8')
  const hits: Hit[] = []
  const literals = extractClassLiterals(source)

  // Rebuild from end so offsets stay valid when fixing
  let next = source
  const replacements: { start: number; end: number; from: string; to: string }[] = []

  for (const lit of literals) {
    for (const part of splitClasses(lit.value)) {
      const [canonical] = ds.canonicalizeCandidates([part.className], { rem: REM })
      if (!canonical || canonical === part.className) continue

      const absIndex = lit.index + 1 + part.start // +1 for opening quote
      const { line, col } = lineCol(source, absIndex)
      hits.push({
        className: part.className,
        canonical,
        index: absIndex,
        end: absIndex + part.className.length,
        line,
        col,
      })
      replacements.push({
        start: absIndex,
        end: absIndex + part.className.length,
        from: part.className,
        to: canonical,
      })
    }
  }

  if (shouldFix && replacements.length > 0) {
    replacements.sort((a, b) => b.start - a.start)
    for (const r of replacements) {
      next = next.slice(0, r.start) + r.to + next.slice(r.end)
    }
    return { hits, fixed: next }
  }

  return { hits }
}

async function main() {
  const ds = await loadDesignSystem()
  let total = 0
  const files: string[] = []

  for (const pattern of GLOBS) {
    const glob = new Glob(pattern)
    for await (const file of glob.scan({ cwd: ROOT, onlyFiles: true })) {
      files.push(path.join(ROOT, file))
    }
  }

  files.sort()

  for (const file of files) {
    const { hits, fixed } = await lintFile(file, ds)
    if (hits.length === 0) continue

    const rel = path.relative(ROOT, file)
    for (const hit of hits) {
      total++
      console.log(
        `${rel}:${hit.line}:${hit.col} suggestCanonicalClasses — The class \`${hit.className}\` can be written as \`${hit.canonical}\``
      )
    }
    if (fixed != null) {
      fs.writeFileSync(file, fixed)
      console.log(`  fixed ${hits.length} class(es) in ${rel}`)
    }
  }

  if (total > 0) {
    console.error(`\nFound ${total} non-canonical Tailwind class(es).`)
    if (!shouldFix) {
      console.error('Re-run with --fix to apply canonical forms.')
      process.exit(1)
    }
  } else {
    console.log('All Tailwind classes are canonical.')
  }
}

await main()
