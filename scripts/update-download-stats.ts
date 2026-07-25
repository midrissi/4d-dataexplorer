#!/usr/bin/env bun
/**
 * Fetch GitHub release download counts and write everything under:
 *   <out-dir>/releases/download-stats.json  — aggregate summary
 *   <out-dir>/releases/<tag>.json           — per-release asset details
 *
 * Used by `.github/workflows/download-stats.yml`.
 *
 * Usage:
 *   bun scripts/update-download-stats.ts [--out-dir path]
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  buildDownloadStatsBundle,
  DOWNLOAD_STATS_FILENAME,
  DOWNLOAD_STATS_RELEASES_DIR,
  DOWNLOAD_STATS_REPO,
  type PlatformId,
  releaseDetailFilename,
} from '../apps/docs/.vitepress/data/download-stats.ts'

const PLATFORM_EMOJI: Record<PlatformId, string> = {
  macos: '🍎',
  windows: '🪟',
  linux: '🐧',
  web: '🌐',
}

function parseOutDir(argv: string[]): string {
  const flag = argv.indexOf('--out-dir')
  if (flag >= 0 && argv[flag + 1]) return resolve(argv[flag + 1])
  // Back-compat: --out <file> → use its parent directory
  const outFlag = argv.indexOf('--out')
  if (outFlag >= 0 && argv[outFlag + 1]) {
    return resolve(argv[outFlag + 1], '..')
  }
  return resolve('.')
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function rel(path: string): string {
  const fromCwd = relative(process.cwd(), path)
  return fromCwd.startsWith('..') ? path : fromCwd || '.'
}

function bar(downloads: number, max: number, width = 16): string {
  if (max <= 0 || downloads <= 0) return '░'.repeat(width)
  const filled = Math.max(1, Math.round((downloads / max) * width))
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
}

const outDir = parseOutDir(process.argv.slice(2))
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
const started = Date.now()
const releasesDir = join(outDir, DOWNLOAD_STATS_RELEASES_DIR)
const summaryPath = join(releasesDir, DOWNLOAD_STATS_FILENAME)

console.log('')
console.log('📊  Download stats updater')
console.log('─'.repeat(48))
console.log(`📦  Repo        ${DOWNLOAD_STATS_REPO}`)
console.log(`📂  Output      ${rel(releasesDir)}/`)
console.log(`🔑  Auth        ${token ? 'GitHub token detected' : 'anonymous (rate-limited)'}`)
console.log('')
console.log('⏳  Fetching releases from GitHub…')

const bundle = await buildDownloadStatsBundle(token)
const { summary, releases } = bundle
const maxPlatform = Math.max(1, ...summary.platforms.map((p) => p.downloads))
const trackedAssets = releases.reduce(
  (sum, release) => sum + release.assets.filter((a) => a.platform != null).length,
  0
)
const allAssets = releases.reduce((sum, release) => sum + release.assets.length, 0)

console.log(`✅  Fetched ${fmt(releases.length)} releases`)
console.log('')
console.log('📈  Summary')
console.log(`    💾  Total downloads   ${fmt(summary.total)}`)
console.log(`    🏷️   Releases          ${fmt(summary.releaseCount)}`)
console.log(`    📎  Tracked assets    ${fmt(trackedAssets)} / ${fmt(allAssets)}`)
console.log('')
console.log('🧩  Platforms')
for (const platform of summary.platforms) {
  const emoji = PLATFORM_EMOJI[platform.id]
  const share =
    summary.total > 0 ? `${Math.round((platform.downloads / summary.total) * 100)}%` : '0%'
  console.log(
    `    ${emoji}  ${platform.label.padEnd(8)}  ${bar(platform.downloads, maxPlatform)}  ${fmt(platform.downloads).padStart(6)}  (${share})`
  )
}

const topReleases = [...releases].sort((a, b) => b.total - a.total).slice(0, 5)
if (topReleases.length > 0) {
  console.log('')
  console.log('🏆  Top releases')
  for (const [index, release] of topReleases.entries()) {
    const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] ?? '•'
    console.log(
      `    ${medal}  ${release.tag.padEnd(22)}  ${fmt(release.total).padStart(5)} downloads`
    )
  }
}

console.log('')
console.log('✍️  Writing files…')

mkdirSync(outDir, { recursive: true })
rmSync(releasesDir, { recursive: true, force: true })
mkdirSync(releasesDir, { recursive: true })

writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(`    📄  ${rel(summaryPath)}`)

for (const release of releases) {
  const filePath = join(releasesDir, releaseDetailFilename(release.tag))
  writeFileSync(filePath, `${JSON.stringify(release, null, 2)}\n`, 'utf8')
}
console.log(`    📁  ${rel(releasesDir)}/  (${fmt(releases.length)} release files + summary)`)

const elapsedMs = Date.now() - started
console.log('')
console.log('─'.repeat(48))
console.log(`✨  Done in ${(elapsedMs / 1000).toFixed(2)}s`)
console.log(`   ${fmt(summary.total)} downloads · ${fmt(releases.length + 1)} files in releases/`)
console.log('')
