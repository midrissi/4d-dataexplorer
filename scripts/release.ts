#!/usr/bin/env bun

/**
 * Release script: bumps the version across all synced manifests, commits the
 * change and creates a matching git tag.
 *
 * Usage:
 *   bun run release:patch        1.2.1 -> 1.2.2
 *   bun run release:minor        1.2.1 -> 1.3.0
 *   bun run release:major        1.2.1 -> 2.0.0
 *   bun run release 1.4.0        set exact version (also accepts v1.4.0)
 *
 * Flags:
 *   --push       also push the branch and the new tag to the remote
 *   --dry-run    print what would change without touching any files
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'

type Bump = 'patch' | 'minor' | 'major'

const ROOT = join(import.meta.dir, '..')
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/
const BUMPS = new Set<Bump>(['patch', 'minor', 'major'])

/** Files whose `version` field must stay in sync with the root package. */
const VERSION_FILES = [
  'package.json',
  'apps/dataexplorer/package.json',
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
  'apps/mobile/package.json',
  'apps/mobile/src-tauri/tauri.conf.json',
]

function fail(message: string): never {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`)
  process.exit(1)
}

function parseExactVersion(raw: string): string | null {
  const trimmed = raw.trim().replace(/^v/i, '')
  return SEMVER_RE.test(trimmed) ? trimmed : null
}

function parseArgs(): { bump: Bump | null; exact: string | null; push: boolean; dryRun: boolean } {
  const args = process.argv.slice(2)
  const target = args.find((a) => !a.startsWith('-'))

  if (!target) {
    fail('Expected a bump type (patch | minor | major) or an exact version (e.g. 1.4.0)')
  }

  const bump = BUMPS.has(target as Bump) ? (target as Bump) : null
  const exact = bump ? null : parseExactVersion(target)

  if (!bump && !exact) {
    fail(`Invalid target "${target}". Use patch | minor | major, or an exact semver like 1.4.0`)
  }

  return {
    bump,
    exact,
    push: args.includes('--push'),
    dryRun: args.includes('--dry-run'),
  }
}

function nextVersion(current: string, bump: Bump): string {
  const match = current.match(SEMVER_RE)
  if (!match) fail(`Current version "${current}" is not valid semver (x.y.z)`)
  let [major, minor, patch] = match.slice(1).map(Number)

  if (bump === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (bump === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }

  return `${major}.${minor}.${patch}`
}

/** Replaces the first top-level `"version": "x.y.z"` entry in a manifest. */
function updateVersionField(path: string, from: string, to: string): void {
  const abs = join(ROOT, path)
  const contents = readFileSync(abs, 'utf8')
  const pattern = new RegExp(`("version"\\s*:\\s*")${from.replace(/\./g, '\\.')}(")`)

  if (!pattern.test(contents)) {
    fail(`Could not find version "${from}" in ${path}`)
  }

  writeFileSync(abs, contents.replace(pattern, `$1${to}$2`))
}

async function assertCleanTree(): Promise<void> {
  const status = (await $`git status --porcelain`.cwd(ROOT).text()).trim()
  if (status) {
    fail('Working tree is not clean. Commit or stash your changes first.')
  }
}

async function main(): Promise<void> {
  const { bump, exact, push, dryRun } = parseArgs()

  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const current: string = rootPkg.version
  const next = exact ?? (bump ? nextVersion(current, bump) : fail('Missing bump or exact version'))
  const tag = `v${next}`
  const alreadyAtTarget = current === next
  const label = exact ? `exact ${next}` : (bump ?? fail('Missing bump type'))

  console.log(
    alreadyAtTarget
      ? `\x1b[36mReleasing ${next} (already at target; tag only if needed)\x1b[0m`
      : `\x1b[36mReleasing ${current} -> ${next} (${label})\x1b[0m`
  )

  if (dryRun) {
    if (alreadyAtTarget) {
      console.log('Dry run — manifests already at target; no file updates.')
    } else {
      console.log('Dry run — files that would be updated:')
      for (const file of VERSION_FILES) console.log(`  • ${file}`)
    }
    console.log(`Would commit and tag as ${tag}${push ? ' and push' : ''}.`)
    return
  }

  await assertCleanTree()

  const existingTags = (await $`git tag --list ${tag}`.cwd(ROOT).text()).trim()
  if (existingTags) fail(`Tag ${tag} already exists.`)

  if (!alreadyAtTarget) {
    for (const file of VERSION_FILES) {
      updateVersionField(file, current, next)
      console.log(`  ✓ ${file}`)
    }

    await $`git add ${VERSION_FILES}`.cwd(ROOT)
    await $`git commit -m ${`chore: release ${tag}`}`.cwd(ROOT)
  } else {
    console.log('  • Manifests already at target — skipping version commit')
  }

  await $`git tag -a ${tag} -m ${`Release ${tag}`}`.cwd(ROOT)
  console.log(`\x1b[32m✓ ${alreadyAtTarget ? 'Tagged' : 'Committed and tagged'} ${tag}\x1b[0m`)

  if (push) {
    const branch = (await $`git rev-parse --abbrev-ref HEAD`.cwd(ROOT).text()).trim()
    await $`git push origin ${branch}`.cwd(ROOT)
    await $`git push origin ${tag}`.cwd(ROOT)
    console.log(`\x1b[32m✓ Pushed ${branch} and ${tag}\x1b[0m`)
  } else {
    console.log(`\nNext step: \x1b[1mgit push origin HEAD ${tag}\x1b[0m (or re-run with --push)`)
  }
}

main()
