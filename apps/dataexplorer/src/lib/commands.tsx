import { cn, type ThemeName } from '@4d/ui'
import {
  ArrowDown,
  ArrowUp,
  BookText,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit,
  FileStack,
  FolderOpen,
  Hash,
  Home,
  Keyboard,
  Layers,
  LayoutGrid,
  Lock,
  Moon,
  Palette,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Sun,
  Table2,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { eventBus } from '~/lib/eventBus'
import { isMobileShell } from '~/lib/platform'
import { formatShortcut, getShortcutById, type KeyboardShortcut } from '~/store/settings'

// ============================================================================
// Types
// ============================================================================

export type Command = {
  id: string
  label: string
  description?: string
  shortcut?: string
  keywords?: string[]
  icon: ReactNode
  category: CommandCategory
  action: () => void
  disabled?: boolean
  usedAt?: number // timestamp for recent commands
}

export type CommandCategory =
  | 'Help'
  | 'Appearance'
  | 'View'
  | 'Navigation'
  | 'Dataclasses'
  | 'Entities'
  | 'Entity'
  | 'Tabs'
  | 'Settings'
  | 'Recent'

export type Entity = Record<string, unknown>

export type TFunction = (key: string, params?: Record<string, string | number>) => string

export type CommandContext = {
  /** Translation function for command labels and descriptions */
  t: TFunction
  // Theme
  theme: 'light' | 'dark'
  themeName: ThemeName
  availableThemes: Record<string, { name: string }>
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  setThemeName: (name: ThemeName) => void | Promise<void>

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void

  // Dataclasses
  dataclasses: Array<{ name: string; count: number }>
  selectedDataclass: string | null
  selectDataclass: (name: string) => void
  fetchDataclasses: () => void
  fetchEntities: (page?: number) => void
  openTab: (name: string) => void
  openAllDataclasses: (names: string[]) => void
  openHomeTab: () => void
  openGraphTab: () => Promise<void>
  openAssistantMetadataTab: () => void
  openMethodExecutorTab: () => string
  openHttpClientTab: () => string
  // Entities
  entities: Entity[]
  selectedEntityId: string | null
  isEditing: boolean
  setIsEditing: (editing: boolean) => void

  // View mode
  viewMode: 'cards' | 'table'
  setViewMode: (mode: 'cards' | 'table') => void

  // Tabs
  tabs: Array<{ id: string; isPinned?: boolean }>
  activeTabId: string | null
  /** Current active tab if it is a dataclass tab (for highlighting in structure) */
  activeDataclassTab: { dataclassName: string } | null
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToRight: (id: string) => void
  closeAllTabs: () => void
  togglePinTab: (id: string) => void
  pinAllTabs: () => void
  unpinAllTabs: () => void

  // Settings
  openSettingsTab: () => void
  readonlyMode: boolean
  toggleReadonlyMode: () => void
  shortcuts: KeyboardShortcut[]

  // Assistant
  assistantOpen: boolean
  toggleAssistantOpen: () => void

  // Console
  consoleOpen: boolean
  toggleConsoleOpen: () => void
  bottomPanelTab: 'console' | 'terminal'
  toggleTerminalOpen: () => void

  // Callbacks
  onClose: () => void
  onShowHelp: () => void
  /** Enter switch-tabs mode in the command palette (show tabs grid) */
  onEnterSwitchTabsMode?: () => void
}

// Helper to get shortcut display string
function getShortcutDisplay(ctx: CommandContext, id: string): string | undefined {
  const shortcut = getShortcutById(ctx.shortcuts, id)
  if (shortcut?.enabled) {
    return formatShortcut(shortcut)
  }
  return undefined
}

// ============================================================================
// Command Builders
// ============================================================================

function buildHelpCommands(ctx: CommandContext): Command[] {
  const commands: Command[] = []
  if (!isMobileShell()) {
    commands.push({
      id: 'show-assistant',
      label: ctx.assistantOpen ? ctx.t('command.closeAssistant') : ctx.t('command.openAssistant'),
      description: ctx.t('commandDesc.toggleAssistant'),
      shortcut: getShortcutDisplay(ctx, 'toggle-assistant'),
      keywords: ['assistant', 'ai', 'chat', 'sparkles', 'help'],
      icon: <Sparkles className="h-4 w-4" />,
      category: 'Help',
      action: () => {
        ctx.toggleAssistantOpen()
        ctx.onClose()
      },
    })
  }
  commands.push({
    id: 'help',
    label: ctx.t('command.showShortcuts'),
    description: ctx.t('commandDesc.showShortcuts'),
    shortcut: getShortcutDisplay(ctx, 'show-shortcuts'),
    keywords: ['hotkeys', 'keybindings', 'keys', 'bindings'],
    icon: <Keyboard className="h-4 w-4" />,
    category: 'Help',
    action: () => {
      ctx.onClose()
      ctx.onShowHelp()
    },
  })
  return commands
}

function buildAppearanceCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = [
    {
      id: 'toggle-theme',
      label: ctx.theme === 'dark' ? ctx.t('command.switchTheme') : ctx.t('command.switchThemeDark'),
      description: ctx.t('commandDesc.switchTheme'),
      shortcut: getShortcutDisplay(ctx, 'toggle-theme'),
      keywords: ['night', 'day', 'brightness'],
      icon: ctx.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      category: 'Appearance',
      action: () => {
        ctx.toggleTheme()
        ctx.onClose()
      },
    },
    {
      id: 'theme-light',
      label: ctx.t('command.lightMode'),
      description: ctx.t('commandDesc.lightMode'),
      keywords: ['day', 'bright', 'white'],
      icon:
        ctx.theme === 'light' ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Sun className="h-4 w-4" />
        ),
      category: 'Appearance',
      action: () => {
        ctx.setTheme('light')
        ctx.onClose()
      },
    },
    {
      id: 'theme-dark',
      label: ctx.t('command.darkMode'),
      description: ctx.t('commandDesc.darkMode'),
      keywords: ['night', 'black'],
      icon:
        ctx.theme === 'dark' ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Moon className="h-4 w-4" />
        ),
      category: 'Appearance',
      action: () => {
        ctx.setTheme('dark')
        ctx.onClose()
      },
    },
  ]

  // Color theme commands
  for (const [key, value] of Object.entries(ctx.availableThemes)) {
    const themeKey = key as ThemeName
    cmds.push({
      id: `color-theme-${key}`,
      label: ctx.t('command.theme', { name: value.name }),
      description: ctx.t('commandDesc.theme', { name: value.name }),
      keywords: ['color', 'scheme', 'palette', 'skin'],
      icon:
        ctx.themeName === key ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Palette className="h-4 w-4" />
        ),
      category: 'Appearance',
      action: () => {
        ctx.setThemeName(themeKey)
        ctx.onClose()
      },
    })
  }

  return cmds
}

