import { describe, expect, it, mock } from 'bun:test'
import { themes } from '@4d/ui'
import { eventBus } from '~/lib/eventBus'
import type { CommandContext } from './commands'
import {
  buildCommands,
  type Command,
  filterCommands,
  getCategories,
  getCommandById,
  getCommandsByCategory,
  getEnabledCommands,
  groupCommandsByCategory,
} from './commands'

function createMockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const callbacks = {
    setTheme: mock(() => {}),
    toggleTheme: mock(() => {}),
    setThemeName: mock(() => {}),
    toggleSidebarCollapsed: mock(() => {}),
    selectDataclass: mock(() => {}),
    fetchDataclasses: mock(() => {}),
    fetchEntities: mock(() => {}),
    openTab: mock(() => {}),
    openAllDataclasses: mock(() => {}),
    openHomeTab: mock(() => {}),
    openGraphTab: mock(() => Promise.resolve()),
    openAssistantMetadataTab: mock(() => {}),
    openMethodExecutorTab: mock(() => 'method-tab'),
    openHttpClientTab: mock(() => 'http-tab'),
    setIsEditing: mock(() => {}),
    setViewMode: mock(() => {}),
    closeTab: mock(() => {}),
    closeOtherTabs: mock(() => {}),
    closeTabsToRight: mock(() => {}),
    closeAllTabs: mock(() => {}),
    togglePinTab: mock(() => {}),
    pinAllTabs: mock(() => {}),
    unpinAllTabs: mock(() => {}),
    openSettingsTab: mock(() => {}),
    toggleReadonlyMode: mock(() => {}),
    toggleAssistantOpen: mock(() => {}),
    toggleConsoleOpen: mock(() => {}),
    onClose: mock(() => {}),
    onShowHelp: mock(() => {}),
    onEnterSwitchTabsMode: mock(() => {}),
  }

  return {
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    theme: 'light',
    themeName: 'graphite',
    availableThemes: themes,
    sidebarCollapsed: false,
    dataclasses: [
      { name: 'Employee', count: 10 },
      { name: 'Company', count: 3 },
    ],
    selectedDataclass: 'Employee',
    entities: [{ __KEY: '1', id: '1', name: 'Alice' }],
    selectedEntityId: '1',
    isEditing: false,
    viewMode: 'table',
    tabs: [
      { id: 'tab-a', isPinned: false },
      { id: 'tab-b', isPinned: true },
    ],
    activeTabId: 'tab-a',
    activeDataclassTab: { dataclassName: 'Employee' },
    readonlyMode: false,
    assistantOpen: false,
    consoleOpen: false,
    shortcuts: [
      {
        id: 'command-palette',
        label: 'Palette',
        key: 'p',
        modifiers: { ctrl: true },
        enabled: true,
        category: 'General',
      },
    ],
    ...callbacks,
    ...overrides,
  }
}

function runEnabledActions(commands: Command[]): void {
  for (const cmd of commands) {
    if (!cmd.disabled) cmd.action()
  }
}

