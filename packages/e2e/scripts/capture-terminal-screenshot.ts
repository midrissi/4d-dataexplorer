/**
 * Captures ORDA Terminal docs screenshots (dark + light).
 * Usage: DATAEXPLORER_URL=http://localhost:3002 bun run ./scripts/capture-terminal-screenshot.ts
 *        bun run ./scripts/capture-terminal-screenshot.ts --mode dark 37
 */

import {
  bootstrapDocCaptureSession,
  handleDocScreenshotCli,
  logDocScreenshotStep,
  parseDocScreenshotArgs,
  runDocScreenshotThemes,
  TERMINAL_SCREENSHOT_PAGE_NAMES,
} from './doc-screenshot-capture'

async function main(): Promise<void> {
  const selection = parseDocScreenshotArgs(process.argv.slice(2), TERMINAL_SCREENSHOT_PAGE_NAMES)
  if (
    handleDocScreenshotCli(
      selection,
      './scripts/capture-terminal-screenshot.ts',
      TERMINAL_SCREENSHOT_PAGE_NAMES
    )
  ) {
    return
  }

  await runDocScreenshotThemes({
    label: 'ORDA terminal',
    defaultBaseUrl: 'http://localhost:3002',
    themes: selection.themes,
    concurrency: selection.concurrency,
    async capture(ctx) {
      const { app } = ctx
      logDocScreenshotStep('🎨', `Capturing ${ctx.theme} theme`)
      await bootstrapDocCaptureSession(ctx, { resetThemeToDefault: true })
      await app.tabs.closeClosableTabs()
      await app.tabs.goHome()
      await ctx.page.waitForTimeout(400)

      if (selection.isSelected('37-terminal-panel')) {
        logDocScreenshotStep('⌨️', 'Terminal REPL')
        await app.terminal.open()
        await app.terminal.ensureTallPanel()
        await app.terminal.switchToReplMode()
        await app.terminal.runExpression('ds.Car.all()')
        await app.screenshot('37-terminal-panel')
      }

      if (selection.isSelected('38-terminal-code')) {
        logDocScreenshotStep('📄', 'Terminal Code / snippets')
        if (!(await app.terminal.isOpen())) {
          await app.terminal.open()
          await app.terminal.ensureTallPanel()
        }
        await app.terminal.switchToCodeMode()
        await ctx.page.waitForTimeout(600)
        await app.screenshot('38-terminal-code')
      }
    },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
