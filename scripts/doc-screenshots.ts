import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

import { DOC_THEME_MODES, screenshotAbsolutePath } from './doc-screenshot-paths'

export {
  DOC_THEME_MODES,
  type DocThemeMode,
  docsScreenshotPaths,
  screenshotAbsolutePath,
  screenshotBaseName,
  screenshotFileName,
} from './doc-screenshot-paths'

/** Captured from the running app (dark + light variants). */
export const CAPTURED_SCREENSHOTS = [
  '00-dataclass-appearance',
  '01-access-key',
  '02-welcome-home',
  '03-command-palette',
  '04-dataclass-view',
  '05-entity-viewer',
  '06-query-builder',
  '07-card-view',
  '07-table-view',
  '08-structure-graph',
  '09-settings-general',
  '10-settings-appearance',
  '11-keyboard-shortcuts',
  '12-theme-selector',
  '13-release-notes',
  '14-sidebar-collapsed',
  '15-read-only-mode',
  '16-assistant-panel',
  '17-schema-builder',
  '18-assistant-metadata-editor',
  '19-method-executor-get-entity-sel',
  '20-method-executor-get-first-car',
  '21-method-executor-say-hello',
  '22-console-panel',
  '23-ai-actions-menu',
  '24-ai-generate-data',
  '25-ai-ask-dataclass',
  '26-ai-tasks-history',
  '27-http-client',
  '28-http-client-settings',
  '29-http-client-response-text',
  '30-http-client-response-markdown',
  '31-http-client-response-html',
  '32-http-client-response-csv',
  '33-http-client-response-pdf',
  '34-http-client-response-image',
  '35-http-client-history',
  '36-http-client-network-error',
  '37-terminal-panel',
  '38-terminal-code',
  '39-rest-export',
  '40-environments-editor',
  '41-environments-profile',
  '42-environments-switcher',
] as const

/** Manually added assets (same image in dark/ and light/). */
export const MANUAL_SCREENSHOTS = ['01-4d-open-in-browser'] as const

export type CapturedScreenshot = (typeof CAPTURED_SCREENSHOTS)[number]

export const SCREENSHOTS_DIR = join(__dirname, '../apps/dataexplorer/docs/screenshots')
export const DOCS_PUBLIC_SCREENSHOTS_DIR = join(__dirname, '../apps/docs/public/screenshots')

const IDENTICAL_THEME_OK = new Set<string>(MANUAL_SCREENSHOTS)

function fileMd5(filePath: string): string {
  return createHash('md5').update(readFileSync(filePath)).digest('hex')
}

export function validateThemedScreenshotPairs(baseDir: string): string[] {
  const warnings: string[] = []
  const names = [...CAPTURED_SCREENSHOTS, ...MANUAL_SCREENSHOTS]
  for (const name of names) {
    const darkPath = screenshotAbsolutePath(baseDir, name, 'dark')
    const lightPath = screenshotAbsolutePath(baseDir, name, 'light')
    if (!existsSync(darkPath) || !existsSync(lightPath)) continue
    if (IDENTICAL_THEME_OK.has(name)) continue
    if (fileMd5(darkPath) === fileMd5(lightPath)) {
      warnings.push(`${name}.png: dark and light files are identical`)
    }
  }
  return warnings
}

/** Copy canonical screenshots into the VitePress public folder (docs site serves these). */
export function syncScreenshotsToDocsPublic(): void {
  if (!existsSync(SCREENSHOTS_DIR)) {
    console.warn(`Screenshots source not found: ${SCREENSHOTS_DIR}`)
    return
  }

  prepareScreenshotDirectories(SCREENSHOTS_DIR)
  mkdirSync(DOCS_PUBLIC_SCREENSHOTS_DIR, { recursive: true })
  cpSync(SCREENSHOTS_DIR, DOCS_PUBLIC_SCREENSHOTS_DIR, { recursive: true, force: true })
  removeFlatScreenshotFiles(DOCS_PUBLIC_SCREENSHOTS_DIR)

  const warnings = validateThemedScreenshotPairs(DOCS_PUBLIC_SCREENSHOTS_DIR)
  console.log(`Synced screenshots to ${DOCS_PUBLIC_SCREENSHOTS_DIR}`)
  for (const warning of warnings) {
    console.warn(`  ⚠ ${warning}`)
  }
}

export function isCapturedScreenshot(name: string): boolean {
  return (CAPTURED_SCREENSHOTS as readonly string[]).includes(name)
}

export type ScreenshotCoverage = {
  name: string
  dark: boolean
  light: boolean
}

export function analyzeScreenshotCoverage(baseDir = SCREENSHOTS_DIR): {
  items: ScreenshotCoverage[]
  missing: ScreenshotCoverage[]
  complete: boolean
} {
  prepareScreenshotDirectories(baseDir)

  const names = [...CAPTURED_SCREENSHOTS, ...MANUAL_SCREENSHOTS]
  const items: ScreenshotCoverage[] = names.map((name) => ({
    name,
    dark: existsSync(screenshotAbsolutePath(baseDir, name, 'dark')),
    light: existsSync(screenshotAbsolutePath(baseDir, name, 'light')),
  }))

  const missing = items.filter((item) => !item.dark || !item.light)
  return { items, missing, complete: missing.length === 0 }
}

export function ensureScreenshotPlaceholders(baseDir: string): void {
  for (const theme of DOC_THEME_MODES) {
    mkdirSync(join(baseDir, theme), { recursive: true })
    const cardPath = screenshotAbsolutePath(baseDir, '07-card-view', theme)
    if (existsSync(cardPath)) continue

    const fallbackPath = screenshotAbsolutePath(baseDir, '04-dataclass-view', theme)
    if (existsSync(fallbackPath)) {
      cpSync(fallbackPath, cardPath)
    }
  }
}

/** One-time migration: copy legacy root PNG into theme subfolders, then delete root files. */
export function ensureManualScreenshots(baseDir: string): void {
  for (const name of MANUAL_SCREENSHOTS) {
    const legacyPath = join(baseDir, `${name}.png`)
    if (!existsSync(legacyPath)) continue
    for (const theme of DOC_THEME_MODES) {
      const dest = screenshotAbsolutePath(baseDir, name, theme)
      if (!existsSync(dest)) {
        cpSync(legacyPath, dest)
      }
    }
  }
}

export function removeFlatScreenshotFiles(baseDir: string): void {
  if (!existsSync(baseDir)) return
  for (const name of readdirSync(baseDir)) {
    if (name.endsWith('.png')) {
      unlinkSync(join(baseDir, name))
    }
  }
}

export function prepareScreenshotDirectories(baseDir: string): void {
  if (!existsSync(baseDir)) return

  for (const theme of DOC_THEME_MODES) {
    mkdirSync(join(baseDir, theme), { recursive: true })
  }

  ensureManualScreenshots(baseDir)
  ensureScreenshotPlaceholders(baseDir)
  removeFlatScreenshotFiles(baseDir)
}
