import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/**
 * Get the DataExplorer URL from environment variable or use default
 * Default: http://localhost:4173 (built app via scripts/e2e-serve.sh / http-server)
 */
const DATAEXPLORER_URL = process.env.DATAEXPLORER_URL || 'http://localhost:4173'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const e2eServeScript = path.join(repoRoot, 'scripts/e2e-serve.sh')

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  /* Allow enough time for 111 tests × 3 browsers with CI retries (1 worker) */
  globalTimeout: process.env.CI ? 45 * 60 * 1000 : undefined,
  timeout: process.env.CI ? 60 * 1000 : 30 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['html'], ['list'], ['github']] : [['html'], ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: DATAEXPLORER_URL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Serve the production DataExplorer build via bunx http-server (API proxied to rest-server). */
  webServer: {
    command: `bash "${e2eServeScript}"`,
    url: `${DATAEXPLORER_URL}/dataexplorer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