function buildViewCommands(ctx: CommandContext): Command[] {
  return [
    {
      id: 'toggle-sidebar',
      label: ctx.sidebarCollapsed
        ? ctx.t('command.expandSidebar')
        : ctx.t('command.collapseSidebar'),
      description: ctx.sidebarCollapsed
        ? ctx.t('commandDesc.expandSidebar')
        : ctx.t('commandDesc.collapseSidebar'),
      shortcut: getShortcutDisplay(ctx, 'toggle-sidebar'),
      keywords: ['panel', 'hide', 'show', 'minimize', 'maximize', 'rail'],
      icon: ctx.sidebarCollapsed ? (
        <PanelLeftOpen className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      ),
      category: 'View',
      action: () => {
        ctx.toggleSidebarCollapsed()
        ctx.onClose()
      },
    },
    {
      id: 'toggle-console',
      label:
        ctx.consoleOpen && ctx.bottomPanelTab === 'console'
          ? ctx.t('command.closeConsole')
          : ctx.t('command.openConsole'),
      description: ctx.t('commandDesc.toggleConsole'),
      shortcut: getShortcutDisplay(ctx, 'toggle-console'),
      keywords: ['console', 'logs', 'network', 'requests', 'panel'],
      icon: <PanelBottom className="h-4 w-4" />,
      category: 'View',
      action: () => {
        ctx.toggleConsoleOpen()
        ctx.onClose()
      },
    },
    {
      id: 'toggle-terminal',
      label:
        ctx.consoleOpen && ctx.bottomPanelTab === 'terminal'
          ? ctx.t('command.closeTerminal')
          : ctx.t('command.openTerminal'),
      description: ctx.t('commandDesc.toggleTerminal'),
      shortcut: getShortcutDisplay(ctx, 'toggle-terminal'),
      keywords: ['terminal', 'orda', 'ds', 'repl', 'query', 'panel'],
      icon: <Terminal className="h-4 w-4" />,
      category: 'View',
      action: () => {
        ctx.toggleTerminalOpen()
        ctx.onClose()
      },
    },
    {
      id: 'view-cards',
      label: ctx.t('command.cardView'),
      description: ctx.t('commandDesc.cardView'),
      shortcut: getShortcutDisplay(ctx, 'view-cards'),
      keywords: ['grid', 'tiles'],
      icon:
        ctx.viewMode === 'cards' ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <LayoutGrid className="h-4 w-4" />
        ),
      category: 'View',
      action: () => {
        ctx.setViewMode('cards')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'view-table',
      label: ctx.t('command.tableView'),
      description: ctx.t('commandDesc.tableView'),
      shortcut: getShortcutDisplay(ctx, 'view-table'),
      keywords: ['list', 'rows'],
      icon:
        ctx.viewMode === 'table' ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Table2 className="h-4 w-4" />
        ),
      category: 'View',
      action: () => {
        ctx.setViewMode('table')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
  ]
}

function buildNavigationCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = [
    {
      id: 'open-home',
      label: ctx.t('command.openHome'),
      description: ctx.t('commandDesc.openHome'),
      shortcut: getShortcutDisplay(ctx, 'open-home'),
      icon: <Home className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        ctx.openHomeTab()
        ctx.onClose()
      },
    },
  ]

  if (!isMobileShell()) {
    cmds.push({
      id: 'open-structure',
      label: ctx.t('command.displayStructure'),
      description: ctx.t('commandDesc.displayStructure'),
      shortcut: getShortcutDisplay(ctx, 'open-structure'),
      keywords: ['graph', 'schema', 'dataclass', 'model'],
      icon: <Layers className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        const dataclassToHighlight = ctx.activeDataclassTab?.dataclassName
        ctx.openGraphTab().then(() => {
          if (dataclassToHighlight) {
            eventBus.emit('highlight-dataclass-in-graph', dataclassToHighlight)
          }
          ctx.onClose()
        })
      },
    })
  }

  cmds.push({
    id: 'open-assistant-metadata',
    label: ctx.t('command.openAssistantMetadata'),
    description: ctx.t('commandDesc.openAssistantMetadata'),
    shortcut: getShortcutDisplay(ctx, 'open-assistant-metadata'),
    keywords: ['metadata', 'assistant', 'documentation', 'schema', 'ai'],
    icon: <BookText className="h-4 w-4" />,
    category: 'Navigation',
    action: () => {
      ctx.openAssistantMetadataTab()
      ctx.onClose()
    },
  })

  return [...cmds, ...buildNavigationCommandsContinued(ctx)]
}

