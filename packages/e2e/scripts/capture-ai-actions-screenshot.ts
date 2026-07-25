/**
 * Captures AI actions & tasks docs screenshots (dark + light).
 * Usage: DATAEXPLORER_URL=http://localhost:3002 bun run ./scripts/capture-ai-actions-screenshot.ts
 *        bun run ./scripts/capture-ai-actions-screenshot.ts --mode dark 23 24
 */

import {
  AI_ACTIONS_SCREENSHOT_PAGE_NAMES,
  bootstrapDocCaptureSession,
  captureAiActionsScreenshots,
  handleDocScreenshotCli,
  logDocScreenshotStep,
  parseDocScreenshotArgs,
  runDocScreenshotThemes,
} from './doc-screenshot-capture'

async function main(): Promise<void> {
  const selection = parseDocScreenshotArgs(process.argv.slice(2), AI_ACTIONS_SCREENSHOT_PAGE_NAMES)
  if (
    handleDocScreenshotCli(
      selection,
      './scripts/capture-ai-actions-screenshot.ts',
      AI_ACTIONS_SCREENSHOT_PAGE_NAMES
    )
  ) {
    return
  }

  await runDocScreenshotThemes({
    label: 'AI actions',
    defaultBaseUrl: 'http://localhost:3002',
    themes: selection.themes,
    concurrency: selection.concurrency,
    async capture(ctx) {
      logDocScreenshotStep('🎨', `Capturing ${ctx.theme} theme`)
      await bootstrapDocCaptureSession(ctx, { resetThemeToDefault: false })
      logDocScreenshotStep('✨', 'AI actions & tasks')
      await captureAiActionsScreenshots(ctx, selection)
    },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
