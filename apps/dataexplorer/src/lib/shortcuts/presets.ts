import type { ShortcutDefinition, ShortcutPreset } from './types'

/**
 * Default shortcut preset - Standard keyboard shortcuts
 */
export const defaultPreset: ShortcutPreset = {
  id: 'default',
  name: 'Default',
  description: 'Standard keyboard shortcuts',
  shortcuts: [
    // Navigation
    {
      action: 'navigate.dataclasses',
      keys: { key: '1', modifiers: ['ctrl'] },
      description: 'Go to Data Classes',
      category: 'navigation',
    },
    {
      action: 'navigate.query',
      keys: { key: '2', modifiers: ['ctrl'] },
      description: 'Go to Query Editor',
      category: 'navigation',
    },
    {
      action: 'navigate.settings',
      keys: { key: ',', modifiers: ['ctrl'] },
      description: 'Open Settings',
      category: 'navigation',
    },
    {
      action: 'navigate.back',
      keys: { key: '[', modifiers: ['ctrl'] },
      description: 'Go Back',
      category: 'navigation',
    },
    {
      action: 'navigate.forward',
      keys: { key: ']', modifiers: ['ctrl'] },
      description: 'Go Forward',
      category: 'navigation',
    },

    // Query
    {
      action: 'query.execute',
      keys: { key: 'Enter', modifiers: ['ctrl'] },
      description: 'Execute Query',
      category: 'query',
    },
    {
      action: 'query.clear',
      keys: { key: 'l', modifiers: ['ctrl', 'shift'] },
      description: 'Clear Query',
      category: 'query',
    },
    {
      action: 'query.format',
      keys: { key: 'f', modifiers: ['ctrl', 'shift'] },
      description: 'Format Query',
      category: 'query',
    },
    {
      action: 'query.history.prev',
      keys: { key: 'ArrowUp', modifiers: ['alt'] },
      description: 'Previous Query in History',
      category: 'query',
    },
    {
      action: 'query.history.next',
      keys: { key: 'ArrowDown', modifiers: ['alt'] },
      description: 'Next Query in History',
      category: 'query',
    },
    {
      action: 'query.save',
      keys: { key: 's', modifiers: ['ctrl', 'shift'] },
      description: 'Save Query',
      category: 'query',
    },
    {
      action: 'query.load',
      keys: { key: 'o', modifiers: ['ctrl', 'shift'] },
      description: 'Load Saved Query',
      category: 'query',
    },

    // Editor
    {
      action: 'editor.focus',
      keys: { key: 'e', modifiers: ['ctrl'] },
      description: 'Focus Editor',
      category: 'editor',
    },
    {
      action: 'editor.selectAll',
      keys: { key: 'a', modifiers: ['ctrl'] },
      description: 'Select All',
      category: 'editor',
      allowInInput: true,
    },
    {
      action: 'editor.undo',
      keys: { key: 'z', modifiers: ['ctrl'] },
      description: 'Undo',
      category: 'editor',
      allowInInput: true,
    },
    {
      action: 'editor.redo',
      keys: { key: 'z', modifiers: ['ctrl', 'shift'] },
      description: 'Redo',
      category: 'editor',
      allowInInput: true,
    },
    {
      action: 'editor.find',
      keys: { key: 'f', modifiers: ['ctrl'] },
      description: 'Find',
      category: 'editor',
    },
    {
      action: 'editor.replace',
      keys: { key: 'h', modifiers: ['ctrl'] },
      description: 'Find and Replace',
      category: 'editor',
    },
    {
      action: 'editor.comment',
      keys: { key: '/', modifiers: ['ctrl'] },
      description: 'Toggle Comment',
      category: 'editor',
    },

    // Results
    {
      action: 'results.refresh',
      keys: { key: 'r', modifiers: ['ctrl'] },
      description: 'Refresh Results',
      category: 'results',
    },
    {
      action: 'results.export',
      keys: { key: 'e', modifiers: ['ctrl', 'shift'] },
      description: 'Export Results',
      category: 'results',
    },
    {
      action: 'results.copy',
      keys: { key: 'c', modifiers: ['ctrl', 'shift'] },
      description: 'Copy Results',
      category: 'results',
    },
    {
      action: 'results.nextPage',
      keys: { key: 'ArrowRight', modifiers: ['ctrl'] },
      description: 'Next Page',
      category: 'results',
    },
    {
      action: 'results.prevPage',
      keys: { key: 'ArrowLeft', modifiers: ['ctrl'] },
      description: 'Previous Page',
      category: 'results',
    },
    {
      action: 'results.firstPage',
      keys: { key: 'Home', modifiers: ['ctrl'] },
      description: 'First Page',
      category: 'results',
    },
    {
      action: 'results.lastPage',
      keys: { key: 'End', modifiers: ['ctrl'] },
      description: 'Last Page',
      category: 'results',
    },

    // General
    {
      action: 'general.save',
      keys: { key: 's', modifiers: ['ctrl'] },
      description: 'Save',
      category: 'general',
    },
    {
      action: 'general.help',
      keys: { key: 'F1' },
      description: 'Show Help',
      category: 'general',
    },
    {
      action: 'general.commandPalette',
      keys: { key: 'p', modifiers: ['ctrl', 'shift'] },
      description: 'Open Command Palette',
      category: 'general',
    },
    {
      action: 'general.escape',
      keys: { key: 'Escape' },
      description: 'Cancel / Close',
      category: 'general',
      allowInInput: true,
    },
    {
      action: 'general.toggleSidebar',
      keys: { key: 'b', modifiers: ['ctrl'] },
      description: 'Toggle Sidebar',
      category: 'general',
    },
    {
      action: 'general.toggleTheme',
      keys: { key: 't', modifiers: ['ctrl', 'shift'] },
      description: 'Toggle Theme',
      category: 'general',
    },
  ],
}

