import { BasePage } from './base.page'

export class ConsolePage extends BasePage {
  readonly panel = this.page.getByRole('region', { name: /^console$/i })

  readonly openButton = this.page.locator('footer').getByRole('button', {
    name: /^(open console|console)$/i,
  })

  readonly closeButton = this.page.getByRole('button', { name: /^close console$/i })

  readonly footerToggle = this.page.locator('footer').getByRole('button', {
    name: /console/i,
  })

  readonly networkRows = this.panel
    .locator('[role="button"][aria-expanded]')
    .filter({ hasText: /(GET|POST|PUT|PATCH|DELETE)/i })

  async isOpen(): Promise<boolean> {
    return this.isVisible(this.panel, 500)
  }

  async open(): Promise<void> {
    if (await this.isOpen()) {
      return
    }

    if (await this.isVisible(this.openButton, 2000)) {
      await this.openButton.click()
    } else {
      await this.page.getByRole('button', { name: /^open console$/i }).click()
    }

    await this.panel.waitFor({ state: 'visible', timeout: 5000 })
    await this.pause(400)
  }

  async close(): Promise<void> {
    if (!(await this.isOpen())) {
      return
    }

    if (await this.isVisible(this.panel.getByRole('button', { name: /^close console$/i }), 1000)) {
      await this.panel.getByRole('button', { name: /^close console$/i }).click()
    } else if (await this.isVisible(this.footerToggle, 1000)) {
      await this.footerToggle.click()
    }

    await this.panel.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    await this.pause(300)
  }

  async closeIfOpen(): Promise<void> {
    await this.close()
  }

  /** Grow the docked panel so network details are visible in screenshots. */
  async ensureTallPanel(steps = 18): Promise<void> {
    const handle = this.page.getByRole('button', { name: /resize panel/i }).last()
    if (!(await this.isVisible(handle, 1000))) {
      return
    }
    await handle.focus()
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('ArrowUp')
    }
    await this.pause(200)
  }

  async waitForNetworkEntries(): Promise<void> {
    await this.networkRows.first().waitFor({ state: 'visible', timeout: 15000 })
    await this.pause(300)
  }

  async expandFirstNetworkEntry(): Promise<void> {
    const row = this.networkRows.first()
    if (!(await this.isVisible(row, 2000))) {
      return
    }
    const expanded = await row.getAttribute('aria-expanded')
    if (expanded !== 'true') {
      await row.click()
      await this.pause(400)
    }
  }
}
