#!/usr/bin/env bun
/**
 * Generate (or rotate) the Tauri updater signing keypair and sync the public
 * key into `tauri.conf.json`.
 *
 * The updater verifies every downloaded package against the public key embedded
 * in `tauri.conf.json` using a private key that must be kept secret and provided
 * to CI as the `TAURI_SIGNING_PRIVATE_KEY` secret. This script wires the two
 * together so they never drift.
 *
 * Usage (from apps/desktop):
 *   bun scripts/generate-updater-key.ts            # create keys if missing
 *   bun scripts/generate-updater-key.ts --force    # rotate existing keys
 *   bun scripts/generate-updater-key.ts --password # prompt for a key password
 *
 * WARNING: rotating the key invalidates updates signed with the previous key.
 * Users on an older version can only update once they are on a build that ships
 * the new public key. Keep a secure backup of the private key + password.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const desktopDir = resolve(scriptDir, '..')

const KEY_PATH = join(desktopDir, '.tauri-updater.key')
const PUB_PATH = `${KEY_PATH}.pub`
const CONF_PATH = join(desktopDir, 'src-tauri', 'tauri.conf.json')

const args = new Set(process.argv.slice(2))
const force = args.has('--force') || args.has('-f')
const withPassword = args.has('--password') || args.has('-p')

function fail(message: string): never {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

if (existsSync(KEY_PATH) && !force) {
  fail(
    `A key already exists at ${KEY_PATH}.\n` +
      '  Re-run with --force to rotate it (this invalidates prior signatures).'
  )
}

console.log(force ? 'Rotating updater signing keypair…' : 'Generating updater signing keypair…')

// `tauri signer generate` writes the private key to -w and prints the matching
// public key to a sibling `.pub` file. An empty password is allowed but not
// recommended; pass --password to be prompted interactively.
const generateArgs = ['tauri', 'signer', 'generate', '-w', KEY_PATH, '-f']
if (!withPassword) generateArgs.push('--password', '')

const gen = spawnSync('bunx', generateArgs, {
  cwd: desktopDir,
  stdio: withPassword ? 'inherit' : ['ignore', 'inherit', 'inherit'],
})

if (gen.status !== 0) fail('tauri signer generate failed.')

if (!existsSync(PUB_PATH)) fail(`Expected public key at ${PUB_PATH} but it was not created.`)

const pubkey = readFileSync(PUB_PATH, 'utf8').trim()
if (!pubkey) fail('Public key file is empty.')

// Patch the pubkey in tauri.conf.json while preserving the rest of the config.
const confRaw = readFileSync(CONF_PATH, 'utf8')
const conf = JSON.parse(confRaw) as {
  plugins?: { updater?: { pubkey?: string; endpoints?: string[] } }
}

conf.plugins ??= {}
conf.plugins.updater ??= {}
conf.plugins.updater.pubkey = pubkey

// Preserve two-space indentation and a trailing newline to match the repo style.
writeFileSync(CONF_PATH, `${JSON.stringify(conf, null, 2)}\n`)

console.log('\n✔ Updater keypair ready.')
console.log(`  Private key: ${KEY_PATH} (gitignored — keep secret!)`)
console.log(`  Public key:  ${PUB_PATH}`)
console.log(`  Synced pubkey into ${CONF_PATH}`)
console.log('\nNext steps:')
console.log('  1. Store the private key as the CI secret TAURI_SIGNING_PRIVATE_KEY:')
console.log(`       gh secret set TAURI_SIGNING_PRIVATE_KEY < ${KEY_PATH}`)
console.log('  2. If you set a password, store it as TAURI_SIGNING_PRIVATE_KEY_PASSWORD.')
console.log('  3. Commit the updated tauri.conf.json (public key only).')