function buildNavigationCommandsContinued(ctx: CommandContext): Command[] {
  return [
    {
      id: 'open-method-executor',
      label: ctx.t('command.openMethodExecutor'),
      description: ctx.t('commandDesc.openMethodExecutor'),
      keywords: ['method', 'function', 'execute', 'run', 'orda'],
      icon: <Play className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        ctx.openMethodExecutorTab()
        ctx.onClose()
      },
    },
    {
      id: 'open-http-client',
      label: ctx.t('command.openHttpClient'),
      description: ctx.t('commandDesc.openHttpClient'),
      keywords: ['http', 'request', 'rest', 'api', 'postman', 'fetch', 'client'],
      icon: <Send className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        ctx.openHttpClientTab()
        ctx.onClose()
      },
    },
    {
      id: 'nav-prev-entity',
      label: ctx.t('command.previousEntity'),
      description: ctx.t('commandDesc.previousEntity'),
      shortcut: getShortcutDisplay(ctx, 'nav-prev'),
      icon: <ArrowUp className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('nav-prev')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'nav-next-entity',
      label: ctx.t('command.nextEntity'),
      description: ctx.t('commandDesc.nextEntity'),
      shortcut: getShortcutDisplay(ctx, 'nav-next'),
      icon: <ArrowDown className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('nav-next')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'page-first',
      label: ctx.t('command.firstPage'),
      description: ctx.t('commandDesc.firstPage'),
      shortcut: getShortcutDisplay(ctx, 'page-first'),
      keywords: ['start', 'beginning'],
      icon: <ChevronsLeft className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('page-first')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'page-prev',
      label: ctx.t('command.previousPage'),
      description: ctx.t('commandDesc.previousPage'),
      shortcut: getShortcutDisplay(ctx, 'page-prev'),
      keywords: ['back'],
      icon: <ChevronLeft className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('page-prev')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'page-next',
      label: ctx.t('command.nextPage'),
      description: ctx.t('commandDesc.nextPage'),
      shortcut: getShortcutDisplay(ctx, 'page-next'),
      keywords: ['forward'],
      icon: <ChevronRight className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('page-next')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'page-last',
      label: ctx.t('command.lastPage'),
      description: ctx.t('commandDesc.lastPage'),
      shortcut: getShortcutDisplay(ctx, 'page-last'),
      keywords: ['end'],
      icon: <ChevronsRight className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('page-last')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
    {
      id: 'go-to-page',
      label: ctx.t('command.goToPage'),
      description: ctx.t('commandDesc.goToPage'),
      keywords: ['jump', 'navigate', 'page', 'goto', ':'],
      icon: <FileStack className="h-4 w-4" />,
      category: 'Navigation',
      action: () => {
        eventBus.emit('go-to-page')
        ctx.onClose()
      },
      disabled: !ctx.selectedDataclass,
    },
  ]
}

function buildDataclassCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = [
    {
      id: 'refresh-dataclasses',
      label: ctx.t('command.refreshDataclasses'),
      description: ctx.t('commandDesc.refreshDataclasses'),
      icon: <RefreshCw className="h-4 w-4" />,
      category: 'Dataclasses',
      action: () => {
        ctx.fetchDataclasses()
        ctx.onClose()
      },
    },
  ]

  if (ctx.dataclasses.length > 0) {
    cmds.push({
      id: 'open-all-dataclasses',
      label: ctx.t('command.openAllDataclasses'),
      description: ctx.t('commandDesc.openAllDataclasses', {
        count: ctx.dataclasses.length,
      }),
      icon: <Layers className="h-4 w-4" />,
      category: 'Dataclasses',
      action: () => {
        const names = ctx.dataclasses.map((d) => d.name)
        ctx.openAllDataclasses(names)
        ctx.onClose()
      },
    })

    // Add command for each dataclass
    for (const dataclass of ctx.dataclasses) {
      cmds.push({
        id: `open-dataclass-${dataclass.name}`,
        label: ctx.t('command.openDataclass', { name: dataclass.name }),
        description: ctx.t('commandDesc.openDataclass', {
          count: dataclass.count.toLocaleString(),
        }),
        icon: <FolderOpen className="h-4 w-4" />,
        category: 'Dataclasses',
        action: () => {
          ctx.openTab(dataclass.name)
          ctx.onClose()
        },
      })
    }
  }

  return cmds
}

