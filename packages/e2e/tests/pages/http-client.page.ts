import { BasePage } from './base.page'
import { openCommandPaletteShortcut } from './command-palette.page'

/** Sample files served from the connected 4D WebFolder (http://localhost/…). */
export const HTTP_CLIENT_SAMPLE_ORIGIN = 'http://localhost'

export class HttpClientPage extends BasePage {
  readonly title = this.page.getByText('HTTP Client', { exact: true }).first()

  readonly sendButton = this.page.getByRole('button', { name: /^Send$/i })

  readonly pathInput = this.page.getByLabel(/^URL path$/i)

  readonly methodInput = this.page.getByLabel(/^Method$/i)

  readonly serverInput = this.page.getByLabel(/^Server$/i)

  readonly settingsTab = this.page.getByRole('main').getByRole('button', { name: /^Settings$/i })

  readonly historyButton = this.page.getByRole('button', { name: /^History$/i })

  readonly responseHeading = this.page.getByRole('heading', { name: /^Response$/i })

  async openFromToolsMenu(): Promise<void> {
    const tools = this.page.getByRole('button', { name: 'Tools' })
    const item = this.page.getByRole('menuitem', { name: /^HTTP Client$/i })

    for (let attempt = 0; attempt < 3; attempt++) {
      await tools.click()
      if (await this.isVisible(item, 2500)) {
        await item.click()
        await this.title.waitFor({ state: 'visible', timeout: 8000 })
        await this.pause(600)
        return
      }
      await this.page.keyboard.press('Escape')
      await this.pause(300)
    }

    await this.openFromCommandPalette()
  }

  async openFromCommandPalette(): Promise<void> {
    await this.page.locator('header h1').first().click()
    await this.page.keyboard.press(openCommandPaletteShortcut)
    const palette = this.page.locator('.command-palette').first()
    await palette.waitFor({ state: 'visible', timeout: 8000 })
    await palette.getByPlaceholder(/type a command/i).fill('HTTP Client')
    await this.pause(400)
    await palette.getByRole('button', { name: /^HTTP Client$/i }).click()
    await this.title.waitFor({ state: 'visible', timeout: 8000 })
    await this.pause(600)
  }

  async setPath(path: string): Promise<void> {
    await this.pathInput.waitFor({ state: 'visible', timeout: 8000 })
    await this.pathInput.fill(path)
    await this.pause(300)
  }

  async setMethod(method: string): Promise<void> {
    await this.methodInput.waitFor({ state: 'visible', timeout: 8000 })
    await this.methodInput.fill(method)
    await this.pause(200)
  }

  async setServer(origin: string): Promise<void> {
    await this.serverInput.waitFor({ state: 'visible', timeout: 8000 })
    await this.serverInput.fill(origin)
    await this.pause(300)
  }

  async openSettingsTab(): Promise<void> {
    await this.settingsTab.click()
    await this.pause(400)
    await this.page
      .getByText(/Session|Timing|Redirects/i)
      .first()
      .waitFor({
        state: 'visible',
        timeout: 5000,
      })
  }

  async openHistory(): Promise<void> {
    await this.historyButton.click()
    await this.page
      .getByText(/Last requests|No requests yet/i)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
    await this.pause(400)
  }

  /**
   * Send the current request and wait until the empty response state is gone.
   */
  async send(): Promise<void> {
    await this.sendButton.waitFor({ state: 'visible', timeout: 5000 })
    if (await this.sendButton.isDisabled()) {
      throw new Error('Send button is disabled — request may be incomplete')
    }
    await this.sendButton.click()
    await this.pause(300)
    const empty = this.page.getByText(/Waiting for a response|Send a request to see/i)
    await empty.waitFor({ state: 'hidden', timeout: 30000 })
    await this.pause(500)
  }

  /** GET a WebFolder sample from a custom origin (default http://localhost). */
  async requestSample(path: string, origin = HTTP_CLIENT_SAMPLE_ORIGIN): Promise<void> {
    await this.setMethod('GET')
    await this.setServer(origin)
    await this.setPath(path)
    await this.send()
  }

  /** Open binary fallback text preview (markdown / RTF / unknown binary). */
  async previewBinaryAsText(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /^Preview as text$/i })
    await btn.waitFor({ state: 'visible', timeout: 8000 })
    await btn.click()
    await this.page
      .getByText(/^View$/i)
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
    await this.pause(600)
  }

  async selectTextPreviewMode(mode: 'Code' | 'HTML' | 'Markdown' | 'JSON' | 'CSV'): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`^${mode}$`, 'i') }).click()
    await this.pause(400)
  }

  async waitForResponseStatus(status: number | string): Promise<void> {
    await this.page
      .getByText(new RegExp(`^${status}\\b`))
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
  }

  async waitForContentType(fragment: string): Promise<void> {
    await this.page
      .getByText(new RegExp(fragment, 'i'))
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
  }

  /**
   * Wait until PDF.js has painted the first page into the preview canvas.
   */
  async waitForPdfPreviewLoaded(timeoutMs = 25_000): Promise<void> {
    const preview = this.page.locator('[data-pdf-preview][data-pdf-ready="true"]')
    await preview.waitFor({ state: 'visible', timeout: timeoutMs })
    await this.page.locator('[data-pdf-preview] canvas').first().waitFor({
      state: 'visible',
      timeout: 5_000,
    })
    await this.pause(300)
  }
}
