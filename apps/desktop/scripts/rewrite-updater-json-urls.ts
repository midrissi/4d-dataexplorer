#!/usr/bin/env bun
/**
 * Rewrite latest.json package URLs from GitHub API asset URLs to
 * browser_download_url values.
 *
 * tauri-apps/tauri-action@v1 writes:
 *   https://api.github.com/repos/<owner>/<repo>/releases/assets/<id>
 * Those count against the unauthenticated REST rate limit (60/hr/IP) and
 * commonly fail with 403 for public installs. Browser download URLs do not.
 *
 * Usage:
 *   bun apps/desktop/scripts/rewrite-updater-json-urls.ts [--tag TAG] [--repo owner/name] [--dry-run]
 *
 * Defaults: --tag from releases/latest, --repo from `gh repo view`.
 */

import { $ } from 'bun'

type ReleaseAsset = {
  id: number
  name: string
  browser_download_url: string
  url: string
}

type LatestJson = {
  version: string
  notes?: string
  pub_date?: string
  platforms: Record<string, { signature: string; url: string }>
}

const API_ASSET_RE = /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/assets\/(\d+)$/

function parseArgs(argv: string[]) {
  let tag: string | null = null
  let repo: string | null = null
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--tag') tag = argv[++i] ?? null
    else if (a === '--repo') repo = argv[++i] ?? null
    else if (a === '--help' || a === '-h') {
      console.log('Usage: rewrite-updater-json-urls.ts [--tag TAG] [--repo owner/name] [--dry-run]')
      process.exit(0)
    }
  }
  return { tag, repo, dryRun }
}

async function ghJson<T>(args: string[]): Promise<T> {
  const result = await $`gh ${args}`.quiet().nothrow()
  if (result.exitCode !== 0) {
    throw new Error(
      `gh ${args.join(' ')} failed:\n${result.stderr.toString() || result.stdout.toString()}`
    )
  }
  return JSON.parse(result.stdout.toString()) as T
}

async function main() {
  const { tag: tagArg, repo: repoArg, dryRun } = parseArgs(process.argv.slice(2))

  const repo =
    repoArg ?? (await $`gh repo view --json nameWithOwner -q .nameWithOwner`.text()).trim()

  const tag = tagArg ?? (await $`gh api repos/${repo}/releases/latest --jq .tag_name`.text()).trim()

  console.log(`Rewriting latest.json for ${repo}@${tag}${dryRun ? ' (dry-run)' : ''}`)

  const assets = await ghJson<ReleaseAsset[]>([
    'api',
    `repos/${repo}/releases/tags/${tag}`,
    '--jq',
    '.assets',
  ])

  const byId = new Map(assets.map((a) => [String(a.id), a]))
  const latestAsset = assets.find((a) => a.name === 'latest.json')
  if (!latestAsset) {
    throw new Error(`No latest.json asset on release ${tag}`)
  }

  const download =
    await $`gh api -H ${'Accept: application/octet-stream'} ${`repos/${repo}/releases/assets/${latestAsset.id}`}`.quiet()
  if (download.exitCode !== 0) {
    throw new Error(`Failed to download latest.json: ${download.stderr.toString()}`)
  }

  const latest = JSON.parse(download.stdout.toString()) as LatestJson
  let rewritten = 0
  let alreadyBrowser = 0
  let missing = 0

  for (const [platform, entry] of Object.entries(latest.platforms ?? {})) {
    const match = entry.url.match(API_ASSET_RE)
    if (!match) {
      alreadyBrowser++
      continue
    }
    const assetId = match[1]
    if (!assetId) {
      continue
    }
    const asset = byId.get(assetId)
    if (!asset?.browser_download_url) {
      console.warn(`No browser_download_url for ${platform} asset ${assetId}`)
      missing++
      continue
    }
    entry.url = asset.browser_download_url
    rewritten++
  }

  console.log(
    JSON.stringify(
      {
        version: latest.version,
        rewritten,
        alreadyBrowser,
        missing,
        sample: Object.fromEntries(
          Object.entries(latest.platforms)
            .slice(0, 3)
            .map(([k, v]) => [k, v.url])
        ),
      },
      null,
      2
    )
  )

  if (missing > 0) {
    throw new Error(`Failed to rewrite ${missing} platform URL(s)`)
  }

  if (rewritten === 0) {
    console.log('Nothing to rewrite — latest.json already uses browser URLs')
    return
  }

  if (dryRun) {
    console.log('Dry run — not uploading')
    return
  }

  const outPath = `${tmpdir()}/latest.json`
  await Bun.write(outPath, `${JSON.stringify(latest, null, 2)}\n`)

  // Delete first so GitHub Releases does not keep serving a stale
  // Accept: application/json CDN mapping to the previous blob.
  const release = await ghJson<{ assets: { id: number; name: string }[] }>([
    'api',
    `repos/${repo}/releases/tags/${tag}`,
  ])
  const existing = release.assets.find((a) => a.name === 'latest.json')
  if (existing) {
    const del =
      await $`gh api -X DELETE ${`repos/${repo}/releases/assets/${existing.id}`}`.nothrow()
    if (del.exitCode !== 0) {
      console.warn(`Warning: failed to delete old latest.json asset ${existing.id}`)
    }
  }

  const upload = await $`gh release upload ${tag} ${outPath} --repo ${repo} --clobber`.nothrow()
  if (upload.exitCode !== 0) {
    throw new Error(`Upload failed: ${upload.stderr.toString() || upload.stdout.toString()}`)
  }

  console.log(`Uploaded rewritten latest.json to ${repo}@${tag}`)
}

function tmpdir() {
  return process.env.TMPDIR || process.env.TMP || '/tmp'
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
