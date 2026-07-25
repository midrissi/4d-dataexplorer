import { expect, test } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Keyboard Shortcuts Modal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should open when clicking footer keyboard button', async ({ page }) => {
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' })
    await expect(dialog).toBeVisible({ timeout: 3000 })
  })

  test('should display shortcut categories or list', async ({ page }) => {
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' })
    await expect(dialog).toBeVisible({ timeout: 3000 })
    // Modal shows "Customize" button and some shortcut-related content
    await expect(dialog.getByRole('button', { name: 'Customize' })).toBeVisible({ timeout: 2000 })
  })

  test('should close when pressing Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' })
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })
})
