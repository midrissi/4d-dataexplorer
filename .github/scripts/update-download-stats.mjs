#!/usr/bin/env node
/**
 * Fetch GitHub release download counts and write:
 *   <out-dir>/releases/download-stats.json  — aggregate summary
 *   <out-dir>/releases/<tag>.json           — per-release asset details
 *
 * Used by `.github/workflows/download-stats.yml`.
 *
 * Classification must stay in sync with
 * `apps/docs/.vitepress/data/download-stats.ts` in midrissi/dataexplorer.
 *
 * Usage:
 *   node .github/scripts/update-download-stats.mjs [--out-dir path]
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const DEFAULT_REPO = 'midrissi/4d-dataexplorer'
const REPO = process.env.GITHUB_REPOSITORY || DEFAULT_REPO
const RELEASES_DIR = 'releases'
const SUMMARY_FILENAME = 'download-stats.json'
const SOURCE_URL = `https://github.com/${REPO}/releases`

/** @typedef {'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'web'} PlatformId */

const PLATFORM_ORDER = /** @type {const} */ ([
  'macos',
  'windows',
  'linux',
  'android',
  'ios',
  'web',
])

const PLATFORM_LABELS = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
  web: 'Web',
}

const PLATFORM_EMOJI = {
  macos: '🍎',
  windows: '🪟',
  linux: '🐧',
  android: '🤖',
  ios: '📱',
  web: '🌐',
}

function parseOutDir(argv) {
  const flag = argv.indexOf('--out-dir')
  if (flag >= 0 && argv[flag + 1]) return resolve(argv[flag + 1])
  const outFlag = argv.indexOf('--out')
  if (outFlag >= 0 && argv[outFlag + 1]) {
    return resolve(argv[outFlag + 1], '..')
  }
  return resolve('.')
}

function fmt(n) {
  return n.toLocaleString('en-US')
}

function rel(path) {
  const fromCwd = relative(process.cwd(), path)
  return fromCwd.startsWith('..') ? path : fromCwd || '.'
}

function bar(downloads, max, width = 16) {
  if (max <= 0 || downloads <= 0) return '░'.repeat(width)
  const filled = Math.max(1, Math.round((downloads / max) * width))
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`
}

function isTrackedAsset(name) {
  const n = name.toLowerCase()
  if (
    n.endsWith('.sig') ||
    n.endsWith('.sha256') ||
    n.endsWith('.sh') ||
    n.endsWith('.ps1') ||
    n === 'latest.json'
  ) {
    return false
  }
  return true
}

function isWebBuildZip(name) {
  const n = name.toLowerCase()
  return n === 'dataexplorer.zip' || n === 'databrowser.zip'
}

/** Map a release asset filename to a coarse platform / channel bucket. */
function classifyPlatform(name) {
  if (!isTrackedAsset(name)) return null
  const n = name.toLowerCase()

  if (isWebBuildZip(n)) return 'web'

  if (n.endsWith('.apk') || n.endsWith('.aab')) return 'android'
  if (n.endsWith('.ipa')) return 'ios'

  if (n.endsWith('.exe') || n.endsWith('.msi')) return 'windows'
  if (n.endsWith('.appimage') || n.endsWith('.deb') || n.endsWith('.rpm')) return 'linux'
  if (n.endsWith('.dmg') || n.endsWith('.app.tar.gz')) return 'macos'
  if (n.endsWith('.zip')) {
    if (n.includes('android')) return 'android'
    if (n.includes('ios') || n.includes('iphone') || n.includes('ipad')) return 'ios'
    if (n.includes('data-explorer') || n.includes('data.explorer') || n.includes('dataexplorer')) {
      return 'macos'
    }
  }
  return null
}

function emptyPlatformBuckets() {
  return { macos: 0, windows: 0, linux: 0, android: 0, ios: 0, web: 0 }
}

function platformsFromBuckets(byPlatform) {
  return PLATFORM_ORDER.map((id) => ({
    id,
    label: PLATFORM_LABELS[id],
    downloads: byPlatform[id],
  })).sort((a, b) => b.downloads - a.downloads || a.label.localeCompare(b.label))
}

function aggregateDownloads(releases) {
  const byPlatform = emptyPlatformBuckets()
  let total = 0

  for (const release of releases) {
    for (const asset of release.assets ?? []) {
      const platform = classifyPlatform(asset.name)
      if (!platform) continue
      const count = Number(asset.download_count) || 0
      byPlatform[platform] += count
      total += count
    }
  }

  return {
    total,
    releaseCount: releases.length,
    platforms: platformsFromBuckets(byPlatform),
  }
}

function releaseDetailFilename(tag) {
  const safe = tag
    .replace(/^v/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${safe || 'unknown'}.json`
}

function buildReleaseDetail(release) {
  const tag = release.tag_name?.trim()
  if (!tag) return null

  const byPlatform = emptyPlatformBuckets()
  let total = 0
  const assets = []

  for (const asset of release.assets ?? []) {
    const platform = classifyPlatform(asset.name)
    const downloadCount = Number(asset.download_count) || 0
    assets.push({
      name: asset.name,
      downloadCount,
      size: typeof asset.size === 'number' ? asset.size : null,
      contentType: asset.content_type ?? null,
      platform,
      browserDownloadUrl: asset.browser_download_url ?? null,
    })
    if (!platform) continue
    byPlatform[platform] += downloadCount
    total += downloadCount
  }

  assets.sort((a, b) => b.downloadCount - a.downloadCount || a.name.localeCompare(b.name))

  return {
    tag,
    name: release.name ?? null,
    publishedAt: release.published_at ?? null,
    htmlUrl: release.html_url ?? null,
    total,
    platforms: platformsFromBuckets(byPlatform),
    assets,
  }
}

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': '4d-dataexplorer-download-stats',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function fetchAllReleases(token) {
  const headers = githubHeaders(token)
  const all = []
  let page = 1

  while (page <= 20) {
    const url = `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`GitHub releases API responded ${res.status}`)
    }
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page += 1
  }

  return all
}

async function buildDownloadStatsBundle(token) {
  const ghReleases = await fetchAllReleases(token)
  const aggregated = aggregateDownloads(ghReleases)
  const releases = ghReleases.map((release) => buildReleaseDetail(release)).filter(Boolean)

  const releaseRefs = releases.map((release) => ({
    tag: release.tag,
    file: `${RELEASES_DIR}/${releaseDetailFilename(release.tag)}`,
    total: release.total,
    publishedAt: release.publishedAt,
  }))

  return {
    summary: {
      ...aggregated,
      fetchedAt: new Date().toISOString(),
      sourceUrl: SOURCE_URL,
      mocked: false,
      releases: releaseRefs,
    },
    releases,
  }
}

const outDir = parseOutDir(process.argv.slice(2))
const token = process.env.RELEASE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
const started = Date.now()
const releasesDir = join(outDir, RELEASES_DIR)
const summaryPath = join(releasesDir, SUMMARY_FILENAME)

console.log('')
console.log('📊  Download stats updater')
console.log('─'.repeat(48))
console.log(`📦  Repo        ${REPO}`)
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
