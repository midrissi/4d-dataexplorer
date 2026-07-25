/**
 * Modifier keys
 */
export type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta'

/**
 * Shortcut key combination
 */
export interface KeyCombination {
  key: string
  modifiers?: Modifier[]
}

/**
 * Available shortcut actions in the app
 */
export type ShortcutAction =
  // Navigation
  | 'navigate.dataclasses'
  | 'navigate.query'
  | 'navigate.settings'
  | 'navigate.back'
  | 'navigate.forward'
  // Query
  | 'query.execute'
  | 'query.clear'
  | 'query.format'
  | 'query.history.prev'
  | 'query.history.next'
  | 'query.save'
  | 'query.load'
  // Editor
  | 'editor.focus'
  | 'editor.selectAll'
  | 'editor.undo'
  | 'editor.redo'
  | 'editor.find'
  | 'editor.replace'
  | 'editor.comment'
  // Results
  | 'results.refresh'
  | 'results.export'
  | 'results.copy'
  | 'results.nextPage'
  | 'results.prevPage'
  | 'results.firstPage'
  | 'results.lastPage'
  // General
  | 'general.save'
  | 'general.help'
  | 'general.commandPalette'
  | 'general.escape'
  | 'general.toggleSidebar'
  | 'general.toggleTheme'

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  action: ShortcutAction
  keys: KeyCombination
  description: string
  category: 'navigation' | 'query' | 'editor' | 'results' | 'general'
  /** Whether the shortcut works when focus is in an input/textarea */
  allowInInput?: boolean
}

/**
 * Shortcut preset
 */
export interface ShortcutPreset {
  id: string
  name: string
  description: string
  shortcuts: ShortcutDefinition[]
}

/**
 * Shortcut context for user customization
 */
export interface ShortcutConfig {
  activePreset: string
  customOverrides: Partial<Record<ShortcutAction, KeyCombination>>
}
