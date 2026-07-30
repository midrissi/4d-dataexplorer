/**
 * Captures only the console panel docs screenshot (dark + light).
 * Usage: DATAEXPLORER_URL=http://localhost:3002 bun run ./scripts/capture-console-screenshot.ts
 *        bun run ./scripts/capture-console-screenshot.ts --mode dark 22
 */

import {
  bootstrapDocCaptureSession,
  CONSOLE_SCREENSHOT_PAGE_NAMES,
  handleDocScreenshotCli,
  logDocScreenshotStep,
  parseDocScreenshotArgs,
  runDocScreenshotThemes,
} from './doc-screenshot-capture'

async function main(): Promise<void> {
  const selection = parseDocScreenshotArgs(process.argv.slice(2), CONSOLE_SCREENSHOT_PAGE_NAMES)
  if (
    handleDocScreenshotCli(
      selection,
      './scripts/capture-console-screenshot.ts',
      CONSOLE_SCREENSHOT_PAGE_NAMES
    )
  ) {
    return
  }

  await runDocScreenshotThemes({
    label: 'console panel',
    defaultBaseUrl: 'http://localhost:3002',
    themes: selection.themes,
    concurrency: selection.concurrency,
    async capture(ctx) {
      const { app, theme } = ctx
      logDocScreenshotStep('🎨', `Capturing ${theme} theme`)
      await bootstrapDocCaptureSession(ctx, { resetThemeToDefault: true })
      await app.tabs.closeClosableTabs()
      await app.tabs.goHome()
      await ctx.page.waitForTimeout(400)
      logDocScreenshotStep('📟', 'Console panel')
      await app.console.open()
      await app.console.ensureTallPanel()
      await app.console.waitForNetworkEntries()
      await app.console.expandFirstNetworkEntry()
      await app.screenshot('22-console-panel')
    },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
