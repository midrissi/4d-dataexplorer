export type PlatformId = 'macos' | 'windows' | 'linux' | 'web'

export interface PlatformStat {
  id: PlatformId
  label: string
  downloads: number
}

export interface DownloadStatsSummary {
  total: number
  releaseCount: number
  platforms: PlatformStat[]
}

export interface DownloadStatsSnapshot extends DownloadStatsSummary {
  fetchedAt: string | null
  sourceUrl: string
  /** True when the live snapshot branch was unavailable and placeholder data is shown. */
  mocked?: boolean
  /** Relative paths to per-release detail files on the stats branch. */
  releases?: DownloadStatsReleaseRef[]
}

export interface DownloadStatsReleaseRef {
  tag: string
  file: string
  total: number
  publishedAt: string | null
}

export interface DownloadStatsAssetDetail {
  name: string
  downloadCount: number
  size: number | null
  contentType: string | null
  platform: PlatformId | null
  browserDownloadUrl: string | null
}

export interface DownloadStatsReleaseDetail {
  tag: string
  name: string | null
  publishedAt: string | null
  htmlUrl: string | null
  total: number
  platforms: PlatformStat[]
  assets: DownloadStatsAssetDetail[]
}

export interface DownloadStatsBundle {
  summary: DownloadStatsSnapshot
  releases: DownloadStatsReleaseDetail[]
}

export const DOWNLOAD_STATS_REPO = 'midrissi/4d-dataexplorer'
export const DOWNLOAD_STATS_BRANCH = 'data/download-stats'
export const DOWNLOAD_STATS_RELEASES_DIR = 'releases'
export const DOWNLOAD_STATS_FILENAME = 'download-stats.json'
export const DOWNLOAD_STATS_SOURCE_URL = `https://github.com/${DOWNLOAD_STATS_REPO}/releases`
/** Branch-relative path to the summary file. */
export const DOWNLOAD_STATS_SUMMARY_PATH = `${DOWNLOAD_STATS_RELEASES_DIR}/${DOWNLOAD_STATS_FILENAME}`
export const DOWNLOAD_STATS_RAW_URL = `https://raw.githubusercontent.com/${DOWNLOAD_STATS_REPO}/${DOWNLOAD_STATS_BRANCH}/${DOWNLOAD_STATS_SUMMARY_PATH}`

interface GhAsset {
  name: string
  download_count: number
  size?: number
  content_type?: string
  browser_download_url?: string
}

interface GhRelease {
  tag_name?: string
  name?: string
  published_at?: string
  html_url?: string
  assets?: GhAsset[]
}

function isTrackedAsset(name: string): boolean {
  const n = name.toLowerCase()
  if (n.endsWith('.sig') || n.endsWith('.sha256') || n === 'latest.json') return false
  return true
}

function isWebBuildZip(name: string): boolean {
  const n = name.toLowerCase()
  return n === 'dataexplorer.zip' || n === 'databrowser.zip'
}

/** Map a release asset filename to a coarse platform / channel bucket. */
export function classifyPlatform(name: string): PlatformId | null {
  if (!isTrackedAsset(name)) return null
  const n = name.toLowerCase()

  // 4D web assets (exact names) — before the broader "dataexplorer" desktop zip match
  if (isWebBuildZip(n)) return 'web'

  if (n.endsWith('.exe') || n.endsWith('.msi')) return 'windows'
  if (n.endsWith('.appimage') || n.endsWith('.deb') || n.endsWith('.rpm')) return 'linux'
  if (n.endsWith('.dmg') || n.endsWith('.app.tar.gz')) return 'macos'
  if (n.endsWith('.zip')) {
    if (n.includes('data-explorer') || n.includes('data.explorer') || n.includes('dataexplorer')) {
      return 'macos'
    }
  }
  return null
}

const PLATFORM_ORDER: PlatformId[] = ['macos', 'windows', 'linux', 'web']
const PLATFORM_LABELS: Record<PlatformId, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  web: 'Web',
}

function emptyPlatformBuckets(): Record<PlatformId, number> {
  return { macos: 0, windows: 0, linux: 0, web: 0 }
}

function platformsFromBuckets(byPlatform: Record<PlatformId, number>): PlatformStat[] {
  return PLATFORM_ORDER.map((id) => ({
    id,
    label: PLATFORM_LABELS[id],
    downloads: byPlatform[id],
  }))
}

