import { BasePage } from './base.page'

export class HomePage extends BasePage {
  readonly dataclassesHeading = this.page.getByRole('heading', { name: 'All Dataclasses' })

  readonly dataclassButtons = this.page
    .locator('button[type="button"]')
    .filter({ hasText: /^#\d+/ })

  readonly mainContent = this.page.locator('main, [aria-label="Entity explorer"]')

  async openFirstDataclass(): Promise<boolean> {
    if ((await this.dataclassButtons.count()) === 0) {
      return false
    }
    await this.dataclassButtons.first().click()
    await this.pause(1500)
    return true
  }
}