function buildEntitiesCommands(ctx: CommandContext): Command[] {
  if (!ctx.selectedDataclass) return []

  return [
    {
      id: 'refresh-entities',
      label: ctx.t('command.refreshEntities'),
      description: ctx.t('commandDesc.refreshEntities'),
      shortcut: getShortcutDisplay(ctx, 'refresh'),
      keywords: ['reload', 'fetch', 'update'],
      icon: <RefreshCw className="h-4 w-4" />,
      category: 'Entities',
      action: () => {
        ctx.fetchEntities()
        ctx.onClose()
      },
    },
    {
      id: 'new-entity',
      label: ctx.t('command.newEntity'),
      description: ctx.t('commandDesc.newEntity'),
      shortcut: getShortcutDisplay(ctx, 'new-entity'),
      keywords: ['add', 'create', 'insert'],
      icon: <Plus className="h-4 w-4" />,
      category: 'Entities',
      action: () => {
        eventBus.emit('new-entity')
        ctx.onClose()
      },
    },
    {
      id: 'go-to-entity',
      label: ctx.t('command.goToEntity'),
      description: ctx.t('commandDesc.goToEntity'),
      shortcut: getShortcutDisplay(ctx, 'go-to-entity'),
      keywords: ['jump', 'navigate', 'index', 'number', 'goto', '#'],
      icon: <Hash className="h-4 w-4" />,
      category: 'Entities',
      action: () => {
        eventBus.emit('go-to-entity')
        ctx.onClose()
      },
    },
  ]
}

function buildEntityCommands(ctx: CommandContext): Command[] {
  if (!ctx.selectedEntityId || !ctx.selectedDataclass) return []

  if (ctx.isEditing) {
    return [
      {
        id: 'save-entity',
        label: ctx.t('command.saveEntity'),
        description: ctx.t('commandDesc.saveEntity'),
        shortcut: getShortcutDisplay(ctx, 'save-entity'),
        keywords: ['write', 'persist', 'commit'],
        icon: <Edit className="h-4 w-4" />,
        category: 'Entity',
        action: () => {
          eventBus.emit('save-entity')
          ctx.onClose()
        },
      },
      {
        id: 'cancel-edit',
        label: ctx.t('command.cancelEdit'),
        description: ctx.t('commandDesc.cancelEdit'),
        shortcut: getShortcutDisplay(ctx, 'cancel-edit'),
        keywords: ['abort', 'revert', 'undo'],
        icon: <X className="h-4 w-4" />,
        category: 'Entity',
        action: () => {
          ctx.setIsEditing(false)
          ctx.onClose()
        },
      },
    ]
  }

  return [
    {
      id: 'edit-entity',
      label: ctx.t('command.editEntity'),
      description: ctx.t('commandDesc.editEntity'),
      shortcut: getShortcutDisplay(ctx, 'edit-entity'),
      keywords: ['modify', 'change', 'update'],
      icon: <Edit className="h-4 w-4" />,
      category: 'Entity',
      action: () => {
        eventBus.emit('edit-entity')
        ctx.onClose()
      },
    },
    {
      id: 'duplicate-entity',
      label: ctx.t('command.duplicateEntity'),
      description: ctx.t('commandDesc.duplicateEntity'),
      shortcut: getShortcutDisplay(ctx, 'duplicate-entity'),
      keywords: ['clone', 'copy'],
      icon: <Plus className="h-4 w-4" />,
      category: 'Entity',
      action: () => {
        eventBus.emit('duplicate-entity')
        ctx.onClose()
      },
    },
    {
      id: 'delete-entity',
      label: ctx.t('command.deleteEntity'),
      description: ctx.t('commandDesc.deleteEntity'),
      shortcut: getShortcutDisplay(ctx, 'delete-entity'),
      keywords: ['remove', 'trash'],
      icon: <Trash2 className="h-4 w-4" />,
      category: 'Entity',
      action: () => {
        eventBus.emit('delete-entity')
        ctx.onClose()
      },
    },
  ]
}

