import { BasePage } from './base.page'
import { CommandPalettePage } from './command-palette.page'

export class TabBarPage extends BasePage {
  readonly tablist = this.page.getByRole('tablist')

  readonly homeTab = this.page.getByRole('tab', { name: /home/i })

  readonly emptyState = this.page.getByText('No tabs open')

  tab(name: string | RegExp) {
    return this.page.getByRole('tab', { name })
  }

  async goHome(): Promise<void> {
    if (await this.isVisible(this.homeTab, 2000)) {
      await this.homeTab.click()
      await this.pause(500)
      return
    }

    const palette = new CommandPalettePage(this.page)
    await palette.openFromHeader()
    await palette.openHome()
  }

  async closeClosableTabs(): Promise<void> {
    if (!(await this.isVisible(this.tablist, 1000))) {
      return
    }

    // Full-screen AI tasks backdrop intercepts tab close clicks — dismiss first.
    for (let i = 0; i < 3; i++) {
      const backdrop = this.page.locator('button[aria-label="Close"].absolute.inset-0').first()
      if (!(await this.isVisible(backdrop, 200))) break
      await backdrop.evaluate((el) => (el as HTMLButtonElement).click())
      await this.pause(200)
    }

    const closeButtons = this.tablist.getByRole('tab').getByRole('button')
    let remaining = await closeButtons.count()
    for (let i = 0; i < 20 && remaining > 0; i++) {
      await closeButtons.first().click()
      await this.pause(200)
      remaining = await closeButtons.count()
    }
  }

  async closeTab(name: string | RegExp): Promise<void> {
    const tab = this.tab(name)
    await tab.getByRole('button').click()
  }
}
