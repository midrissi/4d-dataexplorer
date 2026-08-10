/**
 * Captures Environment editor / switcher docs screenshots (dark + light).
 * Usage: DATAEXPLORER_URL=http://localhost:3002 bun run ./scripts/capture-environments-screenshot.ts
 */

import type { Page } from '@playwright/test'
import type { AppPage } from '../tests/pages'
import {
  bootstrapDocCaptureSession,
  ENVIRONMENTS_SCREENSHOT_PAGE_NAMES,
  handleDocScreenshotCli,
  logDocScreenshotStep,
  parseDocScreenshotArgs,
  runDocScreenshotThemes,
} from './doc-screenshot-capture'

const SAMPLE_GLOBALS = [
  {
    id: 'var-doc-global-1',
    key: 'apiKey',
    value: 'demo-key-123',
    initialValue: 'demo-key-123',
    type: 'secret',
    enabled: true,
  },
  {
    id: 'var-doc-global-2',
    key: 'tenant',
    value: 'acme',
    initialValue: 'acme',
    type: 'default',
    enabled: true,
  },
]

const SAMPLE_PROFILE_ENV = {
  id: 'env-doc-profile-1',
  name: 'Local',
  color: '#f472b6',
  variables: [
    {
      id: 'var-doc-profile-1',
      key: 'baseUrl',
      value: 'http://localhost:8080',
      initialValue: 'http://localhost:8080',
      type: 'default',
      enabled: true,
    },
    {
      id: 'var-doc-profile-2',
      key: 'token',
      value: 'local-token',
      initialValue: 'local-token',
      type: 'secret',
      enabled: true,
    },
  ],
}

async function seedEnvironments(page: Page): Promise<void> {
  await page.evaluate(
    ({ globals, profileEnv }) => {
      localStorage.setItem(
        'dataexplorer-env-globals-v1',
        JSON.stringify({ state: { globals }, version: 0 })
      )

      const profilesKey = 'dataexplorer:profiles'
      const raw = localStorage.getItem(profilesKey)
      const profilesData = raw
        ? (JSON.parse(raw) as {
            current?: string
            profiles?: Record<string, { name?: string; settings?: Record<string, unknown> }>
          })
        : { current: 'default', profiles: { default: { name: 'Default', settings: {} } } }

      const currentId = profilesData.current ?? 'default'
      profilesData.profiles ??= {}
      profilesData.profiles[currentId] ??= { name: 'Default', settings: {} }
      const settings = profilesData.profiles[currentId].settings ?? {}
      settings.environments = [profileEnv]
      settings.activeEnvironmentId = profileEnv.id
      profilesData.profiles[currentId].settings = settings
      localStorage.setItem(profilesKey, JSON.stringify(profilesData))
    },
    { globals: SAMPLE_GLOBALS, profileEnv: SAMPLE_PROFILE_ENV }
  )
}

async function openEnvironmentsTab(_app: AppPage, page: Page): Promise<void> {
  await page.getByRole('button', { name: /Environment:/i }).click()
  await page
    .getByRole('button', { name: /^Manage/i })
    .last()
    .click()
  await page.waitForTimeout(800)
}

async function main(): Promise<void> {
  const selection = parseDocScreenshotArgs(
    process.argv.slice(2),
    ENVIRONMENTS_SCREENSHOT_PAGE_NAMES
  )
  if (
    handleDocScreenshotCli(
      selection,
      './scripts/capture-environments-screenshot.ts',
      ENVIRONMENTS_SCREENSHOT_PAGE_NAMES
    )
  ) {
    return
  }

  await runDocScreenshotThemes({
    label: 'environments',
    defaultBaseUrl: 'http://localhost:3002',
    themes: selection.themes,
    concurrency: selection.concurrency,
    async capture(ctx) {
      const { app, page, theme } = ctx
      logDocScreenshotStep('🎨', `Capturing ${theme} theme`)
      await bootstrapDocCaptureSession(ctx, { resetThemeToDefault: true })
      await seedEnvironments(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await bootstrapDocCaptureSession(ctx, { resetThemeToDefault: false })
      await app.tabs.closeClosableTabs()
      await app.tabs.goHome()
      await page.waitForTimeout(400)

      if (
        selection.isSelected('40-environments-editor') ||
        selection.isSelected('41-environments-profile')
      ) {
        logDocScreenshotStep('🧩', 'Environment editor')
        await openEnvironmentsTab(app, page)
        await app.prepareForScreenshot()

        if (selection.isSelected('40-environments-editor')) {
          await page.getByRole('button', { name: /^Globals$/i }).click()
          await page.waitForTimeout(400)
          await app.screenshot('40-environments-editor')
        }

        if (selection.isSelected('41-environments-profile')) {
          await page.getByRole('button', { name: /^Profile$/i }).click()
          await page.waitForTimeout(500)
          await app.screenshot('41-environments-profile')
        }
      }

      if (selection.isSelected('42-environments-switcher')) {
        logDocScreenshotStep('🔀', 'Environment switcher')
        await app.tabs.closeClosableTabs()
        await app.tabs.goHome()
        await app.prepareForScreenshot()
        await page.getByRole('button', { name: /Environment:/i }).click()
        await page.waitForTimeout(500)
        await app.screenshot('42-environments-switcher')
        await page.keyboard.press('Escape')
      }
    },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