/**
 * VSCode-like preset
 */
export const vscodePreset: ShortcutPreset = {
  id: 'vscode',
  name: 'VS Code',
  description: 'VS Code-like keyboard shortcuts',
  shortcuts: [
    ...defaultPreset.shortcuts.map((s) => {
      // Override specific shortcuts for VS Code style
      const overrides: Partial<Record<string, ShortcutDefinition>> = {
        'query.execute': {
          ...s,
          action: 'query.execute',
          keys: { key: 'F5' },
          description: 'Execute Query',
          category: 'query',
        },
        'general.commandPalette': {
          ...s,
          action: 'general.commandPalette',
          keys: { key: 'p', modifiers: ['ctrl', 'shift'] },
          description: 'Open Command Palette',
          category: 'general',
        },
        'navigate.settings': {
          ...s,
          action: 'navigate.settings',
          keys: { key: ',', modifiers: ['ctrl'] },
          description: 'Open Settings',
          category: 'navigation',
        },
        'editor.comment': {
          ...s,
          action: 'editor.comment',
          keys: { key: '/', modifiers: ['ctrl'] },
          description: 'Toggle Comment',
          category: 'editor',
        },
        'general.toggleSidebar': {
          ...s,
          action: 'general.toggleSidebar',
          keys: { key: 'b', modifiers: ['ctrl'] },
          description: 'Toggle Sidebar',
          category: 'general',
        },
      }
      return overrides[s.action] ?? s
    }),
  ],
}

/**
 * Minimal preset - Only essential shortcuts
 */
export const minimalPreset: ShortcutPreset = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Only essential keyboard shortcuts',
  shortcuts: [
    {
      action: 'query.execute',
      keys: { key: 'Enter', modifiers: ['ctrl'] },
      description: 'Execute Query',
      category: 'query',
    },
    {
      action: 'general.save',
      keys: { key: 's', modifiers: ['ctrl'] },
      description: 'Save',
      category: 'general',
    },
    {
      action: 'general.escape',
      keys: { key: 'Escape' },
      description: 'Cancel / Close',
      category: 'general',
      allowInInput: true,
    },
    {
      action: 'editor.undo',
      keys: { key: 'z', modifiers: ['ctrl'] },
      description: 'Undo',
      category: 'editor',
      allowInInput: true,
    },
    {
      action: 'editor.redo',
      keys: { key: 'z', modifiers: ['ctrl', 'shift'] },
      description: 'Redo',
      category: 'editor',
      allowInInput: true,
    },
    {
      action: 'results.refresh',
      keys: { key: 'r', modifiers: ['ctrl'] },
      description: 'Refresh Results',
      category: 'results',
    },
  ],
}

/**
 * Mac-optimized preset
 */
export const macPreset: ShortcutPreset = {
  id: 'mac',
  name: 'macOS',
  description: 'macOS-optimized shortcuts using Cmd key',
  shortcuts: defaultPreset.shortcuts.map((s) => ({
    ...s,
    keys: {
      ...s.keys,
      modifiers: s.keys.modifiers?.map((m) =>
        m === 'ctrl' ? 'meta' : m
      ) as typeof s.keys.modifiers,
    },
  })),
}

/**
 * All available presets
 */
export const presets: ShortcutPreset[] = [defaultPreset, vscodePreset, minimalPreset, macPreset]

/**
 * Get preset by ID
 */
export function getPreset(id: string): ShortcutPreset | undefined {
  return presets.find((p) => p.id === id)
}

/**
 * Get default preset based on platform
 */
export function getDefaultPreset(): ShortcutPreset {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? macPreset : defaultPreset
}
