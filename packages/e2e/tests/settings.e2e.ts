import { expect, test } from '@playwright/test'
import { login } from './helpers/auth'
import { createAppPage } from './pages'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should open Settings tab from footer', async ({ page }) => {
    const app = createAppPage(page)
    await app.settings.open()
    await expect(app.tabs.tab(/settings/i)).toBeVisible({ timeout: 3000 })
    await expect(app.tabs.tab(/settings/i)).toHaveAttribute('aria-selected', 'true')
  })

  test('should display settings page content when Settings tab is active', async ({ page }) => {
    const app = createAppPage(page)
    await app.settings.open()
    await expect(app.tabs.tab(/settings/i)).toBeVisible({ timeout: 3000 })
    await expect(
      page.getByRole('heading', { name: /general|appearance|shortcuts|keyboard/i }).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should open Settings from command palette', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromHeader()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
    await app.commandPalette.openSettings()
    await expect(app.tabs.tab(/settings/i)).toBeVisible({ timeout: 3000 })
  })
})
