import { BasePage } from './base.page'

export const COMMAND_PALETTE_SELECTOR = '.command-palette'

export const openCommandPaletteShortcut = process.platform === 'darwin' ? 'Meta+p' : 'Control+p'

export class CommandPalettePage extends BasePage {
  readonly palette = this.page.locator(COMMAND_PALETTE_SELECTOR).first()

  readonly headerSearch = this.page.getByRole('textbox', { name: 'Open command palette' })

  readonly footerButton = this.page.getByRole('button', { name: 'Open command palette' }).last()

  readonly commandInput = this.palette.getByPlaceholder(/type a command/i)

  async openFromHeader(): Promise<void> {
    await this.headerSearch.click()
    await this.palette.waitFor({ state: 'visible', timeout: 5000 })
  }

  async openFromFooter(): Promise<void> {
    await this.footerButton.click()
    await this.palette.waitFor({ state: 'visible', timeout: 5000 })
  }

  async openWithShortcut(): Promise<void> {
    await this.page.locator('header h1').first().click()
    await this.page.keyboard.press(openCommandPaletteShortcut)
    await this.palette.waitFor({ state: 'visible', timeout: 8000 })
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.palette.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  }

  async search(query: string): Promise<void> {
    await this.commandInput.fill(query)
    await this.pause(400)
  }

  async runCommand(name: string | RegExp): Promise<void> {
    await this.palette.getByRole('button', { name }).click()
  }

  async openHome(): Promise<void> {
    await this.search('home')
    await this.runCommand(/open home/i)
    await this.pause(500)
  }

  async openSettings(): Promise<void> {
    await this.search('settings')
    await this.runCommand('Open Settings')
  }
}
