import { describe, expect, it } from 'bun:test'
import {
  aggregateDownloads,
  buildReleaseDetail,
  classifyPlatform,
  parseDownloadStatsSnapshot,
  releaseDetailFilename,
} from './.vitepress/data/download-stats.ts'

describe('classifyPlatform', () => {
  it('maps desktop installers to platforms', () => {
    expect(classifyPlatform('Data.Explorer_1.3.4_aarch64.dmg')).toBe('macos')
    expect(classifyPlatform('Data-Explorer_1.3.4_x86_64.zip')).toBe('macos')
    expect(classifyPlatform('Data.Explorer_1.3.4_x64-setup.exe')).toBe('windows')
    expect(classifyPlatform('Data.Explorer_1.3.4_amd64.AppImage')).toBe('linux')
    expect(classifyPlatform('Data.Explorer_1.3.4_amd64.deb')).toBe('linux')
    expect(classifyPlatform('Data.Explorer-1.3.4-1.x86_64.rpm')).toBe('linux')
  })

  it('skips checksums and updater metadata', () => {
    expect(classifyPlatform('latest.json')).toBeNull()
    expect(classifyPlatform('file.dmg.sig')).toBeNull()
    expect(classifyPlatform('file.zip.sha256')).toBeNull()
  })

  it('maps the 4D web asset zip to web', () => {
    expect(classifyPlatform('DataExplorer.zip')).toBe('web')
    expect(classifyPlatform('DataBrowser.zip')).toBe('web')
  })
})

describe('parseDownloadStatsSnapshot', () => {
  it('normalizes a valid snapshot', () => {
    const parsed = parseDownloadStatsSnapshot({
      total: 10,
      releaseCount: 2,
      platforms: [{ id: 'macos', label: 'macOS', downloads: 10 }],
      fetchedAt: '2026-07-23T12:00:00.000Z',
      sourceUrl: 'https://example.com',
    })
    expect(parsed).toEqual({
      total: 10,
      releaseCount: 2,
      platforms: [
        { id: 'macos', label: 'macOS', downloads: 10 },
        { id: 'windows', label: 'Windows', downloads: 0 },
        { id: 'linux', label: 'Linux', downloads: 0 },
        { id: 'web', label: 'Web', downloads: 0 },
      ],
      fetchedAt: '2026-07-23T12:00:00.000Z',
      sourceUrl: 'https://example.com',
      mocked: false,
      releases: [],
    })
  })

  it('rejects invalid payloads', () => {
    expect(parseDownloadStatsSnapshot(null)).toBeNull()
    expect(parseDownloadStatsSnapshot({ total: 1 })).toBeNull()
  })
})

describe('aggregateDownloads', () => {
  it('sums installable downloads overall and per platform', () => {
    const result = aggregateDownloads([
      {
        assets: [
          { name: 'app.dmg', download_count: 10 },
          { name: 'setup.exe', download_count: 4 },
          { name: 'app.AppImage', download_count: 2 },
          { name: 'latest.json', download_count: 99 },
          { name: 'app.dmg.sig', download_count: 50 },
          { name: 'DataExplorer.zip', download_count: 7 },
        ],
      },
      {
        assets: [
          { name: 'Data-Explorer_1.0_aarch64.zip', download_count: 3 },
          { name: 'DataBrowser.zip', download_count: 2 },
        ],
      },
    ])

    expect(result.total).toBe(28)
    expect(result.releaseCount).toBe(2)
    expect(result.platforms).toEqual([
      { id: 'macos', label: 'macOS', downloads: 13 },
      { id: 'windows', label: 'Windows', downloads: 4 },
      { id: 'linux', label: 'Linux', downloads: 2 },
      { id: 'web', label: 'Web', downloads: 9 },
    ])
  })
})

describe('releaseDetailFilename', () => {
  it('sanitizes tags for filesystem paths', () => {
    expect(releaseDetailFilename('v1.3.4-0ca6725')).toBe('1.3.4-0ca6725.json')
    expect(releaseDetailFilename('v1.0.0')).toBe('1.0.0.json')
  })
})

describe('buildReleaseDetail', () => {
  it('keeps all assets and aggregates tracked downloads', () => {
    const detail = buildReleaseDetail({
      tag_name: 'v1.0.0',
      name: 'Release v1.0.0',
      published_at: '2026-01-01T00:00:00Z',
      html_url: 'https://example.com/releases/v1.0.0',
      assets: [
        {
          name: 'app.dmg',
          download_count: 10,
          size: 100,
          content_type: 'application/x-apple-diskimage',
        },
        { name: 'latest.json', download_count: 99, size: 10 },
        { name: 'DataExplorer.zip', download_count: 3, size: 50 },
      ],
    })
    expect(detail?.tag).toBe('v1.0.0')
    expect(detail?.total).toBe(13)
    expect(detail?.assets).toHaveLength(3)
    expect(detail?.platforms).toEqual([
      { id: 'macos', label: 'macOS', downloads: 10 },
      { id: 'windows', label: 'Windows', downloads: 0 },
      { id: 'linux', label: 'Linux', downloads: 0 },
      { id: 'web', label: 'Web', downloads: 3 },
    ])
  })
})
