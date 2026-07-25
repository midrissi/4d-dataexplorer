// Types

// Presets
export {
  defaultPreset,
  getDefaultPreset,
  getPreset,
  macPreset,
  minimalPreset,
  presets,
  vscodePreset,
} from './presets'
export type {
  KeyCombination,
  Modifier,
  ShortcutAction,
  ShortcutConfig,
  ShortcutDefinition,
  ShortcutPreset,
} from './types'
// Hooks
export {
  useCurrentPreset,
  useEffectiveShortcuts,
  usePresets,
  useShortcut,
  useShortcutListener,
  useShortcutStore,
} from './use-shortcuts'
// Utils
export {
  formatKey,
  formatKeyCombination,
  getCategoryDisplayName,
  groupShortcutsByCategory,
  isInputElement,
  keyCombinationToString,
  matchesKeyCombination,
  parseShortcutString,
} from './utils'
