import { expect, type Page } from '@playwright/test'

/**
 * Wait until the Data Explorer shell is rendered.
 * Avoids `networkidle`, which hangs in Firefox when the app keeps polling or retrying requests.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  const mainContent = page.locator('#root main, #root [aria-label="Entity explorer"]')
  await expect(mainContent.first()).toBeVisible({ timeout: 15000 })
}

/**
 * Wait until welcome-screen stats or the dataclass list has loaded.
 * Uses poll instead of `.or()` because both can be visible at once (strict-mode violation).
 */
export async function waitForDataclassesLoaded(page: Page): Promise<void> {
  await waitForAppReady(page)
  const dataclassesHeading = page.getByRole('heading', { name: 'All Dataclasses' })
  const tipsSection = page.getByText('Tips & shortcuts', { exact: false })

  await expect
    .poll(async () => (await dataclassesHeading.isVisible()) || (await tipsSection.isVisible()), {
      timeout: 15_000,
    })
    .toBe(true)
}
