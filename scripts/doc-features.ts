/**
 * Canonical list of user-facing Data Explorer features for documentation coverage.
 * Each feature is considered documented when guide markdown matches at least one pattern.
 */

export type DocFeature = {
  id: string
  label: string
  category: string
  /** Case-insensitive substring(s); at least one must appear in the docs guide */
  patterns: string[]
}

export const DOC_FEATURES: DocFeature[] = [
  // Getting started
  {
    id: 'launch-from-4d',
    label: 'Launch from 4D',
    category: 'Getting started',
    patterns: ['Data Explorer In Browser', 'Getting started'],
  },
  {
    id: 'access-key-fallback',
    label: 'Access key (direct URL)',
    category: 'Getting started',
    patterns: ['access key', 'Opening via URL'],
  },

  // Interface
  {
    id: 'interface-layout',
    label: 'Interface layout',
    category: 'Interface',
    patterns: ['Interface overview', 'Header', 'Footer'],
  },
  {
    id: 'resizable-panels',
    label: 'Resizable panels',
    category: 'Interface',
    patterns: ['Resizable panels', 'entity list', 'sidebar width'],
  },
  {
    id: 'footer-bar',
    label: 'Footer bar controls',
    category: 'Interface',
    patterns: ['Footer bar', 'language selector'],
  },

  // Home
  {
    id: 'home-screen',
    label: 'Home screen',
    category: 'Home',
    patterns: ['## Home screen', 'Database statistics'],
  },
  {
    id: 'home-quick-actions',
    label: 'Home quick actions',
    category: 'Home',
    patterns: ['quick action', 'Command Palette'],
  },
  {
    id: 'home-server-info',
    label: 'Server info panel',
    category: 'Home',
    patterns: ['Server info', '/rest/$info'],
  },

  // Sidebar
  {
    id: 'sidebar-search',
    label: 'Sidebar dataclass search',
    category: 'Sidebar',
    patterns: ['sidebar search', 'search dataclasses'],
  },
  {
    id: 'sidebar-view-modes',
    label: 'Sidebar view modes',
    category: 'Sidebar',
    patterns: ['Sidebar view', 'Cards, Tables, or Icons'],
  },
  {
    id: 'sidebar-collapse',
    label: 'Sidebar collapse',
    category: 'Sidebar',
    patterns: ['Collapse', 'sidebar-collapsed'],
  },
  {
    id: 'dataclass-appearance',
    label: 'Dataclass appearance',
    category: 'Sidebar',
    patterns: ['Dataclass appearance', 'Randomize'],
  },

  // Browsing
  {
    id: 'dataclass-view',
    label: 'Dataclass view layout',
    category: 'Browsing',
    patterns: ['Entity list', 'Query bar', 'Entity viewer'],
  },
  {
    id: 'cards-view',
    label: 'Cards list view',
    category: 'Browsing',
    patterns: ['Cards', '07-card-view'],
  },
  {
    id: 'table-view',
    label: 'Table list view',
    category: 'Browsing',
    patterns: ['Table view', '07-table-view'],
  },
  {
    id: 'create-entity',
    label: 'Create entity',
    category: 'Browsing',
    patterns: ['Create entity', '+ New'],
  },
  {
    id: 'table-columns',
    label: 'Table columns from query',
    category: 'Browsing',
    patterns: ['$attributes', 'column'],
  },
  {
    id: 'highlight-in-graph',
    label: 'Highlight in structure',
    category: 'Browsing',
    patterns: ['Show in structure', 'highlight'],
  },

  // Query
  {
    id: 'query-builder',
    label: 'Query builder',
    category: 'Query',
    patterns: ['## Query builder', '$filter'],
  },
  {
    id: 'query-history',
    label: 'Query history',
    category: 'Query',
    patterns: ['Query history', 'history'],
  },
  {
    id: 'entity-set-binding',
    label: 'Entity set binding',
    category: 'Query',
    patterns: ['Entity set', '$entityset'],
  },

  // Entity viewer
  {
    id: 'entity-view-modes',
    label: 'Entity view modes (Form/Tree/JSON)',
    category: 'Entity viewer',
    patterns: ['Form', 'Tree', 'JSON'],
  },
  {
    id: 'method-executor',
    label: 'Method Executor',
    category: 'Tools',
    patterns: ['## Method Executor', 'method-executor', 'Result views'],
  },
  {
    id: 'entity-edit-save',
    label: 'Edit, save, cancel entity',
    category: 'Entity viewer',
    patterns: ['Save', 'cancel edit'],
  },
  {
    id: 'entity-duplicate-delete',
    label: 'Duplicate and delete entity',
    category: 'Entity viewer',
    patterns: ['Duplicate', 'Delete'],
  },
  {
    id: 'entity-images-blobs',
    label: 'Image and file fields',
    category: 'Entity viewer',
    patterns: ['image', 'PDF', 'upload'],
  },
  {
    id: 'entity-tree-expand',
    label: 'Tree expand/collapse',
    category: 'Entity viewer',
    patterns: ['expand', 'collapse'],
  },

  // Structure graph
  {
    id: 'structure-graph',
    label: 'Structure graph',
    category: 'Structure',
    patterns: ['## Structure graph', 'structure-graph'],
  },
  {
    id: 'graph-toolbar',
    label: 'Graph toolbar (organize, relations)',
    category: 'Structure',
    patterns: ['Auto-organize', 'relation filter'],
  },
  {
    id: 'graph-singletons-methods',
    label: 'Singletons and catalog methods',
    category: 'Structure',
    patterns: ['singletons', 'catalog methods'],
  },
  {
    id: 'graph-viewport-persist',
    label: 'Persisted graph viewport',
    category: 'Structure',
    patterns: ['Persisted viewport', 'zoom and pan'],
  },

  // Command palette
  {
    id: 'command-palette',
    label: 'Command palette',
    category: 'Command palette',
    patterns: ['## Command palette', 'command-palette'],
  },
  {
    id: 'palette-quick-modes',
    label: 'Palette quick modes (:, >, /, @)',
    category: 'Command palette',
    patterns: ['Quick modes', 'Go to entity by index'],
  },
  {
    id: 'open-all-dataclasses',
    label: 'Open all dataclasses',
    category: 'Command palette',
    patterns: ['Open all dataclasses'],
  },
  {
    id: 'switch-tabs-mode',
    label: 'Switch tabs mode',
    category: 'Command palette',
    patterns: ['Switch tabs', '@Settings'],
  },

  // Tabs
  {
    id: 'tabs-basics',
    label: 'Tab basics (drag, pin, close)',
    category: 'Tabs',
    patterns: ['## Tabs', 'Pin', 'Close'],
  },
  {
    id: 'tabs-pin-all',
    label: 'Pin all / unpin all tabs',
    category: 'Tabs',
    patterns: ['Pin all', 'unpin all'],
  },
  {
    id: 'tab-number-shortcuts',
    label: 'Tab number shortcuts',
    category: 'Tabs',
    patterns: ['Ctrl+Alt+1', 'tab 1'],
  },

  // Modes
  {
    id: 'readonly-mode',
    label: 'Read-only mode',
    category: 'Modes',
    patterns: ['Read-only', 'read-only-mode'],
  },
  {
    id: 'default-edit-mode',
    label: 'Default edit mode setting',
    category: 'Modes',
    patterns: ['Default edit mode', 'Form or JSON'],
  },

  // Settings
  {
    id: 'settings-general',
    label: 'Settings — general',
    category: 'Settings',
    patterns: ['### General', 'Page size'],
  },
  {
    id: 'settings-appearance',
    label: 'Settings — appearance & themes',
    category: 'Settings',
    patterns: ['### Appearance', 'Tangerine'],
  },
  {
    id: 'settings-code-editor',
    label: 'Code editor preferences',
    category: 'Settings',
    patterns: ['### Code editor', 'Monaco'],
  },
  {
    id: 'settings-shortcuts',
    label: 'Keyboard shortcut customization',
    category: 'Settings',
    patterns: ['### Keyboard shortcuts', 'Vim-like'],
  },
  {
    id: 'settings-assistant-tools',
    label: 'AI assistant tools settings',
    category: 'Settings',
    patterns: ['### AI Assistant tools', 'tool namespaces'],
  },
  {
    id: 'settings-reset',
    label: 'Reset all settings',
    category: 'Settings',
    patterns: ['Reset all settings'],
  },

  // Keyboard shortcuts
  {
    id: 'keyboard-shortcuts-reference',
    label: 'Keyboard shortcuts reference',
    category: 'Keyboard shortcuts',
    patterns: ['## Keyboard shortcuts', 'command-palette'],
  },
  {
    id: 'chord-shortcuts',
    label: 'Chord shortcuts',
    category: 'Keyboard shortcuts',
    patterns: ['Chord shortcuts', 'waiting for second key'],
  },

  // Assistant
  {
    id: 'ai-assistant',
    label: 'AI assistant panel',
    category: 'Assistant',
    patterns: ['## AI assistant', 'assistant-panel'],
  },
  {
    id: 'assistant-mermaid',
    label: 'Mermaid diagrams in assistant',
    category: 'Assistant',
    patterns: ['Mermaid'],
  },
  {
    id: 'assistant-config',
    label: 'Assistant LLM configuration',
    category: 'Assistant',
    patterns: ['Configure an LLM', 'Assistant Metadata Editor'],
  },

  // Console
  {
    id: 'console-panel',
    label: 'Console panel',
    category: 'Console',
    patterns: ['## Console panel', 'console-panel'],
  },
  {
    id: 'console-network',
    label: 'Console network logging',
    category: 'Console',
    patterns: ['Network log', 'Open in HTTP Client', 'response size'],
  },
  {
    id: 'console-filter',
    label: 'Console filter and clear',
    category: 'Console',
    patterns: ['Filter by level', 'Collapse all'],
  },

  // Tools
  {
    id: 'http-client',
    label: 'HTTP Client',
    category: 'Tools',
    patterns: ['## HTTP Client', 'http-client', 'Open in HTTP Client'],
  },
  {
    id: 'http-client-response-previews',
    label: 'HTTP Client response previews',
    category: 'Tools',
    patterns: [
      'Binary bodies',
      'Preview as text',
      'text/plain',
      'application/pdf',
      'http-client-response',
    ],
  },
  {
    id: 'http-client-history',
    label: 'HTTP Client history',
    category: 'Tools',
    patterns: ['### History', 'http-client-history', 'Last requests'],
  },
  {
    id: 'http-client-network-errors',
    label: 'HTTP Client network errors',
    category: 'Tools',
    patterns: ['Network errors', 'http-client-network-error', 'structured error panel'],
  },
  {
    id: 'schema-builder',
    label: 'JSON Schema Builder',
    category: 'Tools',
    patterns: ['## JSON Schema Builder', 'schema-builder'],
  },
  {
    id: 'schema-copy-test',
    label: 'Schema copy & test plugins',
    category: 'Tools',
    patterns: ['Copy schema', 'Test schema'],
  },
  {
    id: 'metadata-editor',
    label: 'Assistant Metadata Editor',
    category: 'Tools',
    patterns: ['## Assistant Metadata Editor', 'Generate all'],
  },

  // Other
  {
    id: 'release-notes',
    label: 'Release notes',
    category: 'Other',
    patterns: ['## Release notes', 'release-notes'],
  },
  {
    id: 'language-localization',
    label: 'Language & localization',
    category: 'Other',
    patterns: ['Language & localization', 'English', 'French', 'Spanish'],
  },
  {
    id: 'profiles',
    label: 'Profiles & import/export',
    category: 'Other',
    patterns: ['## Profiles', 'import/export'],
  },
  {
    id: 'per-database-storage',
    label: 'Per-database persistence',
    category: 'Other',
    patterns: ['BASEID', 'per database'],
  },
]

export function isFeatureDocumented(content: string, feature: DocFeature): boolean {
  const lower = content.toLowerCase()
  return feature.patterns.some((pattern) => lower.includes(pattern.toLowerCase()))
}

export function analyzeDocumentation(content: string): {
  documented: DocFeature[]
  missing: DocFeature[]
  coveragePct: number
} {
  const documented: DocFeature[] = []
  const missing: DocFeature[] = []

  for (const feature of DOC_FEATURES) {
    if (isFeatureDocumented(content, feature)) {
      documented.push(feature)
    } else {
      missing.push(feature)
    }
  }

  const coveragePct =
    DOC_FEATURES.length === 0 ? 100 : (documented.length / DOC_FEATURES.length) * 100

  return { documented, missing, coveragePct }
}
