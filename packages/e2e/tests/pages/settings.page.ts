import { BasePage } from './base.page'

export class SettingsPage extends BasePage {
  readonly settingsTab = this.page.getByRole('tab', { name: /settings/i })

  readonly dataclassAppearanceButton = this.page
    .getByRole('button')
    .filter({ has: this.page.getByText('Dataclass Appearance', { exact: true }) })
    .first()

  readonly appearanceHeading = this.page.getByRole('heading', { name: 'Appearance', exact: true })

  readonly keyboardShortcutsButton = this.page.getByRole('button', {
    name: 'Keyboard shortcuts',
    exact: true,
  })

  async open(): Promise<void> {
    const headerButton = this.page.getByRole('button', { name: 'Open settings' })
    if (await this.isVisible(headerButton, 1000)) {
      await headerButton.click()
    } else {
      await this.page.getByRole('button', { name: 'Settings' }).click()
    }
    await this.pause(800)
  }

  async openDataclassAppearance(): Promise<void> {
    if (await this.isVisible(this.dataclassAppearanceButton, 2000)) {
      await this.dataclassAppearanceButton.click()
      await this.pause(500)
    }
  }

  async collapseDataclassAppearance(): Promise<void> {
    // Expanded panel exposes Randomize; click the section header to collapse it.
    const randomize = this.page.getByRole('button', { name: /^Randomize$/i })
    if (await this.isVisible(randomize, 500)) {
      await this.dataclassAppearanceButton.click()
      await this.pause(300)
    }
  }

  async scrollDataclassAppearanceIntoView(): Promise<void> {
    await this.dataclassAppearanceButton.scrollIntoViewIfNeeded()
    await this.pause(300)
  }

  async scrollAppearanceIntoView(): Promise<void> {
    await this.appearanceHeading.evaluate((el) => {
      el.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' })
    })
    await this.pause(400)
  }

  async openKeyboardShortcuts(): Promise<void> {
    await this.keyboardShortcutsButton.click()
    await this.pause(800)
  }

  async closeDialogs(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page
      .getByRole('dialog')
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => {})
  }
}
