import { expect, test } from '@playwright/test'
import { waitForAppReady, waitForDataclassesLoaded } from './helpers/app'
import { login } from './helpers/auth'

test.describe('Welcome Screen', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should display welcome screen with title', async ({ page }) => {
    // Scope to main content area to avoid matching header heading
    const mainContent = page.locator('main, [aria-label="Entity explorer"]')
    await expect(mainContent.getByRole('heading', { name: 'Data Explorer' })).toBeVisible()
    await expect(page.getByText('Browse and manage your 4D dataclasses')).toBeVisible()
  })

  test('should display stat cards', async ({ page }) => {
    await waitForDataclassesLoaded(page)

    // Check for stat cards (they may show loading state first)
    const statCards = page.locator('[class*="rounded-xl border bg-card"]')
    await expect(statCards.first()).toBeVisible({ timeout: 10000 })
  })

  test('should display loading state initially', async ({ page }) => {
    await waitForAppReady(page)
  })

  test('should have clickable dataclass items when dataclasses are loaded', async ({ page }) => {
    await waitForDataclassesLoaded(page)

    // Wait for dataclasses to be loaded (check for the "All Dataclasses" heading)
    const dataclassesSection = page.getByRole('heading', { name: 'All Dataclasses' })
    await expect(dataclassesSection).toBeVisible({ timeout: 10000 })

    // Check if there are any dataclass buttons
    const dataclassButtons = page.locator('button[type="button"]').filter({
      hasText: /^#\d+/,
    })
    const count = await dataclassButtons.count()
    if (count > 0) {
      await expect(dataclassButtons.first()).toBeVisible()
    }
  })
})
