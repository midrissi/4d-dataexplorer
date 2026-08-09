import { BasePage } from './base.page'

export class DataclassViewPage extends BasePage {
  readonly querySection = this.page.locator('[data-query-builder-panel]')

  readonly queryToggleButton = this.querySection.getByRole('button', {
    name: /^(Expand|Collapse) panel$/i,
  })

  readonly filterExpressionLabel = this.querySection.getByText('Filter Expression', {
    exact: true,
  })

  readonly entityCard = this.page
    .locator('main')
    .locator('[class*="cursor-pointer"], [class*="hover:bg"]')
    .filter({ has: this.page.locator('text=/^ID\\b|^id\\b/') })
    .first()

  /** Cards / table toggle in the entity list toolbar (icon-only buttons). */
  private readonly viewModeToggle = this.page.locator('main div.rounded-md.border.bg-muted\\/50')

  private readonly cardsViewButton = this.viewModeToggle.locator('button').first()

  private readonly tableViewButton = this.viewModeToggle.locator('button').nth(1)

  private readonly entityTable = this.page.locator('main .ag-root-wrapper').first()

  async openQueryBuilder(): Promise<void> {
    if (!(await this.isVisible(this.querySection, 2000))) {
      return
    }

    if (await this.isVisible(this.filterExpressionLabel, 500)) {
      return
    }

    if (!(await this.isVisible(this.queryToggleButton, 2000))) {
      return
    }

    await this.queryToggleButton.click()
    await this.filterExpressionLabel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await this.pause(500)
  }

  async openFirstEntity(): Promise<boolean> {
    if (!(await this.isVisible(this.entityCard, 3000))) {
      return false
    }
    await this.entityCard.click()
    await this.pause(1000)
    return true
  }

  async switchToTableView(): Promise<boolean> {
    if (!(await this.isVisible(this.viewModeToggle, 2000))) {
      return false
    }
    await this.tableViewButton.click()
    await this.pause(800)
    return this.isVisible(this.entityTable, 3000)
  }

  async switchToCardsView(): Promise<boolean> {
    if (!(await this.isVisible(this.viewModeToggle, 2000))) {
      return false
    }
    await this.cardsViewButton.click()
    await this.pause(800)
    return this.isVisible(this.entityCard, 3000)
  }
}
