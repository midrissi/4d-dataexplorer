import { BasePage } from './base.page'

export class HeaderFooterPage extends BasePage {
  readonly structureButton = this.page.getByRole('button', { name: 'Structure', exact: true })

  readonly releaseNotesButton = this.page.locator('[aria-label="Release notes"]')

  readonly collapseSidebarButton = this.page.getByRole('button', { name: 'Collapse sidebar' })

  readonly expandSidebarButton = this.page.getByRole('button', { name: 'Expand sidebar' })

  readonly editModeButton = this.page.getByRole('button', { name: /edit mode/i })

  readonly readOnlyButton = this.page.getByRole('button', { name: /read only/i })

  readonly themeButton = this.page.getByRole('button', { name: 'Theme' })

  readonly toolsButton = this.page.getByRole('button', { name: 'Tools', exact: true })

  readonly sidebar = this.page.locator('[class*="border-r"]').first()

  async openStructure(): Promise<void> {
    await this.structureButton.click()
    await this.pause(2000)
  }

  async openReleaseNotes(): Promise<void> {
    await this.releaseNotesButton.click()
    await this.pause(1000)
  }

  async collapseSidebar(): Promise<boolean> {
    if (!(await this.isVisible(this.collapseSidebarButton, 2000))) {
      return false
    }
    await this.collapseSidebarButton.click()
    await this.pause(600)
    return true
  }

  async expandSidebar(): Promise<void> {
    await this.expandSidebarButton.click().catch(() => {})
    await this.pause(400)
  }

  async enableReadOnlyMode(): Promise<boolean> {
    if (!(await this.isVisible(this.editModeButton, 2000))) {
      return false
    }
    await this.editModeButton.click()
    await this.pause(500)
    return true
  }

  async disableReadOnlyMode(): Promise<void> {
    await this.readOnlyButton.click().catch(() => {})
    await this.pause(300)
  }

  async openThemeMenu(): Promise<void> {
    await this.themeButton.click()
    await this.pause(500)
  }

  async openToolsMenu(): Promise<void> {
    await this.toolsButton.click()
    await this.pause(400)
  }

  async openTool(name: string | RegExp): Promise<void> {
    await this.openToolsMenu()
    await this.page.getByRole('menuitem', { name }).click()
    await this.pause(1500)
  }
}
