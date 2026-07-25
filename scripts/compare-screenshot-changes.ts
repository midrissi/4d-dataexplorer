#!/usr/bin/env bun

/**
 * Compare working-tree docs screenshots to HEAD and optionally discard no-ops.
 *
 * Usage:
 *   bun scripts/compare-screenshot-changes.ts
 *   bun scripts/compare-screenshot-changes.ts -d
 *   bun scripts/compare-screenshot-changes.ts --discard-changes
 *
 * Flags:
 *   -d, --discard-changes   git-restore files that are visually identical to HEAD
 *   --threshold <0-1>       pixelmatch sensitivity (default 0.1; lower = stricter)
 *   --max-diff-ratio <n>    max mismatched pixel ratio still treated as same (default 0.001)
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { $ } from 'bun'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { SCREENSHOTS_DIR } from './doc-screenshots'

const ROOT = join(import.meta.dir, '..')
const SCREENSHOTS_REL = relative(ROOT, SCREENSHOTS_DIR)

type Args = {
  discard: boolean
  threshold: number
  maxDiffRatio: number
}

type GitEntry = {
  status: string
  path: string
}

type CompareKind =
  | 'identical'
  | 'same'
  | 'different'
  | 'added'
  | 'deleted'
  | 'missing-head'
  | 'error'

type CompareResult = {
  path: string
  status: string
  kind: CompareKind
  detail?: string
  diffPixels?: number
  totalPixels?: number
}

function fail(message: string): never {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  let discard = false
  let threshold = 0.1
  let maxDiffRatio = 0.001

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-d' || arg === '--discard-changes') {
      discard = true
      continue
    }
    if (arg === '--threshold') {
      const value = Number(argv[++i])
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        fail(`Invalid --threshold "${argv[i]}" (expected 0–1)`)
      }
      threshold = value
      continue
    }
    if (arg === '--max-diff-ratio') {
      const value = Number(argv[++i])
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        fail(`Invalid --max-diff-ratio "${argv[i]}" (expected 0–1)`)
      }
      maxDiffRatio = value
      continue
    }
    if (arg === '-h' || arg === '--help') {
      console.log(`Usage: bun scripts/compare-screenshot-changes.ts [options]

Options:
  -d, --discard-changes   Restore screenshots that match HEAD visually
  --threshold <0-1>       Pixelmatch threshold (default 0.1)
  --max-diff-ratio <n>    Max diff ratio still counted as same (default 0.001)
  -h, --help              Show this help
`)
      process.exit(0)
    }
    fail(`Unknown argument: ${arg}`)
  }

  return { discard, threshold, maxDiffRatio }
}

async function gitStatusPorcelain(): Promise<string> {
  const result =
    await $`git -C ${ROOT} status --porcelain --untracked-files=all -- ${SCREENSHOTS_REL}`.quiet()
  return result.text()
}

function parseStatusLines(porcelain: string): GitEntry[] {
  const entries: GitEntry[] = []
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue
    // XY PATH  or  XY ORIG -> PATH for renames
    const status = line.slice(0, 2)
    let pathPart = line.slice(3)
    if (pathPart.includes(' -> ')) {
      pathPart = pathPart.split(' -> ').at(-1) ?? pathPart
    }
    // Quoted paths from git
    if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
      pathPart = JSON.parse(pathPart) as string
    }
    if (!pathPart.endsWith('.png')) continue
    entries.push({ status, path: pathPart })
  }
  return entries
}

function md5(buf: Uint8Array): string {
  return createHash('md5').update(buf).digest('hex')
}

function decodePng(buf: Buffer): PNG {
  return PNG.sync.read(buf)
}

async function readHeadFile(repoPath: string): Promise<Buffer | null> {
  const result = await $`git -C ${ROOT} show HEAD:${repoPath}`.quiet().nothrow()
  if (result.exitCode !== 0) return null
  return Buffer.from(result.stdout)
}

function compareImages(
  current: Buffer,
  head: Buffer,
  threshold: number,
  maxDiffRatio: number
): Pick<CompareResult, 'kind' | 'detail' | 'diffPixels' | 'totalPixels'> {
  if (md5(current) === md5(head)) {
    return { kind: 'identical', detail: 'byte-identical' }
  }

  let img1: PNG
  let img2: PNG
  try {
    img1 = decodePng(head)
    img2 = decodePng(current)
  } catch (err) {
    return {
      kind: 'error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  if (img1.width !== img2.width || img1.height !== img2.height) {
    return {
      kind: 'different',
      detail: `size ${img1.width}×${img1.height} → ${img2.width}×${img2.height}`,
    }
  }

  const totalPixels = img1.width * img1.height
  const diffPixels = pixelmatch(img1.data, img2.data, null, img1.width, img1.height, {
    threshold,
    includeAA: false,
  })
  const ratio = totalPixels === 0 ? 0 : diffPixels / totalPixels

  if (diffPixels === 0 || ratio <= maxDiffRatio) {
    return {
      kind: 'same',
      detail: `${diffPixels.toLocaleString()} px (${(ratio * 100).toFixed(3)}%)`,
      diffPixels,
      totalPixels,
    }
  }

  return {
    kind: 'different',
    detail: `${diffPixels.toLocaleString()} / ${totalPixels.toLocaleString()} px (${(ratio * 100).toFixed(3)}%)`,
    diffPixels,
    totalPixels,
  }
}

async function compareEntry(
  entry: GitEntry,
  threshold: number,
  maxDiffRatio: number
): Promise<CompareResult> {
  const { status, path: repoPath } = entry
  const xy = status.replace(/ /g, '')

  if (xy.includes('D') && !xy.includes('A') && !xy.includes('M')) {
    return { path: repoPath, status, kind: 'deleted', detail: 'removed in working tree' }
  }

  if (xy === '??' || xy.startsWith('A') || xy.endsWith('A')) {
    const head = await readHeadFile(repoPath)
    if (!head) {
      return { path: repoPath, status, kind: 'added', detail: 'not in HEAD' }
    }
  }

  const abs = join(ROOT, repoPath)
  let current: Buffer
  try {
    current = readFileSync(abs)
  } catch {
    return { path: repoPath, status, kind: 'deleted', detail: 'missing on disk' }
  }

  const head = await readHeadFile(repoPath)
  if (!head) {
    return { path: repoPath, status, kind: 'missing-head', detail: 'no HEAD blob (new file)' }
  }

  const result = compareImages(current, head, threshold, maxDiffRatio)
  return { path: repoPath, status, ...result }
}

function emojiFor(kind: CompareKind): string {
  switch (kind) {
    case 'identical':
      return '🧊'
    case 'same':
      return '😌'
    case 'different':
      return '👀'
    case 'added':
      return '🆕'
    case 'deleted':
      return '🗑️'
    case 'missing-head':
      return '🆕'
    case 'error':
      return '💥'
  }
}

function labelFor(kind: CompareKind): string {
  switch (kind) {
    case 'identical':
      return 'identical to HEAD'
    case 'same':
      return 'visually same as HEAD'
    case 'different':
      return 'visually different'
    case 'added':
      return 'new screenshot'
    case 'deleted':
      return 'deleted'
    case 'missing-head':
      return 'new screenshot'
    case 'error':
      return 'compare failed'
  }
}

function isDiscardable(kind: CompareKind): boolean {
  return kind === 'identical' || kind === 'same'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  console.log('🔍 Checking git status for docs screenshots…')
  console.log(`📂 ${SCREENSHOTS_REL}`)

  const insideRepo = await $`git -C ${ROOT} rev-parse --is-inside-work-tree`.quiet().nothrow()
  if (insideRepo.exitCode !== 0) {
    fail('Not inside a git repository')
  }

  const fullStatus = await $`git -C ${ROOT} status --short`.quiet()
  const fullText = fullStatus.text().trim()
  if (!fullText) {
    console.log('✨ Working tree clean — nothing to compare.')
    return
  }

  console.log('\n📋 Git status (repo):')
  for (const line of fullText.split('\n').slice(0, 20)) {
    console.log(`   ${line}`)
  }
  const extra = fullText.split('\n').length - 20
  if (extra > 0) console.log(`   … +${extra} more`)

  const porcelain = await gitStatusPorcelain()
  const entries = parseStatusLines(porcelain)

  if (entries.length === 0) {
    console.log('\n✅ No screenshot changes under docs/screenshots.')
    return
  }

  console.log(`\n🖼️  Comparing ${entries.length} screenshot change(s) to HEAD…`)
  console.log(
    `   threshold=${args.threshold}  maxDiffRatio=${args.maxDiffRatio}${args.discard ? '  discard=on' : ''}`
  )

  const results: CompareResult[] = []
  for (const entry of entries) {
    const result = await compareEntry(entry, args.threshold, args.maxDiffRatio)
    results.push(result)
    const suffix = result.detail ? ` — ${result.detail}` : ''
    console.log(` ${emojiFor(result.kind)}  ${result.path}  (${labelFor(result.kind)}${suffix})`)
  }

  const identical = results.filter((r) => r.kind === 'identical')
  const same = results.filter((r) => r.kind === 'same')
  const different = results.filter((r) => r.kind === 'different')
  const added = results.filter((r) => r.kind === 'added' || r.kind === 'missing-head')
  const deleted = results.filter((r) => r.kind === 'deleted')
  const errored = results.filter((r) => r.kind === 'error')
  const discardable = results.filter((r) => isDiscardable(r.kind))

  console.log('\n📊 Summary')
  console.log(`   🧊 identical:     ${identical.length}`)
  console.log(`   😌 visually same: ${same.length}`)
  console.log(`   👀 different:     ${different.length}`)
  console.log(`   🆕 added:         ${added.length}`)
  console.log(`   🗑️  deleted:       ${deleted.length}`)
  if (errored.length > 0) console.log(`   💥 errors:        ${errored.length}`)

  if (args.discard) {
    if (discardable.length === 0) {
      console.log('\n💤 Nothing to discard — no screenshots match HEAD closely enough.')
    } else {
      console.log(`\n♻️  Discarding ${discardable.length} no-op screenshot change(s)…`)
      for (const item of discardable) {
        const restore =
          await $`git -C ${ROOT} restore --source=HEAD --staged --worktree -- ${item.path}`
            .quiet()
            .nothrow()
        if (restore.exitCode !== 0) {
          const worktreeOnly = await $`git -C ${ROOT} restore --worktree -- ${item.path}`
            .quiet()
            .nothrow()
          if (worktreeOnly.exitCode !== 0) {
            console.log(`   ⚠️  failed to restore ${item.path}`)
            continue
          }
        }
        console.log(`   🗑️  restored ${item.path}`)
      }
      console.log('✨ Discard complete.')
    }
  } else if (discardable.length > 0) {
    console.log(
      `\n💡 Tip: re-run with -d / --discard-changes to restore ${discardable.length} visually-same file(s).`
    )
  }

  if (errored.length > 0) process.exit(1)
}

await main()
