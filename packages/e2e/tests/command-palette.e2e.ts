import { expect, test } from '@playwright/test'
import { login } from './helpers/auth'
import { createAppPage } from './pages'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should open when clicking header search bar', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromHeader()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
  })

  test('should open when clicking footer command button', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromFooter()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
  })

  test('should open with keyboard shortcut', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit may consume Ctrl+P before the page receives it')
    const app = createAppPage(page)
    await app.commandPalette.openWithShortcut()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 8000 })
  })

  test('should close when pressing Escape', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromHeader()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
    await app.commandPalette.close()
    await expect(app.commandPalette.palette).not.toBeVisible()
  })

  test('should show command list when open', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromHeader()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
    await expect(app.commandPalette.commandInput).toBeVisible({ timeout: 2000 })
  })

  test('should open Settings when selecting Open Settings command', async ({ page }) => {
    const app = createAppPage(page)
    await app.commandPalette.openFromHeader()
    await expect(app.commandPalette.palette).toBeVisible({ timeout: 5000 })
    await app.commandPalette.openSettings()
    await expect(app.commandPalette.palette).not.toBeVisible()
    await expect(app.tabs.tab(/settings/i)).toBeVisible({ timeout: 3000 })
  })
})