describe('lib/commands', () => {
  it('buildCommands returns commands across categories', () => {
    const commands = buildCommands(createMockContext())
    expect(commands.length).toBeGreaterThan(20)
    expect(commands.some((c) => c.id === 'open-home')).toBe(true)
    expect(commands.some((c) => c.id === 'toggle-theme')).toBe(true)
    expect(commands.some((c) => c.id === 'toggle-console')).toBe(true)
  })

  it('executes all enabled actions for light theme context', () => {
    const ctx = createMockContext({ theme: 'light', viewMode: 'table', isEditing: false })
    runEnabledActions(buildCommands(ctx))
    expect(ctx.toggleTheme).toHaveBeenCalled()
    expect(ctx.openHomeTab).toHaveBeenCalled()
    expect(ctx.onClose).toHaveBeenCalled()
  })

  it('executes actions for dark theme, cards view, and editing mode', () => {
    const ctx = createMockContext({
      theme: 'dark',
      viewMode: 'cards',
      isEditing: true,
      sidebarCollapsed: true,
      assistantOpen: true,
      readonlyMode: true,
    })
    runEnabledActions(buildCommands(ctx))
    expect(ctx.setTheme).toHaveBeenCalled()
    expect(ctx.setViewMode).toHaveBeenCalled()
    expect(ctx.toggleReadonlyMode).toHaveBeenCalled()
    expect(ctx.toggleAssistantOpen).toHaveBeenCalled()
    expect(ctx.toggleConsoleOpen).toHaveBeenCalled()
  })

  it('runs dataclass commands when dataclasses exist', () => {
    const ctx = createMockContext()
    const commands = buildCommands(ctx)
    getCommandById(commands, 'open-dataclass-Employee')?.action()
    getCommandById(commands, 'open-all-dataclasses')?.action()
    expect(ctx.openTab).toHaveBeenCalledWith('Employee')
    expect(ctx.openAllDataclasses).toHaveBeenCalled()
  })

  it('open-structure emits highlight after graph tab opens', async () => {
    const originalEmit = eventBus.emit.bind(eventBus)
    const emitSpy = mock(originalEmit)
    eventBus.emit = emitSpy as typeof eventBus.emit
    try {
      const ctx = createMockContext()
      getCommandById(buildCommands(ctx), 'open-structure')?.action()
      await Promise.resolve()
      expect(ctx.openGraphTab).toHaveBeenCalled()
      expect(emitSpy).toHaveBeenCalledWith('highlight-dataclass-in-graph', 'Employee')
    } finally {
      eventBus.emit = originalEmit
    }
  })

  it('tab commands invoke tab store callbacks', () => {
    const ctx = createMockContext()
    const commands = buildCommands(ctx)
    getCommandById(commands, 'close-tab')?.action()
    getCommandById(commands, 'close-other-tabs')?.action()
    getCommandById(commands, 'close-tabs-to-right')?.action()
    getCommandById(commands, 'close-all-tabs')?.action()
    getCommandById(commands, 'pin-all-tabs')?.action()
    getCommandById(commands, 'unpin-all-tabs')?.action()
    getCommandById(commands, 'switch-tabs')?.action()
    expect(ctx.closeTab).toHaveBeenCalled()
    expect(ctx.onEnterSwitchTabsMode).toHaveBeenCalled()
  })

  it('getCommandById, getCommandsByCategory, getEnabledCommands', () => {
    const commands = buildCommands(createMockContext())
    const home = getCommandById(commands, 'open-home')
    expect(home?.category).toBe('Navigation')
    expect(getCommandsByCategory(commands, 'Navigation').length).toBeGreaterThan(0)
    const disabled = commands.map((c) => ({ ...c, disabled: c.id === 'open-home' }))
    expect(getEnabledCommands(disabled).some((c) => c.id === 'open-home')).toBe(false)
  })

  it('filterCommands matches label, description, category, and keywords', () => {
    const commands = buildCommands(createMockContext())
    expect(filterCommands(commands, 'home').some((c) => c.id === 'open-home')).toBe(true)
    expect(filterCommands(commands, 'navigation').length).toBeGreaterThan(0)
    expect(filterCommands(commands, 'sparkles').some((c) => c.id === 'show-assistant')).toBe(true)
    expect(filterCommands(commands, 'zzz-none')).toHaveLength(0)
    expect(filterCommands(commands, '')).toHaveLength(commands.length)
  })

  it('filterCommands uses translated keywords when t is provided', () => {
    const commands = buildCommands(createMockContext())
    const t = (key: string) =>
      key === 'commandPalette.keyword.ai' ? 'artificial intelligence' : key
    expect(filterCommands(commands, 'artificial', t).some((c) => c.id === 'show-assistant')).toBe(
      true
    )
  })

  it('groupCommandsByCategory puts Recent first when present', () => {
    const commands = buildCommands(createMockContext())
    const recent: Command = {
      id: 'recent',
      label: 'Recent',
      icon: null,
      category: 'Recent',
      action: () => {},
    }
    const grouped = groupCommandsByCategory([recent, ...commands])
    expect(Object.keys(grouped)[0]).toBe('Recent')
  })

  it('getCategories returns unique categories', () => {
    const commands = buildCommands(createMockContext())
    const categories = getCategories(commands)
    expect(categories).toContain('Navigation')
    expect(categories.length).toBe(new Set(commands.map((c) => c.category)).size)
  })
})
