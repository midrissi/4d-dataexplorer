import type { Page } from '@playwright/test'
import { waitForAppReady } from '../helpers/app'
import { getDataExplorerUrl } from '../helpers/config'
import { BasePage } from './base.page'

interface LoginResponse {
  isLogged?: boolean
  errors?: string[]
}

export class LoginPage extends BasePage {
  /** Data Explorer access-key field (not the 4D WebAdmin `/login.html` form). */
  readonly accessKeyInput = this.page.locator('#accessKey')

  readonly continueButton = this.page.getByRole('button', { name: /^continue$/i })

  readonly title = this.page.getByRole('heading', { name: /data explorer/i })

  async loginViaApi(accessKey = '123'): Promise<void> {
    const baseUrl = getDataExplorerUrl()
    const response = await this.page.request.post(`${baseUrl}/api/login`, {
      multipart: { accessKey },
    })
    const body = (await response.json()) as LoginResponse
    if (!body.isLogged) {
      throw new Error(`Login failed: ${body.errors?.join(', ') || 'Unknown error'}`)
    }
    await this.page.goto(`${baseUrl}/dataexplorer/`)
    await waitForAppReady(this.page)
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await waitForAppReady(this.page)
      return true
    } catch {
      return false
    }
  }

  /**
   * True only for Data Explorer's AccessKeyScreen.
   * Does not match 4D WebAdmin login (`Validate` / `/login.html`).
   */
  async isAccessKeyScreenVisible(): Promise<boolean> {
    if (this.page.url().includes('login.html')) return false
    const hasInput = await this.isVisible(this.accessKeyInput, 3000)
    if (!hasInput) return false
    const hasContinue = await this.isVisible(this.continueButton, 1000)
    const hasTitle = await this.isVisible(this.title, 1000)
    return hasContinue || hasTitle
  }

  async submitAccessKey(accessKey: string): Promise<void> {
    await this.accessKeyInput.fill(accessKey)
    await this.continueButton.click()
    await waitForAppReady(this.page)
  }
}

export function createLoginPage(page: Page): LoginPage {
  return new LoginPage(page)
}
