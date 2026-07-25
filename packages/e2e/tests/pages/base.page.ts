import type { Locator, Page } from '@playwright/test'

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected async isVisible(locator: Locator, timeout = 500): Promise<boolean> {
    return locator.isVisible({ timeout }).catch(() => false)
  }

  protected async pause(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms)
  }
}
