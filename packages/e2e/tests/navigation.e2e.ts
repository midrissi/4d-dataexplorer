import { expect, test } from '@playwright/test'
import { waitForDataclassesLoaded } from './helpers/app'
import { login } from './helpers/auth'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to dataclass view when clicking a dataclass', async ({ page }) => {
    // Wait for dataclasses to load (check for the "All Dataclasses" heading)
    const dataclassesSection = page.getByRole('heading', { name: 'All Dataclasses' })
    await expect(dataclassesSection).toBeVisible({ timeout: 10000 })

    // Find the first clickable dataclass button
    const dataclassButtons = page
      .locator('button[type="button"]')
      .filter({ hasText: /^#\d+/ })
      .first()

    const buttonCount = await dataclassButtons.count()
    if (buttonCount > 0) {
      const firstButton = dataclassButtons.first()
      await expect(firstButton).toBeVisible()

      // Click the dataclass
      await firstButton.click()

      // Wait for navigation/state change
      await page.waitForTimeout(1000)

      // Check if we're now viewing a dataclass (tab bar should show the dataclass name)
      const tabBar = page.locator('[role="tablist"]')
      await expect(tabBar).toBeVisible({ timeout: 5000 })

      // Check if a tab is visible
      const tabs = page.locator('[role="tab"]')
      await expect(tabs.first()).toBeVisible({ timeout: 2000 })
    } else {
      // If no dataclasses are available, skip the test
      test.skip()
    }
  })

  test('should display tab bar when dataclass is selected', async ({ page }) => {
    await waitForDataclassesLoaded(page)

    // Try to find and click a dataclass
    const dataclassButtons = page
      .locator('button[type="button"]')
      .filter({ hasText: /^#\d+/ })
      .first()

    const buttonCount = await dataclassButtons.count()
    if (buttonCount > 0) {
      await dataclassButtons.first().click()
      await page.waitForTimeout(1000)

      // Tab bar should be visible
      const tabBar = page.locator('[role="tablist"]')
      await expect(tabBar).toBeVisible({ timeout: 5000 })

      // At least one tab should be visible
      const tabs = page.locator('[role="tab"]')
      await expect(tabs.first()).toBeVisible({ timeout: 2000 })
    } else {
      test.skip()
    }
  })

  test('should open command palette with keyboard shortcut', async ({ page, browserName }) => {
    // WebKit in CI does not reliably deliver Control+P to the page (browser may consume it)
    test.skip(browserName === 'webkit', 'WebKit may consume Ctrl+P before the page receives it')
    // Ensure focus is on the page so the key event is delivered (reduces flakiness in CI)
    await page.locator('header h1').first().click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+p' : 'Control+p')
    const palette = page.locator('.command-palette').first()
    await expect(palette).toBeVisible({ timeout: 8000 })
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden({ timeout: 10000 })
  })
})
