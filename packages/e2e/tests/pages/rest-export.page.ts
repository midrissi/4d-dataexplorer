import { BasePage } from './base.page'

export class RestExportPage extends BasePage {
  readonly title = this.page.getByRole('heading', { name: 'REST Export', exact: true }).first()

  readonly previewStep = this.page.getByRole('button', { name: /Preview/i })

  async openFromToolsMenu(): Promise<void> {
    const tools = this.page.getByRole('button', { name: 'Tools' })
    const item = this.page.getByRole('menuitem', { name: /REST Export/i })

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

    throw new Error('Could not open REST Export from the Tools menu')
  }

  async waitForCatalog(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Dataclasses', exact: true }).waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    await this.pause(400)
  }

  async goToPreview(): Promise<void> {
    await this.previewStep.click()
    await this.page.getByText(/folders · .+ requests/i).waitFor({
      state: 'visible',
      timeout: 8000,
    })
    await this.pause(400)
  }

  async expandAllFolders(): Promise<void> {
    const expandAll = this.page.getByRole('button', { name: 'Expand all' })
    if (await this.isVisible(expandAll, 2000)) {
      await expandAll.click()
      await this.pause(400)
    }
  }
}
