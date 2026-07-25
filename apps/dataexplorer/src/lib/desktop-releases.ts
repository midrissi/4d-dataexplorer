/** Shared desktop release catalog helpers (GitHub + download-stats branch). */

export type DesktopReleaseRef = {
  /** GitHub release tag, e.g. `v1.3.4-c81b33c`. */
  tag: string
  /** Version without the leading `v`, matching Tauri / latest.json. */
  version: string
  publishedAt: string | null
}

const REPO = 'midrissi/4d-dataexplorer'
export const DESKTOP_STATS_SUMMARY_URL = `https://raw.githubusercontent.com/${REPO}/data/download-stats/releases/download-stats.json`
export const DESKTOP_LATEST_JSON_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`
export const DESKTOP_RELEASES_INDEX_URL = `https://github.com/${REPO}/releases`

type StatsSummary = {
  releases?: Array<{
    tag?: string
    publishedAt?: string | null
  }>
}

type LatestJson = {
  version?: string
}

/** Normalize a tag or version string to the bare version used in manifests. */
export function normalizeDesktopVersion(tagOrVersion: string): string {
  return tagOrVersion.trim().replace(/^v/i, '')
}

/** Channel tip from `/releases/latest` (may match the installed build). */
export async function fetchChannelLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(DESKTOP_LATEST_JSON_URL, {
      headers: { Accept: 'application/octet-stream' },
    })
    if (!res.ok) return null
    const json = (await res.json()) as LatestJson
    return typeof json.version === 'string' ? normalizeDesktopVersion(json.version) : null
  } catch {
    return null
  }
}

/**
 * List published desktop releases from the download-stats branch (no GitHub API quota).
 */
export async function listDesktopReleases(): Promise<DesktopReleaseRef[]> {
  const res = await fetch(DESKTOP_STATS_SUMMARY_URL)
  if (!res.ok) {
    throw new Error(`Failed to load releases (${res.status})`)
  }
  const summary = (await res.json()) as StatsSummary
  const refs: DesktopReleaseRef[] = []

  for (const release of summary.releases ?? []) {
    if (!release.tag) continue
    const version = normalizeDesktopVersion(release.tag)
    if (!version) continue
    refs.push({
      tag: release.tag.startsWith('v') ? release.tag : `v${version}`,
      version,
      publishedAt: release.publishedAt ?? null,
    })
  }

  return refs.slice().sort((a, b) => {
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0
    if (bt !== at) return bt - at
    return b.version.localeCompare(a.version)
  })
}
