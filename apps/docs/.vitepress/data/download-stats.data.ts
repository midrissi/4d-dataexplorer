import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineLoader } from 'vitepress'
import {
  DOWNLOAD_STATS_FILENAME,
  DOWNLOAD_STATS_RAW_URL,
  DOWNLOAD_STATS_RELEASES_DIR,
  type DownloadStatsSnapshot,
  loadDownloadStatsSnapshot,
  MOCK_DOWNLOAD_STATS,
  parseDownloadStatsSnapshot,
} from './download-stats'

export type DownloadStatsData = DownloadStatsSnapshot

declare const data: DownloadStatsData

export { data }

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../')
const localSnapshotPath = resolve(repoRoot, DOWNLOAD_STATS_RELEASES_DIR, DOWNLOAD_STATS_FILENAME)

function loadLocalSnapshot(): DownloadStatsSnapshot | null {
  if (!existsSync(localSnapshotPath)) return null
  try {
    return parseDownloadStatsSnapshot(JSON.parse(readFileSync(localSnapshotPath, 'utf8')))
  } catch {
    return null
  }
}

function formatLoadIssue(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Build-time snapshot from the `data/download-stats` branch (written by
 * `.github/workflows/download-stats.yml`). Falls back to a local
 * `releases/download-stats.json`, then mocked placeholder data.
 */
export default defineLoader({
  async load(): Promise<DownloadStatsData> {
    try {
      return await loadDownloadStatsSnapshot(
        DOWNLOAD_STATS_RAW_URL,
        process.env.GITHUB_TOKEN || process.env.GH_TOKEN
      )
    } catch (error) {
      const local = loadLocalSnapshot()
      if (local) {
        console.info(
          `[download-stats] Remote snapshot unavailable (${formatLoadIssue(error)}); using local ${DOWNLOAD_STATS_RELEASES_DIR}/${DOWNLOAD_STATS_FILENAME}`
        )
        return local
      }
      console.info(
        `[download-stats] Snapshot unavailable (${formatLoadIssue(error)}); using mocked placeholder data`
      )
      return MOCK_DOWNLOAD_STATS
    }
  },
})
