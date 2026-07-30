import { BasePage } from './base.page'

export class TerminalPage extends BasePage {
  readonly panel = this.page.getByRole('region', { name: /^terminal$/i })

  readonly openButton = this.page.locator('footer').getByRole('button', {
    name: /^(open terminal|terminal)$/i,
  })

  readonly footerToggle = this.page.locator('footer').getByRole('button', {
    name: /terminal/i,
  })

  readonly runButton = this.page.getByRole('button', { name: /^run$/i })

  readonly dockTab = this.page.getByRole('button', { name: /^terminal$/i }).first()

  async isOpen(): Promise<boolean> {
    return this.isVisible(this.panel, 500)
  }

  async open(): Promise<void> {
    if (await this.isOpen()) {
      return
    }

    if (await this.isVisible(this.openButton, 2000)) {
      await this.openButton.click()
    } else if (await this.isVisible(this.footerToggle, 1000)) {
      await this.footerToggle.click()
    } else {
      await this.page.getByRole('button', { name: /^open terminal$/i }).click()
    }

    await this.panel.waitFor({ state: 'visible', timeout: 8000 })
    await this.pause(500)
  }

  async close(): Promise<void> {
    if (!(await this.isOpen())) {
      return
    }

    const closeInPanel = this.page.getByRole('button', { name: /^close terminal$/i })
    if (await this.isVisible(closeInPanel, 1000)) {
      await closeInPanel.click()
    } else if (await this.isVisible(this.footerToggle, 1000)) {
      await this.footerToggle.click()
    }

    await this.panel.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    await this.pause(300)
  }

  async closeIfOpen(): Promise<void> {
    await this.close()
  }

  /** Grow the docked panel so the composer and output are visible in screenshots. */
  async ensureTallPanel(steps = 40): Promise<void> {
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

  /** Focus Monaco and type an expression, then run via ⌘/Ctrl+Enter. */
  async runExpression(code: string): Promise<void> {
    const editor = this.panel.locator('.monaco-editor').first()
    await editor.waitFor({ state: 'visible', timeout: 10000 })
    await editor.click()
    await this.pause(200)
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await this.page.keyboard.press(`${mod}+A`)
    await this.page.keyboard.type(code, { delay: 15 })
    await this.pause(300)
    // Prefer the chord — Run stays disabled until Monaco syncs draft into React state.
    await this.page.keyboard.press(`${mod}+Enter`)
    await this.pause(1500)
  }

  async switchToCodeMode(): Promise<void> {
    const code = this.panel.getByRole('button', { name: /^code$/i })
    if (await this.isVisible(code, 2000)) {
      await code.click()
      await this.pause(400)
    }
  }

  async switchToReplMode(): Promise<void> {
    const repl = this.panel.getByRole('button', { name: /^repl$/i })
    if (await this.isVisible(repl, 2000)) {
      await repl.click()
      await this.pause(400)
    }
  }
}
