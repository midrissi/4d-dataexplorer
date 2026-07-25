import path from 'node:path'
import type { Page } from '@playwright/test'
import { waitForAppReady, waitForDataclassesLoaded } from '../helpers/app'
import { getDataExplorerUrl } from '../helpers/config'
import { AssistantPage } from './assistant.page'
import { BasePage } from './base.page'
import { CommandPalettePage } from './command-palette.page'
import { ConsolePage } from './console.page'
import { DataclassViewPage } from './dataclass-view.page'
import { HeaderFooterPage } from './header-footer.page'
import { HomePage } from './home.page'
import { HttpClientPage } from './http-client.page'
import { LoginPage } from './login.page'
import { MethodExecutorPage } from './method-executor.page'
import { SettingsPage } from './settings.page'
import { StructureGraphPage } from './structure-graph.page'
import { TabBarPage } from './tab-bar.page'
import { ThemePage } from './theme.page'

type DocThemeMode = 'dark' | 'light'

function screenshotFileName(name: string, theme: DocThemeMode): string {
  return `${theme}/${name}.png`
}

export interface AppPageOptions {
  screenshotDir?: string
  screenshotTheme?: DocThemeMode
}

export class AppPage extends BasePage {
  readonly login: LoginPage
  readonly commandPalette: CommandPalettePage
  readonly tabs: TabBarPage
  readonly home: HomePage
  readonly dataclassView: DataclassViewPage
  readonly settings: SettingsPage
  readonly headerFooter: HeaderFooterPage
  readonly assistant: AssistantPage
  readonly console: ConsolePage
  readonly structureGraph: StructureGraphPage
  readonly methodExecutor: MethodExecutorPage
  readonly httpClient: HttpClientPage
  readonly theme: ThemePage

  constructor(
    page: Page,
    private readonly options: AppPageOptions = {}
  ) {
    super(page)
    this.login = new LoginPage(page)
    this.commandPalette = new CommandPalettePage(page)
    this.tabs = new TabBarPage(page)
    this.home = new HomePage(page)
    this.dataclassView = new DataclassViewPage(page)
    this.settings = new SettingsPage(page)
    this.headerFooter = new HeaderFooterPage(page)
    this.assistant = new AssistantPage(page)
    this.console = new ConsolePage(page)
    this.structureGraph = new StructureGraphPage(page)
    this.methodExecutor = new MethodExecutorPage(page)
    this.httpClient = new HttpClientPage(page)
    this.theme = new ThemePage(page, options.screenshotTheme)
  }

  async goto(): Promise<void> {
    await this.page.goto(`${getDataExplorerUrl()}/dataexplorer/`)
  }

  async waitForReady(): Promise<void> {
    await waitForAppReady(this.page)
  }

  async waitForDataclasses(): Promise<void> {
    await waitForDataclassesLoaded(this.page)
  }

  async closeOverlays(): Promise<void> {
    // AI tasks / confirmation backdrops are full-screen; center clicks hit the
    // dialog above them, so invoke the backdrop button click directly.
    for (let i = 0; i < 3; i++) {
      const backdrop = this.page.locator('button[aria-label="Close"].absolute.inset-0').first()
      if (!(await this.isVisible(backdrop, 200))) break
      await backdrop.evaluate((el) => (el as HTMLButtonElement).click())
      await this.pause(200)
    }
    for (let i = 0; i < 3; i++) {
      await this.page.keyboard.press('Escape')
      await this.pause(150)
    }
  }

  async prepareForNextFeature(): Promise<void> {
    await this.closeOverlays()
    await this.assistant.closeIfOpen()
    await this.console.closeIfOpen()
    await this.theme.resetToDefault()
    await this.tabs.closeClosableTabs()
    await this.tabs.goHome()
    await this.pause(400)
  }

  /** Close overlays and assistant without resetting tabs — use before individual screenshots. */
  async prepareForScreenshot(): Promise<void> {
    await this.closeOverlays()
    await this.assistant.close()
    await this.console.closeIfOpen()
    await this.theme.resetToDefault()
    await this.pause(300)
  }

  async screenshot(name: string): Promise<void> {
    if (!this.options.screenshotDir) {
      throw new Error('screenshotDir is not configured on AppPage')
    }
    if (this.options.screenshotTheme) {
      await this.theme.setTheme(this.options.screenshotTheme)
    }
    const theme = this.options.screenshotTheme
    const relativePath = theme ? screenshotFileName(name, theme) : `${name}.png`
    await this.page.screenshot({
      path: path.join(this.options.screenshotDir, relativePath),
      fullPage: false,
    })
    console.log(`  ✓ ${relativePath}`)
  }
}

export function createAppPage(page: Page, options?: AppPageOptions): AppPage {
  return new AppPage(page, options)
}
