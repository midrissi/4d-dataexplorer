import { BasePage } from './base.page'

export type MethodExecutorScopeLabel = 'Datastore' | 'Dataclass' | 'Entity' | 'Entity selection'

export class MethodExecutorPage extends BasePage {
  readonly title = this.page.getByText('Method Executor', { exact: true }).first()

  readonly searchInput = this.page.getByPlaceholder(/search name,.+signature/i)

  readonly executeButton = this.page.getByRole('button', { name: /^Execute$/i })

  async openFromToolsMenu(): Promise<void> {
    await this.page.getByRole('button', { name: 'Tools', exact: true }).click()
    await this.pause(400)
    await this.page.getByRole('menuitem', { name: /Method Executor/i }).click()
    await this.title.waitFor({ state: 'visible', timeout: 8000 })
    await this.pause(600)
  }

  async selectScope(scope: MethodExecutorScopeLabel): Promise<void> {
    await this.page.getByRole('tab', { name: scope, exact: true }).click()
    await this.pause(300)
  }

  async chooseMethod(methodName: string): Promise<void> {
    await this.page
      .getByText('Loading methods…')
      .waitFor({ state: 'hidden', timeout: 15_000 })
      .catch(() => {})

    if (!(await this.isVisible(this.searchInput, 1500))) {
      await this.clearMethod()
    }

    await this.searchInput.waitFor({ state: 'visible', timeout: 8000 })
    await this.searchInput.fill(methodName)
    await this.pause(400)
    const methodButton = this.page
      .locator('button')
      .filter({ has: this.page.locator('code').getByText(methodName, { exact: true }) })
      .first()
    await methodButton.waitFor({ state: 'visible', timeout: 8000 })
    await methodButton.click()
    await this.pause(500)
  }

  async clearMethod(): Promise<void> {
    const clear = this.page.getByRole('button', { name: /Choose a method/i })
    if (await this.isVisible(clear, 1500)) {
      await clear.click()
      await this.pause(300)
    }
  }

  /**
   * Set a positional argument value.
   * Prefers visible string/number inputs (`String: $1`); falls back to a writable Monaco custom editor.
   */
  async setArgumentValue(index: number, value: string): Promise<void> {
    const scalarInput = this.page
      .locator('input[name^="method-argument-"][name$="-value"]:visible')
      .nth(index)
    if (await this.isVisible(scalarInput, 1500)) {
      await scalarInput.fill(value)
      await this.pause(200)
      return
    }

    const editor = this.page.locator('.monaco-editor:not([aria-hidden="true"])').nth(index)
    await editor.waitFor({ state: 'visible', timeout: 8000 })
    await editor.click()
    await this.pause(150)

    const setViaMonaco = await this.page.evaluate(
      ({ editorIndex, nextValue }) => {
        const monaco = (
          window as unknown as {
            monaco?: {
              editor: {
                EditorOption: { readOnly: number }
                getEditors: () => Array<{
                  getOption: (option: number) => unknown
                  setValue: (value: string) => void
                  getModel: () => { setValue: (value: string) => void } | null
                }>
              }
            }
          }
        ).monaco
        if (!monaco?.editor?.getEditors) return false
        const editors = monaco.editor.getEditors()
        const readOnlyOpt = monaco.editor.EditorOption?.readOnly
        const writable = editors.filter((ed) => {
          if (readOnlyOpt === undefined) return true
          return !ed.getOption(readOnlyOpt)
        })
        const target = writable[editorIndex] ?? editors[editorIndex]
        if (!target) return false
        target.setValue(nextValue)
        return true
      },
      { editorIndex: index, nextValue: value }
    )

    if (!setViaMonaco) {
      const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a'
      await this.page.keyboard.press(selectAll)
      await this.page.keyboard.press('Backspace')
      // insertText avoids Monaco quote auto-pairing that breaks keyboard.type
      await this.page.keyboard.insertText(value)
    }
    await this.pause(300)
  }

  /** @deprecated Prefer `setArgumentValue` — kept for existing call sites. */
  async setCustomArgumentValue(index: number, value: string): Promise<void> {
    await this.setArgumentValue(index, value)
  }

  readonly resultHeading = this.page.getByRole('heading', { name: 'Result', exact: true })

  readonly resultSection = this.page.locator('section').filter({ has: this.resultHeading })

  /**
   * Run the configured method and wait until the result panel leaves the empty state.
   * Optional `ready` locator waits for a specialized result view (entity / selection / JSON).
   */
  async execute(ready?: { name: string | RegExp } | { text: string | RegExp }): Promise<void> {
    await this.executeButton.waitFor({ state: 'visible', timeout: 5000 })
    if (await this.executeButton.isDisabled()) {
      throw new Error('Execute button is disabled — arguments may be invalid')
    }
    await this.executeButton.click()
    await this.pause(300)
    await this.executeButton
      .locator('svg.animate-spin')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})
    const empty = this.resultSection.getByText(/Execute a method to inspect its result/i)
    await empty.waitFor({ state: 'hidden', timeout: 30000 })
    if (ready && 'name' in ready) {
      await this.resultSection.getByRole('button', { name: ready.name }).waitFor({
        state: 'visible',
        timeout: 15000,
      })
    } else if (ready && 'text' in ready) {
      await this.resultSection.getByText(ready.text).first().waitFor({
        state: 'visible',
        timeout: 15000,
      })
    }
    await this.pause(500)
  }
}