export function aggregateDownloads(releases: GhRelease[]): DownloadStatsSummary {
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

/** Safe filename for a release tag under `releases/`. */
export function releaseDetailFilename(tag: string): string {
  const safe = tag
    .replace(/^v/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${safe || 'unknown'}.json`
}

export function buildReleaseDetail(release: GhRelease): DownloadStatsReleaseDetail | null {
  const tag = release.tag_name?.trim()
  if (!tag) return null

  const byPlatform = emptyPlatformBuckets()
  let total = 0
  const assets: DownloadStatsAssetDetail[] = []

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

export const EMPTY_PLATFORM_STATS: PlatformStat[] = PLATFORM_ORDER.map((id) => ({
  id,
  label: PLATFORM_LABELS[id],
  downloads: 0,
}))

export const EMPTY_DOWNLOAD_STATS: DownloadStatsSnapshot = {
  total: 0,
  releaseCount: 0,
  platforms: EMPTY_PLATFORM_STATS,
  fetchedAt: null,
  sourceUrl: DOWNLOAD_STATS_SOURCE_URL,
  releases: [],
}

/** Placeholder shown when `releases/download-stats.json` is missing on the stats branch. */
export const MOCK_DOWNLOAD_STATS: DownloadStatsSnapshot = {
  total: 1_284,
  releaseCount: 32,
  platforms: [
    { id: 'macos', label: 'macOS', downloads: 812 },
    { id: 'windows', label: 'Windows', downloads: 268 },
    { id: 'linux', label: 'Linux', downloads: 141 },
    { id: 'web', label: 'Web', downloads: 63 },
  ],
  fetchedAt: null,
  sourceUrl: DOWNLOAD_STATS_SOURCE_URL,
  mocked: true,
  releases: [],
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': '4d-dataexplorer-docs',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function fetchAllReleases(token?: string): Promise<GhRelease[]> {
  const headers = githubHeaders(token)
  const all: GhRelease[] = []
  let page = 1

  while (page <= 20) {
    const url = `https://api.github.com/repos/${DOWNLOAD_STATS_REPO}/releases?per_page=100&page=${page}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`GitHub releases API responded ${res.status}`)
    }
    const batch = (await res.json()) as GhRelease[]
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page += 1
  }

  return all
}

/** Fetch GitHub releases and build summary + per-release detail files. */
export async function buildDownloadStatsBundle(token?: string): Promise<DownloadStatsBundle> {
  const ghReleases = await fetchAllReleases(token)
  const aggregated = aggregateDownloads(ghReleases)
  const releases = ghReleases
    .map((release) => buildReleaseDetail(release))
    .filter((release): release is DownloadStatsReleaseDetail => release != null)

  const releaseRefs: DownloadStatsReleaseRef[] = releases.map((release) => ({
    tag: release.tag,
    file: `${DOWNLOAD_STATS_RELEASES_DIR}/${releaseDetailFilename(release.tag)}`,
    total: release.total,
    publishedAt: release.publishedAt,
  }))

  return {
    summary: {
      ...aggregated,
      fetchedAt: new Date().toISOString(),
      sourceUrl: DOWNLOAD_STATS_SOURCE_URL,
      mocked: false,
      releases: releaseRefs,
    },
    releases,
  }
}

/** @deprecated Prefer {@link buildDownloadStatsBundle}. */
export async function buildDownloadStatsSnapshot(token?: string): Promise<DownloadStatsSnapshot> {
  const bundle = await buildDownloadStatsBundle(token)
  return bundle.summary
}

export function parseDownloadStatsSnapshot(value: unknown): DownloadStatsSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.total !== 'number' || typeof record.releaseCount !== 'number') return null
  if (!Array.isArray(record.platforms)) return null

  const platforms: PlatformStat[] = []
  for (const id of PLATFORM_ORDER) {
    const match = record.platforms.find(
      (item) => item && typeof item === 'object' && (item as PlatformStat).id === id
    ) as PlatformStat | undefined
    platforms.push({
      id,
      label: PLATFORM_LABELS[id],
      downloads: typeof match?.downloads === 'number' ? match.downloads : 0,
    })
  }

  const releases: DownloadStatsReleaseRef[] = []
  if (Array.isArray(record.releases)) {
    for (const item of record.releases) {
      if (!item || typeof item !== 'object') continue
      const ref = item as Record<string, unknown>
      if (typeof ref.tag !== 'string' || typeof ref.file !== 'string') continue
      releases.push({
        tag: ref.tag,
        file: ref.file,
        total: typeof ref.total === 'number' ? ref.total : 0,
        publishedAt: typeof ref.publishedAt === 'string' ? ref.publishedAt : null,
      })
    }
  }

  return {
    total: record.total,
    releaseCount: record.releaseCount,
    platforms,
    fetchedAt: typeof record.fetchedAt === 'string' ? record.fetchedAt : null,
    sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : DOWNLOAD_STATS_SOURCE_URL,
    mocked: false,
    releases,
  }
}

/** Load a previously published snapshot from the stats branch (or any URL). */
export async function loadDownloadStatsSnapshot(
  url: string = DOWNLOAD_STATS_RAW_URL,
  token?: string
): Promise<DownloadStatsSnapshot> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': '4d-dataexplorer-docs',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`Download stats snapshot responded ${res.status}`)
  }
  const parsed = parseDownloadStatsSnapshot(await res.json())
  if (!parsed) {
    throw new Error('Download stats snapshot JSON is invalid')
  }
  return parsed
}