function buildTabCommands(ctx: CommandContext): Command[] {
  const cmds: Command[] = []

  if (ctx.onEnterSwitchTabsMode) {
    cmds.push({
      id: 'switch-tabs',
      label: ctx.t('command.switchTabs'),
      description: ctx.t('commandDesc.switchTabs'),
      shortcut: getShortcutDisplay(ctx, 'switch-tabs'),
      keywords: ['tabs', 'switch', 'pick', 'open', '@'],
      icon: <PanelLeftOpen className="h-4 w-4" />,
      category: 'Tabs',
      action: () => {
        ctx.onEnterSwitchTabsMode?.()
      },
    })
  }

  if (ctx.tabs.length === 0) return cmds

  const activeTab = ctx.tabs.find((t) => t.id === ctx.activeTabId)
  const isPinned = activeTab?.isPinned ?? false
  const unpinnedCount = ctx.tabs.filter((t) => !t.isPinned).length
  const pinnedCount = ctx.tabs.filter((t) => t.isPinned).length

  cmds.push({
    id: 'pin-tab',
    label: isPinned ? ctx.t('command.unpinTab') : ctx.t('command.pinTab'),
    description: isPinned ? ctx.t('commandDesc.unpinTab') : ctx.t('commandDesc.pinTab'),
    shortcut: getShortcutDisplay(ctx, 'pin-tab'),
    icon: <Pin className={cn('h-4 w-4', isPinned && '-rotate-45')} />,
    category: 'Tabs',
    action: () => {
      if (ctx.activeTabId) {
        ctx.togglePinTab(ctx.activeTabId)
      }
      ctx.onClose()
    },
    disabled: !ctx.activeTabId,
  })

  if (unpinnedCount > 0) {
    cmds.push({
      id: 'pin-all-tabs',
      label: ctx.t('command.pinAllTabs'),
      description: ctx.t('commandDesc.pinAllTabs', { count: unpinnedCount }),
      icon: <Pin className="h-4 w-4" />,
      category: 'Tabs',
      action: () => {
        ctx.pinAllTabs()
        ctx.onClose()
      },
    })
  }

  if (pinnedCount > 0) {
    cmds.push({
      id: 'unpin-all-tabs',
      label: ctx.t('command.unpinAllTabs'),
      description: ctx.t('commandDesc.unpinAllTabs', { count: pinnedCount }),
      icon: <Pin className="h-4 w-4 -rotate-45" />,
      category: 'Tabs',
      action: () => {
        ctx.unpinAllTabs()
        ctx.onClose()
      },
    })
  }

  cmds.push(
    {
      id: 'close-tab',
      label: ctx.t('command.closeTab'),
      description: ctx.t('commandDesc.closeTab'),
      shortcut: getShortcutDisplay(ctx, 'close-tab'),
      icon: <X className="h-4 w-4" />,
      category: 'Tabs',
      action: () => {
        if (ctx.activeTabId) {
          ctx.closeTab(ctx.activeTabId)
        }
        ctx.onClose()
      },
      disabled: !ctx.activeTabId || isPinned,
    },
    {
      id: 'close-other-tabs',
      label: ctx.t('command.closeOtherTabs'),
      description: ctx.t('commandDesc.closeOtherTabs'),
      icon: <X className="h-4 w-4" />,
      category: 'Tabs',
      action: () => {
        if (ctx.activeTabId) {
          ctx.closeOtherTabs(ctx.activeTabId)
        }
        ctx.onClose()
      },
      disabled: ctx.tabs.length <= 1,
    },
    {
      id: 'close-tabs-to-right',
      label: ctx.t('command.closeTabsToRight'),
      description: ctx.t('commandDesc.closeTabsToRight'),
      icon: <X className="h-4 w-4" />,
      category: 'Tabs',
      action: () => {
        if (ctx.activeTabId) {
          ctx.closeTabsToRight(ctx.activeTabId)
        }
        ctx.onClose()
      },
      disabled: ctx.tabs.length <= 1,
    },
    {
      id: 'close-all-tabs',
      label: ctx.t('command.closeAllTabs'),
      description: ctx.t('commandDesc.closeAllTabs'),
      icon: <X className="h-4 w-4" />,
      category: 'Tabs',
      action: () => {
        ctx.closeAllTabs()
        ctx.onClose()
      },
    }
  )

  return cmds
}

