/**
 * Shared helpers for docs screenshot capture scripts.
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Browser, chromium, type Locator, type Page } from '@playwright/test'
import {
  DOC_THEME_MODES,
  type DocThemeMode,
  syncScreenshotsToDocsPublic,
} from '../../../scripts/doc-screenshots'
import { getDataExplorerUrl } from '../tests/helpers/config'
import { applyE2ESettings } from '../tests/helpers/settings'
import { type AppPage, createAppPage } from '../tests/pages'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** High-resolution viewport; deviceScaleFactor 2 yields 3840×2160 PNGs. */
export const DOC_SCREENSHOT_VIEWPORT = { width: 1920, height: 1080 } as const
export const DOC_SCREENSHOT_DEVICE_SCALE = 2
export const DOC_SCREENSHOT_OUTPUT_DIR = path.resolve(
  __dirname,
  '../../../apps/dataexplorer/docs/screenshots'
)
export const DOC_SCREENSHOT_ACCESS_KEY = process.env.ACCESS_KEY || '123'

const LLM_SETTINGS_KEY = 'dataexplorer-llm-settings'
const AI_TASKS_KEY = 'dataexplorer-ai-task-history-v1'

export const DOC_SCREENSHOT_PAGE_NAMES = [
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
] as const

export type DocScreenshotPageName = (typeof DOC_SCREENSHOT_PAGE_NAMES)[number]

export const CONSOLE_SCREENSHOT_PAGE_NAMES = ['22-console-panel'] as const
export const TERMINAL_SCREENSHOT_PAGE_NAMES = ['37-terminal-panel', '38-terminal-code'] as const
export const AI_ACTIONS_SCREENSHOT_PAGE_NAMES = [
  '23-ai-actions-menu',
  '24-ai-generate-data',
  '25-ai-ask-dataclass',
  '26-ai-tasks-history',
] as const
export const HTTP_CLIENT_SCREENSHOT_PAGE_NAMES = [
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
] as const
export type DocScreenshotMode = DocThemeMode | 'all'

export type DocScreenshotSelection = {
  showHelp: boolean
  listOnly: boolean
  themes: readonly DocThemeMode[]
  pages: readonly DocScreenshotPageName[]
  /** Max parallel browser contexts (themes × jobs). */
  concurrency: number
  isSelected: (page: DocScreenshotPageName) => boolean
  hasAny: (pages: readonly DocScreenshotPageName[]) => boolean
}

function resolveDocScreenshotThemes(mode: DocScreenshotMode): readonly DocThemeMode[] {
  return mode === 'all' ? DOC_THEME_MODES : [mode]
}

/** Default parallel browser contexts for screenshot capture. */
export const DOC_SCREENSHOT_DEFAULT_CONCURRENCY = 4

/** Resolve CLI/env concurrency before capping to the work-item count. */
export function resolveRequestedDocScreenshotConcurrency(requested?: number): number {
  const fromEnv = Number(process.env.DOC_SCREENSHOT_CONCURRENCY)
  const raw =
    requested ??
    (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DOC_SCREENSHOT_DEFAULT_CONCURRENCY)
  return Math.max(1, Math.floor(raw))
}

/** Cap requested concurrency to the number of work items. */
export function resolveDocScreenshotConcurrency(requested: number, itemCount: number): number {
  if (itemCount <= 0) return 1
  return Math.max(1, Math.min(itemCount, requested))
}

/**
 * Run async work over `items` with at most `concurrency` in flight.
 * Playwright is async I/O-bound; this is a context/worker pool, not OS threads.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  const limit = Math.max(1, Math.min(concurrency, items.length))
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()))
}

function parseDocScreenshotMode(value: string | undefined): DocScreenshotMode {
  if (!value || value.startsWith('--')) {
    throw new Error('--mode requires one of: dark, light, all')
  }
  if (value === 'dark' || value === 'light' || value === 'all') {
    return value
  }
  throw new Error(`Invalid --mode "${value}". Use dark, light, or all`)
}

function parsePositiveInt(value: string | undefined, flag: string): number {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a positive integer`)
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} requires a positive integer`)
  }
  return parsed
}

/**
 * Parse CLI args for docs screenshot capture scripts.
 *
 * Examples:
 * - `script.ts` → all pages, dark + light
 * - `script.ts 27` → page 27 only
 * - `script.ts 2 3` → pages 02 and 03
 * - `script.ts --mode dark 27` → page 27 in dark only
 * - `script.ts --concurrency 6` → up to 6 parallel browser contexts
 * - `script.ts --list` → list pages
 * - `script.ts --help` → show usage
 *
 * Numeric IDs select every page with that prefix, so `7` selects both 07 views.
 */
