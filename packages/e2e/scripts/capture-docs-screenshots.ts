/**
 * Captures screenshots for Data Explorer documentation (dark + light).
 * Usage: DATAEXPLORER_URL=http://localhost:3002 bun run ./scripts/capture-docs-screenshots.ts
 *        bun run ./scripts/capture-docs-screenshots.ts 27
 *        bun run ./scripts/capture-docs-screenshots.ts --mode dark 2 3
 *        bun run ./scripts/capture-docs-screenshots.ts --concurrency 6
 */

import {
  AI_ACTIONS_SCREENSHOT_PAGE_NAMES,
  bootstrapDocCaptureSession,
  captureAiActionsScreenshots,
  captureHttpClientScreenshots,
  DOC_SCREENSHOT_PAGE_NAMES,
  type DocScreenshotContext,
  type DocScreenshotJob,
  type DocScreenshotSelection,
  HTTP_CLIENT_SCREENSHOT_PAGE_NAMES,
  handleDocScreenshotCli,
  logDocScreenshotStep,
  parseDocScreenshotArgs,
  runDocScreenshotJobPool,
  TERMINAL_SCREENSHOT_PAGE_NAMES,
} from './doc-screenshot-capture'

async function assertNotWebAdminLogin(ctx: DocScreenshotContext): Promise<void> {
  const { app, page } = ctx
  await app.goto()
  await page.waitForTimeout(1500)
  if (page.url().includes('login.html')) {
    throw new Error(
      `Navigated to 4D WebAdmin login (${page.url()}). ` +
        'Capture docs against the Vite app so Data Explorer can render its access key screen: ' +
        'DATAEXPLORER_URL=http://localhost:3002 bun run capture:screenshots'
    )
  }
}

async function bootstrapAuthenticatedJob(
  ctx: DocScreenshotContext,
  options?: Parameters<typeof bootstrapDocCaptureSession>[1]
): Promise<void> {
  await assertNotWebAdminLogin(ctx)
  await bootstrapDocCaptureSession(ctx, options)
}

