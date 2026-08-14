/**
 * Captures HTTP Client docs screenshots (dark + light).
 * Usage: DATAEXPLORER_URL=http://localhost:3002 bun run ./scripts/capture-http-client-screenshot.ts
 *        bun run ./scripts/capture-http-client-screenshot.ts --mode light 27
 *
 * Response-format screenshots GET sample files from the connected server.
 * Vite proxies WebFolder samples (text.txt, markdown.md, …) via WEBFOLDER_URL
 * (default http://localhost — see apps/base/WebFolder and apps/dataexplorer/vite.config.ts).
 */

import {
  bootstrapDocCaptureSession,
  captureHttpClientScreenshots,
  HTTP_CLIENT_SCREENSHOT_PAGE_NAMES,
  handleDocScreenshotCli,
  logDocScreenshotStep,
  parseDocScreenshotArgs,
  runDocScreenshotThemes,
} from './doc-screenshot-capture'

async function main(): Promise<void> {
  const selection = parseDocScreenshotArgs(process.argv.slice(2), HTTP_CLIENT_SCREENSHOT_PAGE_NAMES)
  if (
    handleDocScreenshotCli(
      selection,
      './scripts/capture-http-client-screenshot.ts',
      HTTP_CLIENT_SCREENSHOT_PAGE_NAMES
    )
  ) {
    return
  }

  await runDocScreenshotThemes({
    label: 'HTTP Client',
    defaultBaseUrl: 'http://localhost:3002',
    themes: selection.themes,
    concurrency: selection.concurrency,
    async capture(ctx) {
      const { theme } = ctx
      logDocScreenshotStep('🎨', `Capturing ${theme} theme`)
      await bootstrapDocCaptureSession(ctx, { resetThemeToDefault: true })
      await captureHttpClientScreenshots(ctx, selection)
    },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
