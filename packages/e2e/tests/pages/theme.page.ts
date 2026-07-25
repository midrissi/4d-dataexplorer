import type { Page } from '@playwright/test'
import { BasePage } from './base.page'

const PROFILES_KEY = 'dataexplorer:profiles'
const DEFAULT_THEME = 'dark'
const DEFAULT_THEME_NAME = 'tangerine'

export type AppColorTheme = 'dark' | 'light'

export class ThemePage extends BasePage {
  constructor(
    page: Page,
    private readonly captureTheme?: AppColorTheme
  ) {
    super(page)
  }

  async setTheme(theme: AppColorTheme, themeName = DEFAULT_THEME_NAME): Promise<void> {
    await this.persistTheme(theme, themeName)
    await this.syncThemeViaUi(theme)
    await this.waitForTheme(theme)
  }

  async resetToDefault(): Promise<void> {
    await this.setTheme(this.captureTheme ?? DEFAULT_THEME)
  }

  private async persistTheme(theme: AppColorTheme, themeName: string): Promise<void> {
    await this.page.evaluate(
      ({ profilesKey, theme: nextTheme, themeName: nextThemeName }) => {
        const root = document.documentElement
        root.classList.toggle('dark', nextTheme === 'dark')
        root.setAttribute('data-theme', nextThemeName)

        const raw = localStorage.getItem(profilesKey)
        const data = raw
          ? (JSON.parse(raw) as {
              current?: string
              profiles?: Record<string, { name?: string; settings?: Record<string, unknown> }>
            })
          : { current: 'default', profiles: { default: { name: 'Default', settings: {} } } }

        const currentId = data.current ?? 'default'
        data.profiles ??= {}
        data.profiles[currentId] ??= { name: 'Default', settings: {} }

        const profile = data.profiles[currentId]
        profile.settings = { ...profile.settings, theme: nextTheme, themeName: nextThemeName }

        const nextValue = JSON.stringify(data)
        localStorage.setItem(profilesKey, nextValue)
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: profilesKey,
            newValue: nextValue,
          })
        )
      },
      { profilesKey: PROFILES_KEY, theme, themeName }
    )
  }

  private async syncThemeViaUi(theme: AppColorTheme): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const isDark = await this.page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )
      if ((theme === 'dark') === isDark) return

      const toggle = this.page.getByRole('button', {
        name: isDark ? /^Light mode$/i : /^Dark mode$/i,
      })
      if (!(await this.isVisible(toggle, 800))) return

      await toggle.click()
      await this.pause(350)
    }
  }

  private async waitForTheme(theme: AppColorTheme): Promise<void> {
    await this.page
      .waitForFunction(
        ({ expectedTheme }) => {
          const isDark = document.documentElement.classList.contains('dark')
          return expectedTheme === 'dark' ? isDark : !isDark
        },
        { expectedTheme: theme },
        { timeout: 5000 }
      )
      .catch(() => {})

    // Density tokens must remain stable across palette/mode switches
    await this.page
      .waitForFunction(() => {
        const styles = getComputedStyle(document.documentElement)
        const rowH = styles.getPropertyValue('--row-h').trim()
        const radiusSm = styles.getPropertyValue('--radius-sm').trim()
        const controlSm = styles.getPropertyValue('--control-h-sm').trim()
        return Boolean(rowH && radiusSm && controlSm)
      })
      .catch(() => {})

    await this.pause(200)
  }

  /** Smoke: apply light/dark for a named palette and assert density tokens. */
  async smokePalette(themeName: string, theme: AppColorTheme = 'dark'): Promise<void> {
    await this.setTheme(theme, themeName)
    const ok = await this.page.evaluate(() => {
      const root = document.documentElement
      const styles = getComputedStyle(root)
      return {
        theme: root.getAttribute('data-theme'),
        rowH: styles.getPropertyValue('--row-h').trim(),
        radiusSm: styles.getPropertyValue('--radius-sm').trim(),
        success: styles.getPropertyValue('--success').trim(),
      }
    })
    if (!ok.rowH || !ok.radiusSm || !ok.success) {
      throw new Error(`Density tokens missing for theme ${themeName}/${theme}`)
    }
  }
}