function buildSettingsCommands(ctx: CommandContext): Command[] {
  return [
    {
      id: 'open-settings',
      label: ctx.t('command.openSettings'),
      description: ctx.t('commandDesc.openSettings'),
      shortcut: getShortcutDisplay(ctx, 'open-settings'),
      keywords: ['preferences', 'options', 'configure', 'config'],
      icon: <Settings className="h-4 w-4" />,
      category: 'Settings',
      action: () => {
        ctx.openSettingsTab()
        ctx.onClose()
      },
    },
    {
      id: 'toggle-readonly',
      label: ctx.readonlyMode ? ctx.t('command.disableReadonly') : ctx.t('command.enableReadonly'),
      description: ctx.readonlyMode
        ? ctx.t('commandDesc.disableReadonly')
        : ctx.t('commandDesc.enableReadonly'),
      shortcut: getShortcutDisplay(ctx, 'toggle-readonly'),
      keywords: ['readonly', 'read-only', 'edit', 'safe', 'lock'],
      icon: <Lock className="h-4 w-4" />,
      category: 'Settings',
      action: () => {
        ctx.toggleReadonlyMode()
        ctx.onClose()
      },
    },
  ]
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Build all commands based on the current context
 */
export function buildCommands(ctx: CommandContext): Command[] {
  return [
    ...buildHelpCommands(ctx),
    ...buildAppearanceCommands(ctx),
    ...buildViewCommands(ctx),
    ...buildNavigationCommands(ctx),
    ...buildDataclassCommands(ctx),
    ...buildEntitiesCommands(ctx),
    ...buildEntityCommands(ctx),
    ...buildTabCommands(ctx),
    ...buildSettingsCommands(ctx),
  ]
}

/**
 * Get a command by its ID
 */
export function getCommandById(commands: Command[], id: string): Command | undefined {
  return commands.find((c) => c.id === id)
}

/**
 * Get all commands in a specific category
 */
export function getCommandsByCategory(commands: Command[], category: CommandCategory): Command[] {
  return commands.filter((c) => c.category === category)
}

/**
 * Get all enabled (non-disabled) commands
 */
export function getEnabledCommands(commands: Command[]): Command[] {
  return commands.filter((c) => !c.disabled)
}

/**
 * Filter commands based on search query.
 * When t is provided, keyword matching also uses translated keyword labels.
 */
export function filterCommands(
  commands: Command[],
  query: string,
  t?: (key: string) => string
): Command[] {
  if (!query.trim()) return commands

  const lowerQuery = query.toLowerCase()
  return commands.filter((c) => {
    const labelMatch = c.label.toLowerCase().includes(lowerQuery)
    const descMatch = c.description?.toLowerCase().includes(lowerQuery)
    const categoryMatch = c.category.toLowerCase().includes(lowerQuery)
    const keywordMatch = c.keywords?.some((k) => {
      const rawMatch = k.toLowerCase().includes(lowerQuery)
      if (rawMatch) return true
      if (t) {
        const translated = t(`commandPalette.keyword.${k}`)
        if (translated && translated !== `commandPalette.keyword.${k}`) {
          return translated.toLowerCase().includes(lowerQuery)
        }
      }
      return false
    })
    return labelMatch || descMatch || categoryMatch || keywordMatch
  })
}

/**
 * Group commands by category
 */
export function groupCommandsByCategory(
  commands: Command[]
): Partial<Record<CommandCategory, Command[]>> {
  const groups: Partial<Record<CommandCategory, Command[]>> = {}

  for (const cmd of commands) {
    const existing = groups[cmd.category]
    groups[cmd.category] = existing ? [...existing, cmd] : [cmd]
  }

  // Ensure Recent is first if it exists
  if (groups.Recent) {
    const { Recent, ...rest } = groups
    return { Recent, ...rest }
  }

  return groups
}

/**
 * Get all unique categories from commands
 */
export function getCategories(commands: Command[]): CommandCategory[] {
  const categories = new Set<CommandCategory>()
  for (const cmd of commands) {
    categories.add(cmd.category)
  }
  return Array.from(categories)
}