function buildDocsCaptureJobs(selection: DocScreenshotSelection): DocScreenshotJob[] {
  const jobs: DocScreenshotJob[] = []

  if (selection.isSelected('01-access-key')) {
    jobs.push({
      id: '01-access-key',
      label: 'Access key screen',
      async capture(ctx) {
        const { app, page, theme } = ctx
        await assertNotWebAdminLogin(ctx)
        // Fresh context may already be on the access-key screen after a 401.
        // Clear cookies and reload so we always land there for this shot.
        await page.context().clearCookies()
        await app.goto()
        await page.waitForTimeout(1500)
        if (!(await app.login.isAccessKeyScreenVisible())) {
          logDocScreenshotStep('⏭️', 'Access key screen not shown (skipping)')
          return
        }
        // Docs shot should show the clean prompt — not the redirect/401 reason banner.
        await page
          .getByTestId('access-key-reason')
          .evaluate((el) => el.remove())
          .catch(() => {})
        await page
          .locator('[role="alert"]')
          .evaluate((el) => el.remove())
          .catch(() => {})
        await app.theme.setTheme(theme)
        logDocScreenshotStep('🔐', 'Access key screen')
        await page.waitForTimeout(300)
        await app.screenshot('01-access-key')
      },
    })
  }

  const appearancePages = ['00-dataclass-appearance', '10-settings-appearance'] as const
  if (selection.hasAny(appearancePages)) {
    jobs.push({
      id: 'appearance',
      label: 'Settings appearance',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('⚙️', 'Settings appearance screenshots')
        await app.settings.open()
        if (selection.isSelected('00-dataclass-appearance')) {
          logDocScreenshotStep('🎨', 'Dataclass appearance panel')
          await app.settings.openDataclassAppearance()
          await app.settings.scrollDataclassAppearanceIntoView()
          await app.screenshot('00-dataclass-appearance')
        }
        if (selection.isSelected('10-settings-appearance')) {
          logDocScreenshotStep('🖌️', 'Appearance settings')
          await app.settings.collapseDataclassAppearance()
          await app.settings.scrollAppearanceIntoView()
          await app.screenshot('10-settings-appearance')
        }
      },
    })
  }

  if (selection.isSelected('02-welcome-home')) {
    jobs.push({
      id: '02-welcome-home',
      label: 'Welcome home',
      async capture(ctx) {
        const { app, page } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('🏠', 'Welcome home screen')
        await app.tabs.goHome()
        await page.waitForTimeout(1000)
        await app.screenshot('02-welcome-home')
      },
    })
  }

  if (selection.isSelected('03-command-palette')) {
    jobs.push({
      id: '03-command-palette',
      label: 'Command palette',
      async capture(ctx) {
        const { app, page } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('⌘', 'Command palette')
        await app.commandPalette.openFromHeader()
        await page.waitForTimeout(500)
        await app.screenshot('03-command-palette')
      },
    })
  }

  const dataclassPages = [
    '04-dataclass-view',
    '05-entity-viewer',
    '06-query-builder',
    '07-card-view',
    '07-table-view',
  ] as const
  if (selection.hasAny(dataclassPages)) {
    jobs.push({
      id: 'dataclass',
      label: 'Dataclass views',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        if (!(await app.home.openFirstDataclass())) return
        if (selection.isSelected('04-dataclass-view')) {
          logDocScreenshotStep('📊', 'Dataclass view')
          await app.screenshot('04-dataclass-view')
        }
        if (selection.isSelected('07-table-view')) {
          logDocScreenshotStep('📋', 'Table view')
          if (await app.dataclassView.switchToTableView()) {
            await app.screenshot('07-table-view')
          }
        }
        if (selection.isSelected('07-card-view')) {
          logDocScreenshotStep('🃏', 'Cards view')
          if (await app.dataclassView.switchToCardsView()) {
            await app.screenshot('07-card-view')
          }
        }
        if (selection.isSelected('06-query-builder')) {
          logDocScreenshotStep('🔍', 'Query builder')
          await app.dataclassView.openQueryBuilder()
          await app.screenshot('06-query-builder')
        }
        if (selection.isSelected('05-entity-viewer')) {
          logDocScreenshotStep('👤', 'Entity viewer')
          if (await app.dataclassView.openFirstEntity()) {
            await app.screenshot('05-entity-viewer')
          }
        }
      },
    })
  }

  if (selection.isSelected('08-structure-graph')) {
    jobs.push({
      id: '08-structure-graph',
      label: 'Structure graph',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('🕸️', 'Structure graph')
        await app.structureGraph.highlightDataclass('Car')
        await app.structureGraph.showSelectedOnly()
        await app.structureGraph.autoOrganizeGraph()
        await app.structureGraph.fitView()
        await app.screenshot('08-structure-graph')
      },
    })
  }

  if (selection.isSelected('13-release-notes')) {
    jobs.push({
      id: '13-release-notes',
      label: 'Release notes',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('📝', 'Release notes')
        await app.headerFooter.openReleaseNotes()
        await app.screenshot('13-release-notes')
      },
    })
  }

  if (selection.isSelected('14-sidebar-collapsed')) {
    jobs.push({
      id: '14-sidebar-collapsed',
      label: 'Collapsed sidebar',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('📐', 'Collapsed sidebar')
        if (await app.headerFooter.collapseSidebar()) {
          await app.screenshot('14-sidebar-collapsed')
        }
      },
    })
  }

  if (selection.isSelected('15-read-only-mode')) {
    jobs.push({
      id: '15-read-only-mode',
      label: 'Read-only mode',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('👁️', 'Read-only mode')
        if (await app.headerFooter.enableReadOnlyMode()) {
          await app.screenshot('15-read-only-mode')
        }
      },
    })
  }

  if (selection.isSelected('16-assistant-panel')) {
    jobs.push({
      id: '16-assistant-panel',
      label: 'AI assistant panel',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('🤖', 'AI assistant panel')
        await app.assistant.open()
        await app.screenshot('16-assistant-panel')
      },
    })
  }

  if (selection.isSelected('17-schema-builder')) {
    jobs.push({
      id: '17-schema-builder',
      label: 'JSON Schema Builder',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('🧩', 'JSON Schema Builder')
        await app.headerFooter.openTool(/schema builder/i)
        await app.screenshot('17-schema-builder')
      },
    })
  }

  if (selection.isSelected('18-assistant-metadata-editor')) {
    jobs.push({
      id: '18-assistant-metadata-editor',
      label: 'Assistant metadata editor',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('📚', 'Assistant metadata editor')
        await app.headerFooter.openTool(/assistant metadata|metadata editor/i)
        await app.prepareForScreenshot()
        await app.screenshot('18-assistant-metadata-editor')
      },
    })
  }

  const methodPages = [
    '19-method-executor-get-entity-sel',
    '20-method-executor-get-first-car',
    '21-method-executor-say-hello',
  ] as const
  if (selection.hasAny(methodPages)) {
    jobs.push({
      id: 'method-executor',
      label: 'Method Executor',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('▶️', 'Method Executor')
        await app.methodExecutor.openFromToolsMenu()
        let hasSelectedMethod = false
        if (selection.isSelected('19-method-executor-get-entity-sel')) {
          logDocScreenshotStep('📦', 'Method Executor — ds.getEntitySel')
          await app.methodExecutor.selectScope('Datastore')
          await app.methodExecutor.chooseMethod('getEntitySel')
          await app.methodExecutor.execute({ name: /Open all in new tab/i })
          await app.prepareForScreenshot()
          await app.screenshot('19-method-executor-get-entity-sel')
          hasSelectedMethod = true
        }
        if (selection.isSelected('20-method-executor-get-first-car')) {
          logDocScreenshotStep('🚗', 'Method Executor — ds.getFirstCar')
          if (hasSelectedMethod) await app.methodExecutor.clearMethod()
          await app.methodExecutor.selectScope('Datastore')
          await app.methodExecutor.chooseMethod('getFirstCar')
          await app.methodExecutor.execute({ text: /__KEY|Form|Tree|JSON/i })
          await app.prepareForScreenshot()
          await app.screenshot('20-method-executor-get-first-car')
          hasSelectedMethod = true
        }
        if (selection.isSelected('21-method-executor-say-hello')) {
          logDocScreenshotStep('👋', 'Method Executor — sayHello("John", "DOE")')
          if (hasSelectedMethod) await app.methodExecutor.clearMethod()
          await app.methodExecutor.selectScope('Datastore')
          await app.methodExecutor.chooseMethod('sayHello')
          await app.methodExecutor.setArgumentValue(0, 'John')
          await app.methodExecutor.setArgumentValue(1, 'DOE')
          await app.methodExecutor.execute({ text: /John|Hello|DOE/i })
          await app.prepareForScreenshot()
          await app.screenshot('21-method-executor-say-hello')
        }
      },
    })
  }

  if (selection.hasAny(HTTP_CLIENT_SCREENSHOT_PAGE_NAMES)) {
    jobs.push({
      id: 'http-client',
      label: 'HTTP Client',
      async capture(ctx) {
        await bootstrapAuthenticatedJob(ctx, {
          openFirstDataclass: false,
          resetThemeToDefault: true,
        })
        await captureHttpClientScreenshots(ctx, selection)
      },
    })
  }

  if (selection.isSelected('22-console-panel')) {
    jobs.push({
      id: '22-console-panel',
      label: 'Console panel',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { resetThemeToDefault: true })
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

  if (selection.hasAny(TERMINAL_SCREENSHOT_PAGE_NAMES)) {
    jobs.push({
      id: 'terminal',
      label: 'ORDA terminal',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { resetThemeToDefault: true })
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

  if (selection.hasAny(AI_ACTIONS_SCREENSHOT_PAGE_NAMES)) {
    jobs.push({
      id: 'ai-actions',
      label: 'AI actions & tasks',
      async capture(ctx) {
        await bootstrapAuthenticatedJob(ctx, { resetThemeToDefault: true })
        logDocScreenshotStep('✨', 'AI actions & tasks')
        await captureAiActionsScreenshots(ctx, selection)
      },
    })
  }

  const settingsPages = ['09-settings-general', '11-keyboard-shortcuts'] as const
  if (selection.hasAny(settingsPages)) {
    jobs.push({
      id: 'settings',
      label: 'Settings general & shortcuts',
      async capture(ctx) {
        const { app, page } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        await app.settings.open()
        await page.waitForTimeout(200)
        if (selection.isSelected('09-settings-general')) {
          logDocScreenshotStep('⚙️', 'Settings — general')
          await app.screenshot('09-settings-general')
        }
        if (selection.isSelected('11-keyboard-shortcuts')) {
          logDocScreenshotStep('⌨️', 'Keyboard shortcuts')
          await app.settings.openKeyboardShortcuts()
          await app.screenshot('11-keyboard-shortcuts')
        }
      },
    })
  }

  if (selection.isSelected('12-theme-selector')) {
    jobs.push({
      id: '12-theme-selector',
      label: 'Theme selector',
      async capture(ctx) {
        const { app } = ctx
        await bootstrapAuthenticatedJob(ctx, { openFirstDataclass: false })
        logDocScreenshotStep('🎭', 'Theme selector')
        await app.prepareForScreenshot()
        await app.headerFooter.openThemeMenu()
        await app.screenshot('12-theme-selector')
      },
    })
  }

  return jobs
}

async function main(): Promise<void> {
  const selection = parseDocScreenshotArgs(process.argv.slice(2))
  if (
    handleDocScreenshotCli(
      selection,
      './scripts/capture-docs-screenshots.ts',
      DOC_SCREENSHOT_PAGE_NAMES
    )
  ) {
    return
  }

  const jobs = buildDocsCaptureJobs(selection)
  if (jobs.length === 0) {
    console.log('No screenshot pages selected.')
    return
  }

  await runDocScreenshotJobPool({
    label: 'docs',
    defaultBaseUrl: 'http://localhost:3002',
    themes: selection.themes,
    concurrency: selection.concurrency,
    jobs,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
