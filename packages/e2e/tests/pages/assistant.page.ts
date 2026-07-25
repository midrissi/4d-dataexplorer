import { BasePage } from './base.page'

export class AssistantPage extends BasePage {
  readonly panel = this.page.locator('.assistant-chatbot')

  readonly openButton = this.page.getByRole('button', { name: /^open assistant$/i })

  readonly dialogCloseButton = this.panel.getByRole('button', { name: /^close assistant$/i })

  readonly footerCloseButton = this.page.getByRole('button', {
    name: /^close assistant$/i,
    pressed: true,
  })

  async isOpen(): Promise<boolean> {
    return this.isVisible(this.panel, 500)
  }

  async open(): Promise<void> {
    await this.openButton.click()
    await this.panel.waitFor({ state: 'visible', timeout: 5000 })
    await this.pause(500)
  }

  async close(): Promise<void> {
    if (!(await this.isOpen())) {
      return
    }

    if (await this.isVisible(this.dialogCloseButton, 1000)) {
      await this.dialogCloseButton.click()
    } else if (await this.isVisible(this.footerCloseButton, 1000)) {
      await this.footerCloseButton.click()
    }

    await this.panel.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    await this.pause(300)
  }

  async closeIfOpen(): Promise<void> {
    await this.close()
  }
}
