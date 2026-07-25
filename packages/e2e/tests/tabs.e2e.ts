import { expect, test } from '@playwright/test'
import { login } from './helpers/auth'
import { createAppPage } from './pages'

test.describe('Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should open Release notes from footer version link', async ({ page }) => {
    const app = createAppPage(page)
    await app.headerFooter.openReleaseNotes()
    await expect(app.tabs.tab(/release notes/i)).toBeVisible({ timeout: 3000 })
  })

  test('should show tab bar with Home tab by default', async ({ page }) => {
    const app = createAppPage(page)
    await expect(app.tabs.tablist.or(app.tabs.emptyState)).toBeVisible({ timeout: 5000 })
  })

  test('should switch to Settings tab and back to Home', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromHeader()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
    await app.commandPalette.openHome()
    await expect(app.tabs.homeTab).toBeVisible({ timeout: 3000 })

    await app.settings.open()
    await expect(app.tabs.tab(/settings/i)).toHaveAttribute('aria-selected', 'true')
    await app.tabs.homeTab.click()
    await expect(app.tabs.homeTab).toHaveAttribute('aria-selected', 'true')
  })

  test('should close Release notes tab via tab close button', async ({ page }) => {
    const app = createAppPage(page)
    await app.headerFooter.openReleaseNotes()
    const releaseNotesTab = app.tabs.tab(/release notes/i)
    await expect(releaseNotesTab).toBeVisible({ timeout: 3000 })
    await app.tabs.closeTab(/release notes/i)
    await expect(releaseNotesTab).not.toBeVisible()
  })
})
