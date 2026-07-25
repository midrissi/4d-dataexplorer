import { BasePage } from './base.page'

export class StructureGraphPage extends BasePage {
  readonly graph = this.page.locator('.react-flow')

  readonly autoOrganizeButton = this.page.getByRole('button', {
    name: /auto organize graph layout/i,
  })

  readonly showSelectedOnlyButton = this.page.getByRole('button', {
    name: /show selected only/i,
  })

  readonly fitViewButton = this.page.getByRole('button', { name: /^fit to view$/i })

  readonly sidebar = this.page.getByRole('navigation', { name: /dataclasses/i })

  private dataclassSidebarEntry(dataclassName: string) {
    return this.sidebar.getByRole('button', {
      name: new RegExp(`^${dataclassName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} - `),
    })
  }

  async highlightDataclass(dataclassName: string): Promise<void> {
    const entry = this.dataclassSidebarEntry(dataclassName)
    await entry.scrollIntoViewIfNeeded()
    await entry.hover()

    const cardsHighlight = entry.locator('.absolute button').first()
    if (await this.isVisible(cardsHighlight, 1000)) {
      await cardsHighlight.click({ force: true })
    } else {
      const group = this.sidebar.locator('.group').filter({
        has: this.page.getByText(dataclassName, { exact: true }),
      })
      await group.first().hover()
      const titledHighlight = group.getByRole('button', { name: 'Highlight in structure graph' })
      if (await this.isVisible(titledHighlight, 1000)) {
        await titledHighlight.click({ force: true })
      } else {
        await group.locator('button').first().click({ force: true })
      }
    }

    await this.page
      .getByRole('tab', { name: /structure/i })
      .waitFor({ state: 'visible', timeout: 10000 })
    await this.graph.waitFor({ state: 'visible', timeout: 10000 })
    await this.pause(1500)
  }

  async showSelectedOnly(): Promise<void> {
    await this.showSelectedOnlyButton.waitFor({ state: 'visible', timeout: 5000 })
    for (let i = 0; i < 15; i++) {
      if (!(await this.showSelectedOnlyButton.isDisabled())) {
        break
      }
      await this.pause(200)
    }
    await this.showSelectedOnlyButton.click()
    await this.pause(500)
  }

  async autoOrganizeGraph(): Promise<void> {
    await this.autoOrganizeButton.waitFor({ state: 'visible', timeout: 5000 })
    await this.autoOrganizeButton.click()
    await this.pause(2000)
  }

  async fitView(): Promise<void> {
    await this.fitViewButton.waitFor({ state: 'visible', timeout: 5000 })
    await this.fitViewButton.click()
    await this.pause(800)
  }
}