export function parseDocScreenshotArgs(
  args: readonly string[],
  availablePages: readonly DocScreenshotPageName[] = DOC_SCREENSHOT_PAGE_NAMES
): DocScreenshotSelection {
  let showHelp = false
  let listOnly = false
  let mode: DocScreenshotMode = 'all'
  let concurrency: number | undefined
  const pageTokens: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      showHelp = true
    } else if (arg === '--list') {
      listOnly = true
    } else if (arg === '--mode') {
      mode = parseDocScreenshotMode(args[index + 1])
      index += 1
    } else if (arg.startsWith('--mode=')) {
      mode = parseDocScreenshotMode(arg.slice('--mode='.length))
    } else if (arg === '--concurrency' || arg === '-j') {
      concurrency = parsePositiveInt(args[index + 1], arg)
      index += 1
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = parsePositiveInt(arg.slice('--concurrency='.length), '--concurrency')
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`)
    } else {
      pageTokens.push(arg)
    }
  }

  const rawIds = pageTokens
    .flatMap((token) => token.split(','))
    .map((id) => id.trim())
    .filter(Boolean)

  if ((showHelp || listOnly) && rawIds.length > 0) {
    throw new Error('Page numbers cannot be combined with --help or --list')
  }

  const availableIds = new Set(availablePages.map((page) => page.slice(0, 2)))
  let pages = availablePages
  if (rawIds.length > 0) {
    if (rawIds.some((id) => !/^\d+$/.test(id))) {
      throw new Error('Page numbers must be integers, for example: 2 3 or 27')
    }

    const requestedIds = new Set(rawIds.map((id) => id.padStart(2, '0')))
    const unavailableIds = [...requestedIds].filter((id) => !availableIds.has(id))
    if (unavailableIds.length > 0) {
      throw new Error(
        `Page${unavailableIds.length === 1 ? '' : 's'} not available in this script: ${unavailableIds.join(', ')}`
      )
    }
    pages = availablePages.filter((page) => requestedIds.has(page.slice(0, 2)))
  }

  const selectedPages = new Set<DocScreenshotPageName>(pages)
  const themes = resolveDocScreenshotThemes(mode)
  return {
    showHelp,
    listOnly,
    themes,
    pages,
    concurrency: resolveRequestedDocScreenshotConcurrency(concurrency),
    isSelected: (page) => selectedPages.has(page),
    hasAny: (candidates) => candidates.some((page) => selectedPages.has(page)),
  }
}

export function printDocScreenshotPages(pages: readonly DocScreenshotPageName[]): void {
  console.log('📋 Available screenshot pages:')
  for (const page of pages) {
    console.log(`  📷 ${page}`)
  }
}

export function printDocScreenshotHelp(
  scriptPath: string,
  pages: readonly DocScreenshotPageName[]
): void {
  console.log(`📸 Usage: bun run ${scriptPath} [options] [page...]

Options:
  --help, -h              Show this help
  --list                  List available screenshot pages
  --mode <mode>           Capture theme: dark, light, or all (default: all)
  --concurrency, -j <n>   Parallel browser contexts (default: ${DOC_SCREENSHOT_DEFAULT_CONCURRENCY})
                          Also set via DOC_SCREENSHOT_CONCURRENCY

Examples:
  bun run ${scriptPath}
  bun run ${scriptPath} 27
  bun run ${scriptPath} 2 3
  bun run ${scriptPath} --mode dark 27
  bun run ${scriptPath} --concurrency 6
  bun run ${scriptPath} --list
`)
  printDocScreenshotPages(pages)
}

/** Handle --help/--list and return true when the process should exit. */
export function handleDocScreenshotCli(
  selection: DocScreenshotSelection,
  scriptPath: string,
  pages: readonly DocScreenshotPageName[]
): boolean {
  if (selection.showHelp) {
    printDocScreenshotHelp(scriptPath, pages)
    return true
  }
  if (selection.listOnly) {
    printDocScreenshotPages(pages)
    return true
  }
  return false
}

export type DocScreenshotContext = {
  page: Page
  app: AppPage
  theme: DocThemeMode
  accessKey: string
  baseUrl: string
  outputDir: string
}

export function resolveDocScreenshotBaseUrl(fallback = 'http://localhost:3002'): string {
  if (!process.env.DATAEXPLORER_URL) {
    process.env.DATAEXPLORER_URL = fallback
  }
  return getDataExplorerUrl()
}

export function logDocScreenshotStep(emoji: string, message: string): void {
  console.log(`\n${emoji} ${message}`)
}

export async function ensureDocScreenshotDirs(
  outputDir = DOC_SCREENSHOT_OUTPUT_DIR
): Promise<void> {
  await mkdir(outputDir, { recursive: true })
  for (const theme of DOC_THEME_MODES) {
    await mkdir(path.join(outputDir, theme), { recursive: true })
  }
}

/** Log in via access-key UI, existing session, or API fallback. */
export async function ensureDocCaptureLoggedIn(
  app: AppPage,
  page: Page,
  accessKey = DOC_SCREENSHOT_ACCESS_KEY
): Promise<void> {
  await app.goto()
  await page.waitForTimeout(1500)
  if (await app.login.isAccessKeyScreenVisible()) {
    await app.login.submitAccessKey(accessKey)
  } else if (await app.login.isLoggedIn()) {
    await app.waitForDataclasses()
  } else {
    await app.login.loginViaApi(accessKey)
    await app.waitForDataclasses()
  }
}

/**
 * Apply E2E settings, theme, and optionally open the first dataclass with overlays closed.
 */
export async function prepareDocCaptureWorkspace(
  app: AppPage,
  page: Page,
  theme: DocThemeMode,
  options: {
    openFirstDataclass?: boolean
    resetThemeToDefault?: boolean
  } = {}
): Promise<void> {
  const { openFirstDataclass = true, resetThemeToDefault = false } = options
  await applyE2ESettings(page)
  await app.theme.setTheme(theme)
  await app.prepareForNextFeature()
  if (openFirstDataclass) {
    await app.home.openFirstDataclass()
    await app.closeOverlays()
    await app.assistant.closeIfOpen()
  }
  if (resetThemeToDefault) {
    await app.theme.resetToDefault()
  }
}

/** Login + prepare workspace for a focused feature capture. */
export async function bootstrapDocCaptureSession(
  ctx: DocScreenshotContext,
  options?: Parameters<typeof prepareDocCaptureWorkspace>[3]
): Promise<void> {
  await ensureDocCaptureLoggedIn(ctx.app, ctx.page, ctx.accessKey)
  await prepareDocCaptureWorkspace(ctx.app, ctx.page, ctx.theme, options)
}

/** Prompt fields stop Escape propagation — close via Cancel instead. */
export async function closeOpenDocDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  if (!(await dialog.isVisible().catch(() => false))) return
  const cancel = dialog.getByRole('button', { name: /^cancel$/i })
  if ((await cancel.count()) > 0) {
    await cancel.first().click()
  } else {
    const close = dialog.getByRole('button', { name: /^close$/i })
    if ((await close.count()) > 0) {
      await close.first().click()
    } else {
      await page.keyboard.press('Escape')
    }
  }
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
}

/**
 * Close the AI tasks history panel.
 * Escape only pops task detail first; the dimmed backdrop closes the whole panel.
 * Click via DOM evaluate — a normal/force click hits the dialog (z-10) sitting on
 * top of the full-screen backdrop, so the backdrop handler never runs.
 */
export async function closeAiTasksHistory(page: Page): Promise<void> {
  const panel = page.locator('.ai-task-history-dialog')
  if (!(await panel.isVisible().catch(() => false))) return

  const backdrop = panel.locator('xpath=../button[@aria-label="Close"]')
  if ((await backdrop.count()) > 0) {
    await backdrop.evaluate((el) => (el as HTMLButtonElement).click())
  } else {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
  }
  await panel.waitFor({ state: 'hidden', timeout: 10_000 })
  await page.waitForTimeout(200)
}

export async function readSidebarDataclassName(page: Page, fallback = 'Product'): Promise<string> {
  const dataclassLabel =
    (await page
      .locator('[aria-label="Dataclasses"] [aria-label]')
      .first()
      .getAttribute('aria-label')) ?? ''
  return dataclassLabel.split(' - ')[0]?.trim() || fallback
}

export async function configureLlmAndSeedAiTasks(page: Page, dataclassName: string): Promise<void> {
  const now = Date.now()
  await page.evaluate(
    ({ llmKey, tasksKey, dataclassName, now }) => {
      localStorage.setItem(
        llmKey,
        JSON.stringify({
          baseUrl: 'http://127.0.0.1:11434/v1',
          apiKey: null,
          model: 'llama3.2',
        })
      )
      localStorage.setItem(
        tasksKey,
        JSON.stringify({
          state: {
            tasks: [
              {
                id: `docs-ask-${now}`,
                kind: 'ask',
                dataclassName,
                status: 'done',
                createdAt: now - 120_000,
                updatedAt: now - 90_000,
                input: {
                  prompt: `Show recent records from ${dataclassName} in a new tab`,
                },
                content: `Opened a filtered tab with the 20 most recent ${dataclassName} records, sorted by creation date.`,
                activity: [
                  {
                    id: 'step-1',
                    kind: 'tool',
                    name: 'query_entities',
                    args: { dataclass: dataclassName, orderBy: 'ID desc', top: 20 },
                    callId: 'call_1',
                    status: 'done',
                    result: { count: 20, openedTab: true },
                  },
                ],
                resultSummary: JSON.stringify(
                  { openedTab: true, dataclass: dataclassName, count: 20 },
                  null,
                  2
                ),
              },
              {
                id: `docs-generate-${now}`,
                kind: 'generate',
                dataclassName,
                status: 'done',
                createdAt: now - 300_000,
                updatedAt: now - 240_000,
                input: {
                  count: 5,
                  prompt: 'Use realistic sample values',
                  styles: ['realistic'],
                },
                content: `Created 5 sample ${dataclassName} entities.`,
                activity: [
                  {
                    id: 'step-1',
                    kind: 'tool',
                    name: 'create_entities',
                    args: { dataclass: dataclassName, count: 5 },
                    callId: 'call_2',
                    status: 'done',
                    result: { created: 5 },
                  },
                ],
                resultSummary: JSON.stringify({ created: 5, dataclass: dataclassName }, null, 2),
              },
            ],
          },
          version: 0,
        })
      )
    },
    { llmKey: LLM_SETTINGS_KEY, tasksKey: AI_TASKS_KEY, dataclassName, now }
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
}

/**
 * After seeding LLM settings (which reloads), restore session/theme and return the AI actions trigger.
 */
export async function restoreSessionAfterAiSeed(
  ctx: DocScreenshotContext,
  dataclassName: string
): Promise<Locator> {
  const { app, page, theme, accessKey } = ctx
  if (await app.login.isAccessKeyScreenVisible()) {
    await app.login.submitAccessKey(accessKey)
  }
  await app.waitForReady()
  await page.waitForTimeout(1000)
  await app.theme.setTheme(theme)
  const mainAiTrigger = page.locator('main').getByRole('button', { name: /AI actions for /i })
  if ((await mainAiTrigger.count()) === 0) {
    await app.tabs.goHome()
    await page.waitForTimeout(400)
    await app.home.openFirstDataclass()
  }
  await app.closeOverlays()
  await app.assistant.closeIfOpen()
  await app.theme.resetToDefault()

  const named = page.locator('main').getByRole('button', {
    name: new RegExp(`AI actions for ${dataclassName}`, 'i'),
  })
  const aiTrigger = (await named.count()) > 0 ? named.first() : mainAiTrigger.first()
  await aiTrigger.waitFor({ state: 'visible', timeout: 15_000 })
  return aiTrigger
}

/** Capture HTTP Client request/settings/response-format/history screenshots. */
export async function captureHttpClientScreenshots(
  ctx: DocScreenshotContext,
  selection?: Pick<DocScreenshotSelection, 'isSelected'>
): Promise<void> {
  const { app } = ctx
  const isSelected = (name: DocScreenshotPageName): boolean => selection?.isSelected(name) ?? true
  const http = app.httpClient

  const needsComposer =
    isSelected('27-http-client') ||
    isSelected('28-http-client-settings') ||
    isSelected('29-http-client-response-text') ||
    isSelected('30-http-client-response-markdown') ||
    isSelected('31-http-client-response-html') ||
    isSelected('32-http-client-response-csv') ||
    isSelected('33-http-client-response-pdf') ||
    isSelected('34-http-client-response-image') ||
    isSelected('35-http-client-history') ||
    isSelected('36-http-client-network-error')

  if (!needsComposer) return

  logDocScreenshotStep('🌐', 'HTTP Client')
  await http.openFromToolsMenu()

  if (isSelected('27-http-client') || isSelected('28-http-client-settings')) {
    await http.setMethod('GET')
    await http.setPath('/rest/$catalog')
    await http.send()
    await app.prepareForScreenshot()
    if (isSelected('27-http-client')) {
      logDocScreenshotStep('📡', 'HTTP Client request')
      await app.screenshot('27-http-client')
    }
    if (isSelected('28-http-client-settings')) {
      logDocScreenshotStep('⚙️', 'HTTP Client settings')
      await http.openSettingsTab()
      await app.prepareForScreenshot()
      await app.screenshot('28-http-client-settings')
    }
    // Leave Settings so later response shots show Params (not leftover settings UI).
    await ctx.page
      .getByRole('main')
      .getByRole('button', { name: /^Params$/i })
      .click()
    await ctx.page.waitForTimeout(200)
  }

  if (isSelected('29-http-client-response-text')) {
    logDocScreenshotStep('📄', 'HTTP Client — text response')
    await http.requestSample('/text.txt')
    await http.waitForContentType('text/plain')
    await app.prepareForScreenshot()
    await app.screenshot('29-http-client-response-text')
  }

  if (isSelected('30-http-client-response-markdown')) {
    logDocScreenshotStep('📝', 'HTTP Client — markdown response')
    await http.requestSample('/markdown.md')
    await http.previewBinaryAsText()
    await http.selectTextPreviewMode('Markdown')
    await app.prepareForScreenshot()
    await app.screenshot('30-http-client-response-markdown')
  }

  if (isSelected('31-http-client-response-html')) {
    logDocScreenshotStep('🌐', 'HTTP Client — HTML response')
    await http.requestSample('/html.html')
    await http.waitForContentType('text/html')
    await app.prepareForScreenshot()
    await app.screenshot('31-http-client-response-html')
  }

  if (isSelected('32-http-client-response-csv')) {
    logDocScreenshotStep('📊', 'HTTP Client — CSV response')
    await http.requestSample('/CSV.csv')
    await http.waitForContentType('text/csv')
    await app.prepareForScreenshot()
    await app.screenshot('32-http-client-response-csv')
  }

  if (isSelected('33-http-client-response-pdf')) {
    logDocScreenshotStep('📕', 'HTTP Client — PDF response')
    await http.requestSample('/PDF.pdf')
    await http.waitForContentType('application/pdf')
    await http.waitForPdfPreviewLoaded()
    await app.prepareForScreenshot()
    await app.screenshot('33-http-client-response-pdf')
  }

  if (isSelected('34-http-client-response-image')) {
    logDocScreenshotStep('🖼️', 'HTTP Client — image response')
    await http.requestSample('/JPG.png')
    await http.waitForContentType('image/')
    await app.prepareForScreenshot()
    await app.screenshot('34-http-client-response-image')
  }

  if (isSelected('35-http-client-history')) {
    logDocScreenshotStep('🕐', 'HTTP Client — history')
    // Ensure the history list has a few sample entries from earlier captures / a fresh send.
    await http.requestSample('/text.txt')
    await http.openHistory()
    await app.prepareForScreenshot()
    await app.screenshot('35-http-client-history')
    // Collapse history so later captures show the composer again.
    await http.historyButton.click()
    await ctx.page.waitForTimeout(300)
  }

  if (isSelected('36-http-client-network-error')) {
    logDocScreenshotStep('⚠️', 'HTTP Client — network error')
    // Closed port → Failed to fetch (structured error panel).
    await http.setMethod('GET')
    await http.setServer('http://127.0.0.1:9')
    await http.setPath('/unreachable')
    await http.send()
    await ctx.page
      .getByText(/Network request failed|Request failed|What to check/i)
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
    await app.prepareForScreenshot()
    await app.screenshot('36-http-client-network-error')
  }
}

/** Capture selected AI menu, generate/ask dialogs, and task history screenshots. */
export async function captureAiActionsScreenshots(
  ctx: DocScreenshotContext,
  selection?: Pick<DocScreenshotSelection, 'isSelected'>
): Promise<void> {
  const { app, page } = ctx
  const isSelected = (name: DocScreenshotPageName): boolean => selection?.isSelected(name) ?? true
  const dataclassName = await readSidebarDataclassName(page)
  await configureLlmAndSeedAiTasks(page, dataclassName)
  const aiTrigger = await restoreSessionAfterAiSeed(ctx, dataclassName)

  if (isSelected('23-ai-actions-menu') || isSelected('24-ai-generate-data')) {
    // Sidebar hover triggers intercept pointer events; use the main toolbar button.
    await aiTrigger.click({ force: true })
    await page.getByRole('menuitem', { name: /Generate data/i }).waitFor({ state: 'visible' })
    if (isSelected('23-ai-actions-menu')) {
      logDocScreenshotStep('✨', 'AI actions menu')
      await app.screenshot('23-ai-actions-menu')
    }
    if (isSelected('24-ai-generate-data')) {
      logDocScreenshotStep('🧬', 'AI generate data')
      await page.getByRole('menuitem', { name: /Generate data/i }).click()
      await page.getByRole('dialog').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
      await app.screenshot('24-ai-generate-data')
      await closeOpenDocDialog(page)
    } else {
      await page.keyboard.press('Escape')
    }
  }

  if (isSelected('25-ai-ask-dataclass')) {
    logDocScreenshotStep('💬', 'AI ask dataclass')
    await aiTrigger.click({ force: true })
    await page.getByRole('menuitem', { name: /Ask dataclass/i }).click()
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await page.waitForTimeout(300)
    await app.screenshot('25-ai-ask-dataclass')
    await closeOpenDocDialog(page)
  }

  if (isSelected('26-ai-tasks-history')) {
    logDocScreenshotStep('🗂️', 'AI tasks history')
    await page.getByRole('button', { name: /^AI tasks$/i }).click()
    await page
      .getByText(/Show recent records/i)
      .first()
      .waitFor({ state: 'visible' })
    await page
      .getByText(/Show recent records/i)
      .first()
      .click()
    await page.locator('.ai-task-detail-scroll').waitFor({ state: 'visible' })
    await page
      .getByText(/query_entities|Ran query_entities|^Trace$/i)
      .first()
      .waitFor({
        state: 'visible',
      })
    await page.waitForTimeout(400)
    await app.screenshot('26-ai-tasks-history')
    await closeAiTasksHistory(page)
  }
}

export type DocScreenshotJob = {
  /** Stable id for logs (e.g. "console", "http-client"). */
  id: string
  /** Human-readable label for logs. */
  label: string
  capture: (ctx: DocScreenshotContext) => Promise<void>
}

export type RunDocScreenshotJobPoolOptions = {
  /** Short label used in logs (e.g. "docs"). */
  label: string
  /** Fallback when DATAEXPLORER_URL is unset. */
  defaultBaseUrl?: string
  outputDir?: string
  accessKey?: string
  /** Themes to capture (default: dark + light). */
  themes?: readonly DocThemeMode[]
  /**
   * Max parallel browser contexts across themes × jobs.
   * Defaults to DOC_SCREENSHOT_DEFAULT_CONCURRENCY / DOC_SCREENSHOT_CONCURRENCY.
   */
  concurrency?: number
  /**
   * Reuse one Chromium process for all work items (default true).
   * Each work item still gets an isolated browser context.
   */
  sharedBrowser?: boolean
  /**
   * Headless Chromium cannot paint the built-in PDF viewer.
   * Pass false when capturing PDF response screenshots.
   */
  headless?: boolean
  jobs: readonly DocScreenshotJob[]
}

export type RunDocScreenshotThemesOptions = Omit<RunDocScreenshotJobPoolOptions, 'jobs'> & {
  capture: (ctx: DocScreenshotContext) => Promise<void>
}

type DocScreenshotWorkItem = {
  theme: DocThemeMode
  job: DocScreenshotJob
}

/**
 * Ensure output dirs, dispatch theme×job captures through a concurrency pool,
 * then sync to docs public.
 */
export async function runDocScreenshotJobPool(
  options: RunDocScreenshotJobPoolOptions
): Promise<void> {
  const {
    label,
    defaultBaseUrl = 'http://localhost:3002',
    outputDir = DOC_SCREENSHOT_OUTPUT_DIR,
    accessKey = DOC_SCREENSHOT_ACCESS_KEY,
    themes = DOC_THEME_MODES,
    sharedBrowser = true,
    headless = true,
    jobs,
  } = options
  const baseUrl = resolveDocScreenshotBaseUrl(defaultBaseUrl)
  const work: DocScreenshotWorkItem[] = themes.flatMap((theme) =>
    jobs.map((job) => ({ theme, job }))
  )
  const concurrency = resolveDocScreenshotConcurrency(
    options.concurrency ?? resolveRequestedDocScreenshotConcurrency(),
    work.length
  )

  await ensureDocScreenshotDirs(outputDir)

  console.log(`📸 Capturing ${label} screenshots to ${outputDir}`)
  console.log(`🌐 Server: ${baseUrl}/dataexplorer/`)
  console.log(
    `🖥️  Resolution: ${DOC_SCREENSHOT_VIEWPORT.width}×${DOC_SCREENSHOT_VIEWPORT.height} @ ${DOC_SCREENSHOT_DEVICE_SCALE}x`
  )
  console.log(`🎨 Themes: ${themes.join(', ')}`)
  console.log(`🧵 Jobs: ${jobs.length} × ${themes.length} theme(s) = ${work.length} work item(s)`)
  console.log(`⚡ Concurrency: ${concurrency}`)
  console.log(`🧭 Browser: ${headless ? 'headless' : 'headed'}${sharedBrowser ? ' (shared)' : ''}`)

  const launchBrowser = () => chromium.launch({ headless })

  const runWorkItem = async (browser: Browser, item: DocScreenshotWorkItem): Promise<void> => {
    const { theme, job } = item
    const context = await browser.newContext({
      viewport: DOC_SCREENSHOT_VIEWPORT,
      deviceScaleFactor: DOC_SCREENSHOT_DEVICE_SCALE,
    })
    const page = await context.newPage()
    const app = createAppPage(page, { screenshotDir: outputDir, screenshotTheme: theme })
    console.log(`\n🧵 [${job.id}/${theme}] ${job.label}`)
    try {
      await job.capture({ page, app, theme, accessKey, baseUrl, outputDir })
    } finally {
      await context.close()
    }
  }

  if (sharedBrowser) {
    const browser = await launchBrowser()
    try {
      await runWithConcurrency(work, concurrency, async (item) => {
        await runWorkItem(browser, item)
      })
    } finally {
      await browser.close()
    }
  } else {
    await runWithConcurrency(work, concurrency, async (item) => {
      const browser = await launchBrowser()
      try {
        await runWorkItem(browser, item)
      } finally {
        await browser.close()
      }
    })
  }

  syncScreenshotsToDocsPublic()
  console.log('\n✅ Done!')
}

/**
 * Ensure output dirs, run `capture` once per docs theme (pooled), then sync to docs public.
 */
export async function runDocScreenshotThemes(
  options: RunDocScreenshotThemesOptions
): Promise<void> {
  const { capture, ...poolOptions } = options
  await runDocScreenshotJobPool({
    ...poolOptions,
    jobs: [{ id: 'capture', label: options.label, capture }],
  })
}
