import { expect, test } from '@playwright/test'
import { login } from './helpers/auth'
import { createAppPage } from './pages'

test.describe('Header and Footer', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should toggle readonly mode from header', async ({ page }) => {
    const app = createAppPage(page)
    await expect(app.headerFooter.editModeButton.or(app.headerFooter.readOnlyButton)).toBeVisible()
    const initialReadOnly = (await app.headerFooter.readOnlyButton.count()) > 0
    if (initialReadOnly) {
      await app.headerFooter.readOnlyButton.click()
      await expect(app.headerFooter.editModeButton).toBeVisible()
    } else {
      await app.headerFooter.enableReadOnlyMode()
      await expect(app.headerFooter.readOnlyButton).toBeVisible()
    }
    if (initialReadOnly) {
      await app.headerFooter.editModeButton.click()
    } else {
      await app.headerFooter.disableReadOnlyMode()
    }
  })

  test('should collapse and expand sidebar from footer', async ({ page }) => {
    const app = createAppPage(page)
    await expect(
      app.headerFooter.expandSidebarButton.or(app.headerFooter.collapseSidebarButton)
    ).toBeVisible()
    await expect(app.headerFooter.sidebar).toBeVisible()
    await app.headerFooter.collapseSidebarButton.click()
    await page.waitForTimeout(500)
    await app.headerFooter.expandSidebarButton.click()
    await page.waitForTimeout(500)
    await expect(app.headerFooter.sidebar).toBeVisible()
  })

  test('should open theme dropdown from footer', async ({ page }) => {
    const app = createAppPage(page)
    await app.headerFooter.openThemeMenu()
    await expect(
      page.getByRole('menu').filter({ hasText: /color theme|slate|aurora/i })
    ).toBeVisible({ timeout: 2000 })
    await page.keyboard.press('Escape')
  })

  test('should open Structure tab from footer', async ({ page }) => {
    const app = createAppPage(page)
    await app.headerFooter.openStructure()
    await expect(app.tabs.tab(/structure/i)).toBeVisible({ timeout: 3000 })
  })
})
