import { DEFAULT_EDITOR_PREFS, type EditorPrefs } from '@4d/ui/editor-prefs'
import { icons } from 'lucide-react'
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import {
  ASSISTANT_TOOL_NAMESPACES,
  type AssistantToolNamespace,
  type AssistantToolPrefs,
  applyToolPattern,
  parseToolPattern,
} from '~/assistant/tool-catalog'
import { prepareMobileOverlay } from '~/lib/mobile-overlays'
import type { ProfileEntry, ProfilePrefs } from '~/lib/storage'
import {
  DEFAULT_PROFILE_PREFS,
  getCurrentPrefs,
  getDataclassCustomizations,
  getProfilesStorage,
  readDataclassCustomizationsForRehydrate,
  saveDataclassCustomizations,
  saveProfilesStorage,
  setThemeName as saveThemeNameToStorage,
  setTheme as saveThemeToStorage,
} from '~/lib/storage'
import { useTabsStore } from './tabs'

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Detect if the current platform is macOS
 */
export function isMacOS(): boolean {
  if (typeof window === 'undefined') return false
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || /Mac/i.test(navigator.userAgent)
}

/** Primary chord modifier label for UI hints: ⌘ on Apple, Ctrl elsewhere. */
export function platformModLabel(): string {
  return isMacOS() ? '⌘' : 'Ctrl'
}

/**
 * Get platform-appropriate modifier key
 * Returns { meta: true } for macOS, { ctrl: true } for Windows/Linux
 */
function getPlatformModifier(): { meta?: boolean; ctrl?: boolean } {
  return isMacOS() ? { meta: true } : { ctrl: true }
}

/**
 * Get platform-appropriate modifier key with additional modifiers
 * @example getPlatformModifierWith({ shift: true }) => { meta: true, shift: true } on macOS
 */
function getPlatformModifierWith(additional: { shift?: boolean; alt?: boolean }): {
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
} {
  return { ...getPlatformModifier(), ...additional }
}

/**
 * Modifiers for Switch Tabs shortcut.
 * macOS: Ctrl+Shift+T (avoids Cmd+Shift+T = reopen tab, and Option+T = Þ on some layouts).
 * Windows/Linux: Ctrl+Alt+T (avoids Ctrl+Shift+T = reopen tab).
 */
function getSwitchTabsModifier(): { ctrl?: boolean; shift?: boolean; alt?: boolean } {
  return isMacOS() ? { ctrl: true, shift: true } : { ctrl: true, alt: true }
}

/** Build a chord [first key, second key] for chorded shortcuts (VSCode-style). */
function chord(
  key1: string,
  mod1: KeyCombo['modifiers'],
  key2: string,
  mod2: KeyCombo['modifiers']
): [KeyCombo, KeyCombo] {
  return [
    { key: key1, modifiers: mod1 },
    { key: key2, modifiers: mod2 },
  ]
}

// =============================================================================
// Custom Storage Adapter
// =============================================================================

/** Translation key for the default profile display name (use with t()). */
export const DEFAULT_PROFILE_NAME_KEY = 'settings.defaultProfileName'

/** Build default profile (cannot be removed) */
function buildDefaultProfile(): Profile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'Default',
    settings: { ...DEFAULT_SETTINGS },
  }
}

/** Omit base-only fields (dataclassCustomizations, graphEditorState) when persisting to dataexplorer:profiles */
function settingsWithoutBaseOnlyFields(
  s: ProfileSettings
): Omit<ProfileSettings, 'dataclassCustomizations'> {
  const { dataclassCustomizations: _, ...rest } = s
  return rest
}

/**
 * Environments and pick lists are written by their own stores into profile settings.
 * The settings persist adapter rebuilds settings from Zustand state (which does
 * not track them), so merge them back from existing storage on write.
 */
function withPreservedEnvironments(
  settings: Record<string, unknown>,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  const source = existing ?? {}
  let next = settings
  if (Array.isArray(source.environments)) {
    const activeRaw = source.activeEnvironmentId
    next = {
      ...next,
      environments: source.environments,
      activeEnvironmentId: typeof activeRaw === 'string' || activeRaw === null ? activeRaw : null,
    }
  }
  if (Array.isArray(source.pickLists)) {
    next = { ...next, pickLists: source.pickLists }
  }
  return next
}

/**
 * Custom storage adapter: dataexplorer:profiles format { current, profiles: { [id]: { name, settings } } }.
 * settings = merged prefs + profile settings (no dataclassCustomizations, no graphEditorState).
 */
const createSettingsStorage = () =>
  createJSONStorage(() => ({
    getItem: (): string | null => {
      const data = getProfilesStorage()
      const currentId = data.current ?? DEFAULT_PROFILE_ID
      const entries = Object.entries(data.profiles)
      if (entries.length === 0) {
        const defaultProfile = buildDefaultProfile()
        const dataclassCustomizations = readDataclassCustomizationsForRehydrate() as Record<
          string,
          DataclassCustomization
        >
        return JSON.stringify({
          state: {
            ...defaultProfile.settings,
            dataclassCustomizations,
            profiles: [defaultProfile],
            currentProfileId: DEFAULT_PROFILE_ID,
          },
        })
      }

      const dataclassCustomizations = readDataclassCustomizationsForRehydrate() as Record<
        string,
        DataclassCustomization
      >
      const profiles: Profile[] = entries.map(([id, entry]) => {
        const es = entry.settings ?? {}
        return {
          id,
          name: entry.name,
          icon: typeof entry.icon === 'string' ? entry.icon : undefined,
          color: typeof entry.color === 'string' ? entry.color : undefined,
          settings: {
            version: (es.version as number) ?? DEFAULT_SETTINGS.version,
            theme: (es.theme === 'light' || es.theme === 'dark'
              ? es.theme
              : DEFAULT_SETTINGS.theme) as ProfilePrefs['theme'],
            themeName: (typeof es.themeName === 'string'
              ? es.themeName
              : DEFAULT_SETTINGS.themeName) as ProfilePrefs['themeName'],
            panels: (es.panels && typeof es.panels === 'object'
              ? es.panels
              : DEFAULT_SETTINGS.panels) as ProfilePrefs['panels'],
            recentCommands: (Array.isArray(es.recentCommands)
              ? es.recentCommands
              : DEFAULT_SETTINGS.recentCommands) as ProfilePrefs['recentCommands'],
            language: (es.language === 'en' || es.language === 'fr' || es.language === 'es'
              ? es.language
              : DEFAULT_SETTINGS.language) as Language,
            readonlyMode: (es.readonlyMode as boolean) ?? DEFAULT_SETTINGS.readonlyMode,
            confirmDisconnect:
              (es.confirmDisconnect as boolean) ?? DEFAULT_SETTINGS.confirmDisconnect,
            sidebarCollapsed: (es.sidebarCollapsed as boolean) ?? DEFAULT_SETTINGS.sidebarCollapsed,
            assistantOpen: (es.assistantOpen as boolean) ?? DEFAULT_SETTINGS.assistantOpen,
            consoleOpen: (es.consoleOpen as boolean) ?? DEFAULT_SETTINGS.consoleOpen,
            bottomPanelTab:
              es.bottomPanelTab === 'terminal' || es.bottomPanelTab === 'console'
                ? es.bottomPanelTab
                : DEFAULT_SETTINGS.bottomPanelTab,
            defaultViewMode:
              (es.defaultViewMode as DefaultViewMode) ?? DEFAULT_SETTINGS.defaultViewMode,
            defaultEntityViewMode:
              (es.defaultEntityViewMode as EntityViewMode) ??
              DEFAULT_SETTINGS.defaultEntityViewMode,
            defaultEditMode: (es.defaultEditMode as EditMode) ?? DEFAULT_SETTINGS.defaultEditMode,
            sidebarViewMode:
              (es.sidebarViewMode as SidebarViewMode) ?? DEFAULT_SETTINGS.sidebarViewMode,
            sidebarSortOption: parseSidebarSortOption(
              es.sidebarSortOption,
              DEFAULT_SETTINGS.sidebarSortOption
            ),
            pageSize: (es.pageSize as number) ?? DEFAULT_SETTINGS.pageSize,
            defaultQueryRunMode:
              es.defaultQueryRunMode === 'run' || es.defaultQueryRunMode === 'runAsSelection'
                ? es.defaultQueryRunMode
                : DEFAULT_SETTINGS.defaultQueryRunMode,
            shortcuts: mergeShortcutsWithDefaults(es.shortcuts as KeyboardShortcut[] | undefined),
            activeShortcutPreset:
              (es.activeShortcutPreset as ShortcutPresetId | 'custom') ??
              DEFAULT_SETTINGS.activeShortcutPreset,
            codeEditorPrefs: (es.codeEditorPrefs && typeof es.codeEditorPrefs === 'object'
              ? { ...DEFAULT_EDITOR_PREFS, ...es.codeEditorPrefs }
              : DEFAULT_EDITOR_PREFS) as EditorPrefs,
            dataclassCustomizations,
            assistantDisabledNamespaces: Array.isArray(es.assistantDisabledNamespaces)
              ? (es.assistantDisabledNamespaces as AssistantToolNamespace[]).filter((ns) =>
                  ASSISTANT_TOOL_NAMESPACES.includes(ns)
                )
              : DEFAULT_SETTINGS.assistantDisabledNamespaces,
            assistantDisabledTools: Array.isArray(es.assistantDisabledTools)
              ? (es.assistantDisabledTools as string[])
              : DEFAULT_SETTINGS.assistantDisabledTools,
            disabledWidgetTypes: Array.isArray(es.disabledWidgetTypes)
              ? (es.disabledWidgetTypes as string[])
              : DEFAULT_SETTINGS.disabledWidgetTypes,
          } as ProfileSettings,
        }
      })

      const currentProfile = profiles.find((p) => p.id === currentId) ?? profiles[0]
      return JSON.stringify({
        state: {
          ...currentProfile.settings,
          dataclassCustomizations,
          profiles,
          currentProfileId: currentId,
        },
      })
    },
    setItem: (_name: string, value: string): void => {
      try {
        const parsed = JSON.parse(value)
        const state = parsed.state as Partial<SettingsState> & {
          profiles?: Profile[]
          currentProfileId?: string
        }
        if (!state) return
        const profiles = state.profiles ?? [buildDefaultProfile()]
        const currentProfileId = state.currentProfileId ?? DEFAULT_PROFILE_ID
        const existingData = getProfilesStorage()
        const dataclassCustomizations = getDataclassCustomizations() as Record<
          string,
          DataclassCustomization
        >
        const prefs = getCurrentPrefs()
        // Use prefs for theme/themeName so we don't overwrite with stale store state
        // (store is not updated when user changes theme in UI; resetAllSettings resets theme explicitly)
        const currentProfileSettings: Omit<ProfileSettings, 'dataclassCustomizations'> = {
          version: prefs.version,
          theme: prefs.theme,
          themeName: prefs.themeName,
          panels: prefs.panels,
          recentCommands: prefs.recentCommands,
          language: state.language ?? DEFAULT_SETTINGS.language,
          readonlyMode: state.readonlyMode ?? DEFAULT_SETTINGS.readonlyMode,
          confirmDisconnect: state.confirmDisconnect ?? DEFAULT_SETTINGS.confirmDisconnect,
          sidebarCollapsed: state.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed,
          assistantOpen: state.assistantOpen ?? DEFAULT_SETTINGS.assistantOpen,
          consoleOpen: state.consoleOpen ?? DEFAULT_SETTINGS.consoleOpen,
          bottomPanelTab:
            state.bottomPanelTab === 'terminal' || state.bottomPanelTab === 'console'
              ? state.bottomPanelTab
              : DEFAULT_SETTINGS.bottomPanelTab,
          defaultViewMode: state.defaultViewMode ?? DEFAULT_SETTINGS.defaultViewMode,
          defaultEntityViewMode:
            state.defaultEntityViewMode ?? DEFAULT_SETTINGS.defaultEntityViewMode,
          defaultEditMode: state.defaultEditMode ?? DEFAULT_SETTINGS.defaultEditMode,
          sidebarViewMode: state.sidebarViewMode ?? DEFAULT_SETTINGS.sidebarViewMode,
          sidebarSortOption: parseSidebarSortOption(
            state.sidebarSortOption,
            DEFAULT_SETTINGS.sidebarSortOption
          ),
          pageSize: state.pageSize ?? DEFAULT_SETTINGS.pageSize,
          defaultQueryRunMode: state.defaultQueryRunMode ?? DEFAULT_SETTINGS.defaultQueryRunMode,
          shortcuts: mergeShortcutsWithDefaults(state.shortcuts),
          activeShortcutPreset: state.activeShortcutPreset ?? DEFAULT_SETTINGS.activeShortcutPreset,
          codeEditorPrefs: state.codeEditorPrefs ?? DEFAULT_EDITOR_PREFS,
          assistantDisabledNamespaces:
            state.assistantDisabledNamespaces ?? DEFAULT_SETTINGS.assistantDisabledNamespaces,
          assistantDisabledTools:
            state.assistantDisabledTools ?? DEFAULT_SETTINGS.assistantDisabledTools,
          disabledWidgetTypes: state.disabledWidgetTypes ?? DEFAULT_SETTINGS.disabledWidgetTypes,
        }
        const nextProfiles: Record<string, ProfileEntry> = {}
        for (const p of profiles) {
          const isCurrent = p.id === currentProfileId
          const merged = isCurrent
            ? { ...currentProfileSettings, dataclassCustomizations }
            : p.settings
          nextProfiles[p.id] = {
            name: p.name,
            icon: p.icon,
            color: p.color,
            settings: withPreservedEnvironments(
              settingsWithoutBaseOnlyFields(merged) as Record<string, unknown>,
              existingData.profiles[p.id]?.settings
            ),
          }
        }
        saveProfilesStorage({ current: currentProfileId, profiles: nextProfiles })
      } catch {
        // Ignore parse errors
      }
    },
    removeItem: (): void => {
      const defaultProfile = buildDefaultProfile()
      saveProfilesStorage({
        current: DEFAULT_PROFILE_ID,
        profiles: {
          [DEFAULT_PROFILE_ID]: {
            name: defaultProfile.name,
            settings: settingsWithoutBaseOnlyFields(defaultProfile.settings) as Record<
              string,
              unknown
            >,
          },
        },
      })
    },
  }))

// =============================================================================
// Types
// =============================================================================

export type EntityViewMode = 'tree' | 'json' | 'form'
export type EditMode = 'form' | 'json'
export type DefaultViewMode = 'cards' | 'table'
/** Default action for the query builder primary Run button / ⌘↵ shortcut. */
export type DefaultQueryRunMode = 'run' | 'runAsSelection'

/** Sidebar view mode: how dataclasses are listed (cards, tables, or icons) */
export type SidebarViewMode = 'cards' | 'tables' | 'icons'

/** Sidebar dataclass list sort order */
export type SidebarSortOption = 'none' | 'name-asc' | 'name-desc' | 'count-asc' | 'count-desc'

const SIDEBAR_SORT_OPTIONS: readonly SidebarSortOption[] = [
  'none',
  'name-asc',
  'name-desc',
  'count-asc',
  'count-desc',
] as const

function parseSidebarSortOption(value: unknown, fallback: SidebarSortOption): SidebarSortOption {
  return typeof value === 'string' && (SIDEBAR_SORT_OPTIONS as readonly string[]).includes(value)
    ? (value as SidebarSortOption)
    : fallback
}

export type ShortcutCategory = 'General' | 'View' | 'Navigation' | 'Entities' | 'Tabs'

/** Single key combination (key + modifiers) */
export type KeyCombo = {
  key: string
  modifiers: {
    meta?: boolean
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
  }
}

export type KeyboardShortcut = {
  id: string
  label: string
  key: string
  modifiers: {
    meta?: boolean
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
  }
  /**
   * When set, this shortcut is a chord (VSCode-style): user presses first key, then second key.
   * When chord is defined, key+modifiers are ignored for matching; chord[0] is the first part, chord[1] the second.
   */
  chord?: [KeyCombo, KeyCombo]
  enabled: boolean
  category: ShortcutCategory
}

export type DataclassCustomization = {
  /** Lucide icon name (e.g. "Users") or an emoji (e.g. "🚀"). */
  icon?: string
  /** Preset color name (e.g. "blue") or a hex color (e.g. "#7D3C98"). */
  color?: string
  description?: string // Custom description
  position?: { x: number; y: number } // Position in graph view
}

// Available color presets (ring + tint for icons view selected state; /10 /20 = opacity)
// nameKey: i18n key for display name (use t(nameKey) in UI)
export const COLOR_PRESETS = {
  default: {
    name: 'Default',
    nameKey: 'settings.colors.default',
    class: 'text-primary',
    bg: 'bg-primary',
    ring: 'ring-primary',
    bgTint: 'bg-primary/10',
    bgTintStrong: 'bg-primary/20',
  },
  red: {
    name: 'Red',
    nameKey: 'settings.colors.red',
    class: 'text-red-500',
    bg: 'bg-red-500',
    ring: 'ring-red-500',
    bgTint: 'bg-red-500/10',
    bgTintStrong: 'bg-red-500/20',
  },
  orange: {
    name: 'Orange',
    nameKey: 'settings.colors.orange',
    class: 'text-orange-500',
    bg: 'bg-orange-500',
    ring: 'ring-orange-500',
    bgTint: 'bg-orange-500/10',
    bgTintStrong: 'bg-orange-500/20',
  },
  amber: {
    name: 'Amber',
    nameKey: 'settings.colors.amber',
    class: 'text-amber-500',
    bg: 'bg-amber-500',
    ring: 'ring-amber-500',
    bgTint: 'bg-amber-500/10',
    bgTintStrong: 'bg-amber-500/20',
  },
  yellow: {
    name: 'Yellow',
    nameKey: 'settings.colors.yellow',
    class: 'text-yellow-500',
    bg: 'bg-yellow-500',
    ring: 'ring-yellow-500',
    bgTint: 'bg-yellow-500/10',
    bgTintStrong: 'bg-yellow-500/20',
  },
  lime: {
    name: 'Lime',
    nameKey: 'settings.colors.lime',
    class: 'text-lime-500',
    bg: 'bg-lime-500',
    ring: 'ring-lime-500',
    bgTint: 'bg-lime-500/10',
    bgTintStrong: 'bg-lime-500/20',
  },
  green: {
    name: 'Green',
    nameKey: 'settings.colors.green',
    class: 'text-green-500',
    bg: 'bg-green-500',
    ring: 'ring-green-500',
    bgTint: 'bg-green-500/10',
    bgTintStrong: 'bg-green-500/20',
  },
  emerald: {
    name: 'Emerald',
    nameKey: 'settings.colors.emerald',
    class: 'text-emerald-500',
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    bgTint: 'bg-emerald-500/10',
    bgTintStrong: 'bg-emerald-500/20',
  },
  teal: {
    name: 'Teal',
    nameKey: 'settings.colors.teal',
    class: 'text-teal-500',
    bg: 'bg-teal-500',
    ring: 'ring-teal-500',
    bgTint: 'bg-teal-500/10',
    bgTintStrong: 'bg-teal-500/20',
  },
  cyan: {
    name: 'Cyan',
    nameKey: 'settings.colors.cyan',
    class: 'text-cyan-500',
    bg: 'bg-cyan-500',
    ring: 'ring-cyan-500',
    bgTint: 'bg-cyan-500/10',
    bgTintStrong: 'bg-cyan-500/20',
  },
  blue: {
    name: 'Blue',
    nameKey: 'settings.colors.blue',
    class: 'text-blue-500',
    bg: 'bg-blue-500',
    ring: 'ring-blue-500',
    bgTint: 'bg-blue-500/10',
    bgTintStrong: 'bg-blue-500/20',
  },
  indigo: {
    name: 'Indigo',
    nameKey: 'settings.colors.indigo',
    class: 'text-indigo-500',
    bg: 'bg-indigo-500',
    ring: 'ring-indigo-500',
    bgTint: 'bg-indigo-500/10',
    bgTintStrong: 'bg-indigo-500/20',
  },
  violet: {
    name: 'Violet',
    nameKey: 'settings.colors.violet',
    class: 'text-violet-500',
    bg: 'bg-violet-500',
    ring: 'ring-violet-500',
    bgTint: 'bg-violet-500/10',
    bgTintStrong: 'bg-violet-500/20',
  },
  purple: {
    name: 'Purple',
    nameKey: 'settings.colors.purple',
    class: 'text-purple-500',
    bg: 'bg-purple-500',
    ring: 'ring-purple-500',
    bgTint: 'bg-purple-500/10',
    bgTintStrong: 'bg-purple-500/20',
  },
  pink: {
    name: 'Pink',
    nameKey: 'settings.colors.pink',
    class: 'text-pink-500',
    bg: 'bg-pink-500',
    ring: 'ring-pink-500',
    bgTint: 'bg-pink-500/10',
    bgTintStrong: 'bg-pink-500/20',
  },
  rose: {
    name: 'Rose',
    nameKey: 'settings.colors.rose',
    class: 'text-rose-500',
    bg: 'bg-rose-500',
    ring: 'ring-rose-500',
    bgTint: 'bg-rose-500/10',
    bgTintStrong: 'bg-rose-500/20',
  },
} as const

export type ColorPreset = keyof typeof COLOR_PRESETS

/**
 * Curated icons shown first in pickers when not searching.
 * Names must exist in lucide-react's `icons` registry.
 */
export const FEATURED_ICON_PRESETS = [
  'Database',
  'Table2',
  'Users',
  'User',
  'CircleUser',
  'ShoppingCart',
  'Package',
  'FileText',
  'File',
  'Folder',
  'Image',
  'Calendar',
  'Clock',
  'Mail',
  'MessageSquare',
  'Settings',
  'Star',
  'Heart',
  'Bookmark',
  'Tag',
  'Flag',
  'MapPin',
  'Globe',
  'Link2',
  'Key',
  'Lock',
  'Shield',
  'CreditCard',
  'DollarSign',
  'Percent',
  'TrendingUp',
  'ChartBar',
  'ChartPie',
  'Activity',
  'Zap',
  'Truck',
  'House',
  'Building2',
  'Briefcase',
  'GraduationCap',
  'Award',
  'Gift',
  'Phone',
  'Smartphone',
  'Monitor',
  'Laptop',
  'Server',
  'Cpu',
  'HardDrive',
  'Cloud',
  'UserRound',
  'CircleUserRound',
  'Baby',
  'Stethoscope',
  'Scale',
  'UtensilsCrossed',
  'Wrench',
  'Syringe',
  'Landmark',
  'Code',
  'Microscope',
  'Plane',
  'Car',
  'Paintbrush',
] as const

const featuredIconSet = new Set<string>(FEATURED_ICON_PRESETS)

/**
 * Every Lucide icon from the `icons` registry (featured first, then A-Z).
 * Built from lucide-react so the catalog stays in sync with the installed version.
 */
export const ICON_PRESETS: readonly string[] = (() => {
  const rest = Object.keys(icons)
    .filter((name) => !featuredIconSet.has(name))
    .sort((a, b) => a.localeCompare(b))
  return [...FEATURED_ICON_PRESETS, ...rest]
})()

// =============================================================================
// Shortcut Presets
// =============================================================================

export type ShortcutPresetId = 'default' | 'vscode' | 'minimal' | 'vim'

export type ShortcutPresetInfo = {
  id: ShortcutPresetId
  name: string
  description: string
  /** i18n key for display name (use t(nameKey) in UI) */
  nameKey: string
  /** i18n key for description (use t(descriptionKey) in UI) */
  descriptionKey: string
}

export const SHORTCUT_PRESETS: ShortcutPresetInfo[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard keyboard shortcuts',
    nameKey: 'preset.default',
    descriptionKey: 'preset.defaultDescription',
  },
  {
    id: 'vscode',
    name: 'VS Code',
    description: 'VS Code-like shortcuts',
    nameKey: 'preset.vscode',
    descriptionKey: 'preset.vscodeDescription',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Only essential shortcuts',
    nameKey: 'preset.minimal',
    descriptionKey: 'preset.minimalDescription',
  },
  {
    id: 'vim',
    name: 'Vim-like',
    description: 'Vim-inspired navigation',
    nameKey: 'preset.vim',
    descriptionKey: 'preset.vimDescription',
  },
]

/** Id of the default profile (cannot be removed) */
export const DEFAULT_PROFILE_ID = 'default'

/** UI language (persisted per profile) */
export type Language = 'en' | 'fr' | 'es'

/** Settings snapshot stored in a profile (prefs + base settings + shortcuts + dataclass customizations) */
export type ProfileSettings = {
  version: number
  theme: ProfilePrefs['theme']
  themeName: ProfilePrefs['themeName']
  panels: ProfilePrefs['panels']
  recentCommands: ProfilePrefs['recentCommands']
  language: Language
  readonlyMode: boolean
  /** When true, disconnect asks for confirmation first. */
  confirmDisconnect: boolean
  sidebarCollapsed: boolean
  assistantOpen: boolean
  consoleOpen: boolean
  /** Active tab inside the bottom dock when `consoleOpen` is true. */
  bottomPanelTab: 'console' | 'terminal'
  defaultViewMode: DefaultViewMode
  defaultEntityViewMode: EntityViewMode
  defaultEditMode: EditMode
  sidebarViewMode: SidebarViewMode
  sidebarSortOption: SidebarSortOption
  pageSize: number
  defaultQueryRunMode: DefaultQueryRunMode
  shortcuts: KeyboardShortcut[]
  activeShortcutPreset: ShortcutPresetId | 'custom'
  codeEditorPrefs: EditorPrefs
  dataclassCustomizations: Record<string, DataclassCustomization>
  assistantDisabledNamespaces: AssistantToolNamespace[]
  assistantDisabledTools: string[]
  /** Built-in widget types disabled for this profile (empty = all enabled). */
  disabledWidgetTypes: string[]
}

export type Profile = {
  id: string
  name: string
  icon?: string // Lucide icon name
  color?: string // Color preset key
  settings: ProfileSettings
}

export type SettingsState = {
  // Prefs (theme, panels, recentCommands, language) - current profile
  version: number
  theme: ProfilePrefs['theme']
  themeName: ProfilePrefs['themeName']
  panels: ProfilePrefs['panels']
  recentCommands: ProfilePrefs['recentCommands']
  language: Language

  // Readonly mode - disables all write operations
  readonlyMode: boolean

  // Confirm before disconnecting (desktop connection menu)
  confirmDisconnect: boolean

  // Sidebar collapsed state
  sidebarCollapsed: boolean

  // Assistant chatbot open state
  assistantOpen: boolean

  // Bottom console panel open state
  consoleOpen: boolean

  /** Active tab inside the bottom dock (`console` | `terminal`). */
  bottomPanelTab: 'console' | 'terminal'

  // Default view mode for entity lists
  defaultViewMode: DefaultViewMode

  // Default entity viewer mode
  defaultEntityViewMode: EntityViewMode

  // Default edit mode (form or json)
  defaultEditMode: EditMode

  // Sidebar view mode (cards or tables)
  sidebarViewMode: SidebarViewMode

  // Sidebar dataclass list sort order
  sidebarSortOption: SidebarSortOption

  // Page size for entity pagination
  pageSize: number

  // Default query builder Run button / ⌘↵ behavior
  defaultQueryRunMode: DefaultQueryRunMode

  // Keyboard shortcuts
  shortcuts: KeyboardShortcut[]

  // Active shortcut preset (for UI display)
  activeShortcutPreset: ShortcutPresetId | 'custom'

  // Code editor toolbar prefs (zoom, word wrap, minimap, toolbar position)
  codeEditorPrefs: EditorPrefs

  // Dataclass customizations (icon, color, description)
  dataclassCustomizations: Record<string, DataclassCustomization>

  // Assistant tool preferences
  assistantDisabledNamespaces: AssistantToolNamespace[]
  assistantDisabledTools: string[]

  // Built-in widget catalog preferences (profile-scoped)
  disabledWidgetTypes: string[]

  // Profiles
  profiles: Profile[]
  currentProfileId: string

  // Actions
  setLanguage: (language: Language) => void
  setReadonlyMode: (readonly: boolean) => void
  toggleReadonlyMode: () => void
  setConfirmDisconnect: (confirm: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
  setAssistantOpen: (open: boolean) => void
  toggleAssistantOpen: () => void
  setConsoleOpen: (open: boolean) => void
  toggleConsoleOpen: () => void
  setBottomPanelTab: (tab: 'console' | 'terminal') => void
  toggleTerminalOpen: () => void
  setDefaultViewMode: (mode: DefaultViewMode) => void
  setDefaultEntityViewMode: (mode: EntityViewMode) => void
  setDefaultEditMode: (mode: EditMode) => void
  setSidebarViewMode: (mode: SidebarViewMode) => void
  setSidebarSortOption: (option: SidebarSortOption) => void
  setPageSize: (size: number) => void
  setDefaultQueryRunMode: (mode: DefaultQueryRunMode) => void
  updateShortcut: (id: string, updates: Partial<Omit<KeyboardShortcut, 'id' | 'label'>>) => void
  setAllShortcutsEnabled: (enabled: boolean) => void
  setCategoryShortcutsEnabled: (category: ShortcutCategory, enabled: boolean) => void
  applyShortcutPreset: (presetId: ShortcutPresetId) => void
  resetShortcuts: () => void
  /** Fill in any DEFAULT_SHORTCUTS ids missing from the current profile. */
  syncShortcutsWithDefaults: () => void
  resetAllSettings: () => void
  updateCodeEditorPrefs: (partial: Partial<EditorPrefs>) => void

  // Dataclass customization actions
  setDataclassCustomization: (dataclassName: string, customization: DataclassCustomization) => void
  setDataclassCustomizations: (updates: Record<string, DataclassCustomization>) => void
  setDataclassPositions: (positions: Record<string, { x: number; y: number }>) => void
  removeDataclassCustomization: (dataclassName: string) => void
  resetDataclassCustomizations: () => void

  // Profile actions
  addProfile: (name: string) => void
  duplicateProfile: (id: string) => void
  removeProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void
  updateProfileAppearance: (id: string, updates: { icon?: string; color?: string }) => void
  switchProfile: (id: string) => void

  // Export/Import
  exportSettings: () => string
  importSettings: (json: string) => boolean
  /** Export one, some, or all profiles as JSON. ids = undefined means all. */
  exportProfiles: (ids?: string[]) => string
  /** Import profiles from JSON (adds to list or imports into current if legacy format). */
  importProfiles: (json: string) => { ok: boolean; importedCount?: number }
  /** Parse an import file and return list of profiles with overwrite flags (for import modal). */
  parseImportProfiles: (json: string) => ParseImportProfilesResult
  /** Import only the selected profile ids from JSON; overwrites existing profiles with same id. */
  importProfilesByIds: (json: string, ids: string[]) => { ok: boolean; importedCount?: number }

  // Assistant tool preference actions
  getAssistantToolPrefs: () => AssistantToolPrefs
  setAssistantToolEnabled: (name: string, enabled: boolean) => void
  setAssistantNamespaceToolsEnabled: (namespace: AssistantToolNamespace, enabled: boolean) => void
  setAllAssistantToolsEnabled: (enabled: boolean) => void
  applyAssistantToolPattern: (pattern: string, enabled: boolean) => boolean

  // Widget catalog preference actions
  setWidgetTypeEnabled: (widgetType: string, enabled: boolean) => void
  setAllWidgetTypesEnabled: (enabled: boolean, allTypes: readonly string[]) => void
  restoreBuiltinWidgets: () => void
}

/** Result of parsing a profiles import file (for import selection modal). */
export type ParseImportProfilesResult =
  | { ok: false }
  | { ok: true; legacy: true }
  | {
      ok: true
      profiles: Array<{ id: string; name: string; willOverwrite: boolean }>
    }

// =============================================================================
// Default Values
// =============================================================================
// Shortcuts avoid browser-reserved keys that preventDefault() cannot override
// (e.g. Ctrl+Tab, Ctrl+W, Ctrl+R, Ctrl+Shift+T, Ctrl+1..9, Ctrl+ArrowLeft/Right).

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // General
  {
    id: 'command-palette',
    label: 'Open Command Palette',
    key: 'p',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'General',
  },
  {
    id: 'search-dataclasses',
    label: 'Search Dataclasses',
    key: 'k',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'p', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'show-shortcuts',
    label: 'Show Keyboard Shortcuts',
    key: '?',
    modifiers: {},
    chord: chord('k', getPlatformModifier(), 'h', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    key: ',',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), ',', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-readonly',
    label: 'Toggle Read-only Mode',
    key: 'r',
    modifiers: { ...getPlatformModifier(), shift: true },
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-assistant',
    label: 'Toggle Assistant',
    key: 'a',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'General',
  },

  // View
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    key: 'b',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'b', getPlatformModifier()),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-console',
    label: 'Toggle Console',
    key: '`',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal',
    key: 'j',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    key: 'd',
    modifiers: { ...getPlatformModifier(), shift: true },
    chord: chord('k', getPlatformModifier(), 'd', getPlatformModifier()),
    enabled: true,
    category: 'View',
  },
  {
    id: 'view-cards',
    label: 'Card View',
    key: '1',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'view-table',
    label: 'Table View',
    key: '2',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },

  // Navigation
  {
    id: 'open-home',
    label: 'Open Home',
    key: 'h',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-structure',
    label: 'Display Structure',
    key: 's',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-assistant-metadata',
    label: 'Assistant Metadata Editor',
    key: 'm',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'nav-prev',
    label: 'Previous Entity',
    key: 'ArrowUp',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'nav-next',
    label: 'Next Entity',
    key: 'ArrowDown',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-first',
    label: 'First Page',
    key: 'PageUp',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-prev',
    label: 'Previous Page',
    key: 'ArrowLeft',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-next',
    label: 'Next Page',
    key: 'ArrowRight',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-last',
    label: 'Last Page',
    key: 'PageDown',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },

  // Entities
  {
    id: 'refresh',
    label: 'Refresh',
    key: 'r',
    modifiers: getPlatformModifierWith({ alt: true }),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'new-entity',
    label: 'New Entity',
    key: 'n',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'edit-entity',
    label: 'Edit Entity',
    key: 'e',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'save-entity',
    label: 'Save Entity',
    key: 's',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'cancel-edit',
    label: 'Cancel Edit',
    key: 'Escape',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'duplicate-entity',
    label: 'Duplicate Entity',
    key: 'd',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'delete-entity',
    label: 'Delete Entity',
    key: 'Delete',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'go-to-entity',
    label: 'Go to Entity',
    key: 'g',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'open-dataclass-select',
    label: 'Open Dataclass Select',
    key: 'g',
    modifiers: { ...getPlatformModifier(), shift: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-dataclass-data',
    label: 'Open Dataclass Data',
    key: 'o',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'switch-tabs',
    label: 'Switch Tabs',
    key: 't',
    modifiers: getSwitchTabsModifier(),
    enabled: true,
    category: 'Tabs',
  },

  // Tabs (Ctrl+Alt+W to avoid browser Cmd+W/Ctrl+W and Alt+W dead keys)
  {
    id: 'close-tab',
    label: 'Close Tab',
    key: 'w',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'pin-tab',
    label: 'Pin/Unpin Tab',
    key: 'p',
    modifiers: { ...getPlatformModifier(), shift: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-next',
    label: 'Next Tab',
    key: 'ArrowRight',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-prev',
    label: 'Previous Tab',
    key: 'ArrowLeft',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    id: `tab-${n}` as const,
    label: `Switch to Tab ${n}`,
    key: String(n),
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs' as const,
  })),
]

// VS Code-like shortcuts preset (chords: Ctrl+K then key, like VS Code)
const VSCODE_SHORTCUTS: KeyboardShortcut[] = [
  // General - VS Code uses Ctrl+Shift+P for command palette
  {
    id: 'command-palette',
    label: 'Open Command Palette',
    key: 'p',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'General',
  },
  {
    id: 'search-dataclasses',
    label: 'Search Dataclasses',
    key: 'p',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'p', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'show-shortcuts',
    label: 'Show Keyboard Shortcuts',
    key: 'k',
    modifiers: getPlatformModifierWith({ shift: true }),
    chord: chord('k', getPlatformModifier(), 'h', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    key: ',',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), ',', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-readonly',
    label: 'Toggle Read-only Mode',
    key: 'r',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-assistant',
    label: 'Toggle Assistant',
    key: 'a',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'a', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },

  // View
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    key: 'b',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'b', getPlatformModifier()),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-console',
    label: 'Toggle Console',
    key: '`',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal',
    key: 'j',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    key: 'k',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'd', getPlatformModifier()),
    enabled: true,
    category: 'View',
  },
  {
    id: 'view-cards',
    label: 'Card View',
    key: '1',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'view-table',
    label: 'Table View',
    key: '2',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },

  // Navigation
  {
    id: 'open-home',
    label: 'Open Home',
    key: 'h',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-structure',
    label: 'Display Structure',
    key: 's',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-assistant-metadata',
    label: 'Assistant Metadata Editor',
    key: 'm',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'nav-prev',
    label: 'Previous Entity',
    key: 'ArrowUp',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'nav-next',
    label: 'Next Entity',
    key: 'ArrowDown',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-first',
    label: 'First Page',
    key: 'PageUp',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-prev',
    label: 'Previous Page',
    key: 'ArrowLeft',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-next',
    label: 'Next Page',
    key: 'ArrowRight',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-last',
    label: 'Last Page',
    key: 'PageDown',
    modifiers: { alt: true },
    enabled: true,
    category: 'Navigation',
  },

  // Entities
  {
    id: 'refresh',
    label: 'Refresh',
    key: 'r',
    modifiers: getPlatformModifierWith({ alt: true }),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'new-entity',
    label: 'New Entity',
    key: 'n',
    modifiers: getPlatformModifierWith({ alt: true }),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'edit-entity',
    label: 'Edit Entity',
    key: 'Enter',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'save-entity',
    label: 'Save Entity',
    key: 's',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'cancel-edit',
    label: 'Cancel Edit',
    key: 'Escape',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'duplicate-entity',
    label: 'Duplicate Entity',
    key: 'd',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'delete-entity',
    label: 'Delete Entity',
    key: 'Backspace',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'go-to-entity',
    label: 'Go to Entity',
    key: 'g',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'open-dataclass-select',
    label: 'Open Dataclass Select',
    key: 'g',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-dataclass-data',
    label: 'Open Dataclass Data',
    key: 'o',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'switch-tabs',
    label: 'Switch Tabs',
    key: 't',
    modifiers: getSwitchTabsModifier(),
    enabled: true,
    category: 'Tabs',
  },

  // Tabs (Ctrl+Alt+W to avoid browser Cmd+W/Ctrl+W and Alt+W dead keys)
  {
    id: 'close-tab',
    label: 'Close Tab',
    key: 'w',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'pin-tab',
    label: 'Pin/Unpin Tab',
    key: 'Enter',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-next',
    label: 'Next Tab',
    key: 'ArrowRight',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-prev',
    label: 'Previous Tab',
    key: 'ArrowLeft',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    id: `tab-${n}` as const,
    label: `Switch to Tab ${n}`,
    key: String(n),
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs' as const,
  })),
]

// Minimal shortcuts preset - only essential shortcuts (chords to avoid conflicts)
const MINIMAL_SHORTCUTS: KeyboardShortcut[] = [
  // General - command palette and settings as chords
  {
    id: 'command-palette',
    label: 'Open Command Palette',
    key: 'p',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'p', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'search-dataclasses',
    label: 'Search Dataclasses',
    key: 'k',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 's', getPlatformModifier()),
    enabled: false,
    category: 'General',
  },
  {
    id: 'show-shortcuts',
    label: 'Show Keyboard Shortcuts',
    key: '?',
    modifiers: {},
    chord: chord('k', getPlatformModifier(), 'h', getPlatformModifier()),
    enabled: false,
    category: 'General',
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    key: ',',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), ',', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-readonly',
    label: 'Toggle Read-only Mode',
    key: 'r',
    modifiers: { ...getPlatformModifier(), shift: true },
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-assistant',
    label: 'Toggle Assistant',
    key: 'a',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'a', getPlatformModifier()),
    enabled: true,
    category: 'General',
  },

  // View - all disabled
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    key: 'b',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 'b', getPlatformModifier()),
    enabled: false,
    category: 'View',
  },
  {
    id: 'toggle-console',
    label: 'Toggle Console',
    key: '`',
    modifiers: getPlatformModifier(),
    enabled: false,
    category: 'View',
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal',
    key: 'j',
    modifiers: getPlatformModifier(),
    enabled: false,
    category: 'View',
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    key: 'd',
    modifiers: getPlatformModifierWith({ shift: true }),
    chord: chord('k', getPlatformModifier(), 'd', getPlatformModifier()),
    enabled: false,
    category: 'View',
  },
  {
    id: 'view-cards',
    label: 'Card View',
    key: '1',
    modifiers: getPlatformModifier(),
    enabled: false,
    category: 'View',
  },
  {
    id: 'view-table',
    label: 'Table View',
    key: '2',
    modifiers: getPlatformModifier(),
    enabled: false,
    category: 'View',
  },

  // Navigation - disabled
  {
    id: 'open-home',
    label: 'Open Home',
    key: 'h',
    modifiers: getPlatformModifier(),
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'open-structure',
    label: 'Display Structure',
    key: 's',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'open-assistant-metadata',
    label: 'Assistant Metadata Editor',
    key: 'm',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'nav-prev',
    label: 'Previous Entity',
    key: 'ArrowUp',
    modifiers: {},
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'nav-next',
    label: 'Next Entity',
    key: 'ArrowDown',
    modifiers: {},
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'page-first',
    label: 'First Page',
    key: 'PageUp',
    modifiers: { alt: true },
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'page-prev',
    label: 'Previous Page',
    key: 'ArrowLeft',
    modifiers: {},
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'page-next',
    label: 'Next Page',
    key: 'ArrowRight',
    modifiers: {},
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'page-last',
    label: 'Last Page',
    key: 'PageDown',
    modifiers: { alt: true },
    enabled: false,
    category: 'Navigation',
  },

  // Entities - only save and cancel
  {
    id: 'refresh',
    label: 'Refresh',
    key: 'r',
    modifiers: getPlatformModifierWith({ alt: true }),
    enabled: false,
    category: 'Entities',
  },
  {
    id: 'new-entity',
    label: 'New Entity',
    key: 'n',
    modifiers: {},
    enabled: false,
    category: 'Entities',
  },
  {
    id: 'edit-entity',
    label: 'Edit Entity',
    key: 'e',
    modifiers: {},
    enabled: false,
    category: 'Entities',
  },
  {
    id: 'save-entity',
    label: 'Save Entity',
    key: 's',
    modifiers: getPlatformModifier(),
    chord: chord('k', getPlatformModifier(), 's', getPlatformModifier()),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'cancel-edit',
    label: 'Cancel Edit',
    key: 'Escape',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'duplicate-entity',
    label: 'Duplicate Entity',
    key: 'd',
    modifiers: {},
    enabled: false,
    category: 'Entities',
  },
  {
    id: 'delete-entity',
    label: 'Delete Entity',
    key: 'Delete',
    modifiers: {},
    enabled: false,
    category: 'Entities',
  },
  {
    id: 'go-to-entity',
    label: 'Go to Entity',
    key: 'g',
    modifiers: getPlatformModifier(),
    enabled: false,
    category: 'Entities',
  },
  {
    id: 'open-dataclass-select',
    label: 'Open Dataclass Select',
    key: 'g',
    modifiers: { ...getPlatformModifier(), shift: true },
    enabled: false,
    category: 'Navigation',
  },
  {
    id: 'open-dataclass-data',
    label: 'Open Dataclass Data',
    key: 'o',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'switch-tabs',
    label: 'Switch Tabs',
    key: 't',
    modifiers: getSwitchTabsModifier(),
    enabled: true,
    category: 'Tabs',
  },

  // Tabs - only close (Ctrl+Alt+W to avoid browser and Alt+W dead keys)
  {
    id: 'close-tab',
    label: 'Close Tab',
    key: 'w',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'pin-tab',
    label: 'Pin/Unpin Tab',
    key: 'p',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: false,
    category: 'Tabs',
  },
  {
    id: 'tab-next',
    label: 'Next Tab',
    key: 'ArrowRight',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-prev',
    label: 'Previous Tab',
    key: 'ArrowLeft',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    id: `tab-${n}` as const,
    label: `Switch to Tab ${n}`,
    key: String(n),
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs' as const,
  })),
]

// Vim-like shortcuts preset (leader-style chords: Space then key)
const VIM_SHORTCUTS: KeyboardShortcut[] = [
  // General
  {
    id: 'command-palette',
    label: 'Open Command Palette',
    key: ':',
    modifiers: { shift: true },
    enabled: true,
    category: 'General',
  },
  {
    id: 'search-dataclasses',
    label: 'Search Dataclasses',
    key: '/',
    modifiers: {},
    chord: chord(' ', {}, '/', {}),
    enabled: true,
    category: 'General',
  },
  {
    id: 'show-shortcuts',
    label: 'Show Keyboard Shortcuts',
    key: '?',
    modifiers: {},
    chord: chord(' ', {}, '?', {}),
    enabled: true,
    category: 'General',
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    key: ',',
    modifiers: getPlatformModifier(),
    chord: chord(' ', {}, ',', {}),
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-readonly',
    label: 'Toggle Read-only Mode',
    key: 'r',
    modifiers: { ...getPlatformModifier(), shift: true },
    enabled: true,
    category: 'General',
  },
  {
    id: 'toggle-assistant',
    label: 'Toggle Assistant',
    key: 'a',
    modifiers: {},
    chord: chord(' ', {}, 'a', {}),
    enabled: true,
    category: 'General',
  },

  // View - leader chords for sidebar/theme
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    key: 'b',
    modifiers: { ctrl: true },
    chord: chord(' ', {}, 'b', {}),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-console',
    label: 'Toggle Console',
    key: '`',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal',
    key: 'j',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'View',
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    key: 't',
    modifiers: getPlatformModifierWith({ shift: true }),
    chord: chord(' ', {}, 't', {}),
    enabled: true,
    category: 'View',
  },
  {
    id: 'view-cards',
    label: 'Card View',
    key: 'g',
    modifiers: {},
    enabled: true,
    category: 'View',
  },
  {
    id: 'view-table',
    label: 'Table View',
    key: 'l',
    modifiers: {},
    enabled: true,
    category: 'View',
  },

  // Navigation - Vim j/k for up/down
  {
    id: 'open-home',
    label: 'Open Home',
    key: 'g',
    modifiers: { shift: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-structure',
    label: 'Display Structure',
    key: 's',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-assistant-metadata',
    label: 'Assistant Metadata Editor',
    key: 'm',
    modifiers: getPlatformModifierWith({ shift: true }),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'nav-prev',
    label: 'Previous Entity',
    key: 'k',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'nav-next',
    label: 'Next Entity',
    key: 'j',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-first',
    label: 'First Page',
    key: 'g',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-prev',
    label: 'Previous Page',
    key: 'h',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-next',
    label: 'Next Page',
    key: 'l',
    modifiers: {},
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'page-last',
    label: 'Last Page',
    key: 'G',
    modifiers: { shift: true },
    enabled: true,
    category: 'Navigation',
  },

  // Entities
  {
    id: 'refresh',
    label: 'Refresh',
    key: 'r',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'new-entity',
    label: 'New Entity',
    key: 'o',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'edit-entity',
    label: 'Edit Entity',
    key: 'i',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'save-entity',
    label: 'Save Entity',
    key: 's',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'cancel-edit',
    label: 'Cancel Edit',
    key: 'Escape',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'duplicate-entity',
    label: 'Duplicate Entity',
    key: 'y',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'delete-entity',
    label: 'Delete Entity',
    key: 'd',
    modifiers: {},
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'go-to-entity',
    label: 'Go to Entity',
    key: 'G',
    modifiers: { shift: true },
    enabled: true,
    category: 'Entities',
  },
  {
    id: 'open-dataclass-select',
    label: 'Open Dataclass Select',
    key: '>',
    modifiers: { shift: true },
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'open-dataclass-data',
    label: 'Open Dataclass Data',
    key: 'o',
    modifiers: getPlatformModifier(),
    enabled: true,
    category: 'Navigation',
  },
  {
    id: 'switch-tabs',
    label: 'Switch Tabs',
    key: 't',
    modifiers: getSwitchTabsModifier(),
    enabled: true,
    category: 'Tabs',
  },

  // Tabs
  {
    id: 'close-tab',
    label: 'Close Tab',
    key: 'x',
    modifiers: {},
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'pin-tab',
    label: 'Pin/Unpin Tab',
    key: 'm',
    modifiers: {},
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-next',
    label: 'Next Tab',
    key: 'ArrowRight',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  {
    id: 'tab-prev',
    label: 'Previous Tab',
    key: 'ArrowLeft',
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs',
  },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => ({
    id: `tab-${n}` as const,
    label: `Switch to Tab ${n}`,
    key: String(n),
    modifiers: { ctrl: true, alt: true },
    enabled: true,
    category: 'Tabs' as const,
  })),
]

/**
 * Merge persisted shortcuts with defaults; treats missing or empty arrays as "use defaults".
 * Always returns every DEFAULT_SHORTCUTS id so newly added actions (e.g. toggle-terminal)
 * remain visible and customizable after import / profile restore.
 */
export function mergeShortcutsWithDefaults(shortcuts?: KeyboardShortcut[]): KeyboardShortcut[] {
  const persistedShortcuts = shortcuts ?? []
  return DEFAULT_SHORTCUTS.map((defaultShortcut) => {
    const persistedShortcut = persistedShortcuts.find((s) => s.id === defaultShortcut.id)
    if (persistedShortcut) {
      return {
        ...defaultShortcut,
        ...persistedShortcut,
        // Keep registry category/label as source of truth; persist only keybinding prefs.
        id: defaultShortcut.id,
        label: defaultShortcut.label,
        category: defaultShortcut.category,
      }
    }
    return { ...defaultShortcut }
  })
}

function profileSettingsForStore(
  settings: ProfileSettings
): Omit<ProfileSettings, 'dataclassCustomizations'> {
  const { dataclassCustomizations: _, ...rest } = settings
  return {
    ...rest,
    shortcuts: mergeShortcutsWithDefaults(settings.shortcuts),
  }
}

// Map preset IDs to their shortcuts
const PRESET_SHORTCUTS: Record<ShortcutPresetId, KeyboardShortcut[]> = {
  default: DEFAULT_SHORTCUTS,
  vscode: VSCODE_SHORTCUTS,
  minimal: MINIMAL_SHORTCUTS,
  vim: VIM_SHORTCUTS,
}

/**
 * Get the shortcuts for a specific preset
 */
export function getPresetShortcuts(presetId: ShortcutPresetId): KeyboardShortcut[] {
  return PRESET_SHORTCUTS[presetId] ?? DEFAULT_SHORTCUTS
}

/** Format a single key combo for display (exported for chord buffer UI) */
export function formatKeyCombo(combo: KeyCombo): string {
  const modifiers: string[] = []
  if (combo.modifiers.ctrl) modifiers.push(isMacOS() ? '⌃' : 'Ctrl')
  if (combo.modifiers.alt) modifiers.push(isMacOS() ? '⌥' : 'Alt')
  if (combo.modifiers.shift) modifiers.push(isMacOS() ? '⇧' : 'Shift')
  if (combo.modifiers.meta) modifiers.push(isMacOS() ? '⌘' : 'Ctrl')
  const keyMap: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    PageUp: 'PgUp',
    PageDown: 'PgDn',
    ' ': '␣',
    Space: '␣',
    Enter: '↵',
    Escape: 'Esc',
    Backspace: '⌫',
    Delete: '⌦',
    Tab: '⇥',
    '`': '`',
    '>': '>',
    '.': '.',
  }
  const displayKey = keyMap[combo.key] || combo.key.toUpperCase()
  if (modifiers.length > 0) return [...modifiers, displayKey].join(' ')
  return displayKey
}

// Helper to format a shortcut for display
export function formatShortcut(s: KeyboardShortcut): string {
  if (s.chord && s.chord.length === 2) {
    return `${formatKeyCombo(s.chord[0])} ${formatKeyCombo(s.chord[1])}`
  }
  return formatKeyCombo({ key: s.key, modifiers: s.modifiers })
}

// Get shortcut by ID (non-hook version for use outside components)
export function getShortcutById(
  shortcuts: KeyboardShortcut[],
  id: string
): KeyboardShortcut | undefined {
  return shortcuts.find((s) => s.id === id)
}

const DEFAULT_SETTINGS: ProfileSettings = {
  version: DEFAULT_PROFILE_PREFS.version,
  theme: DEFAULT_PROFILE_PREFS.theme,
  themeName: DEFAULT_PROFILE_PREFS.themeName,
  panels: { ...DEFAULT_PROFILE_PREFS.panels },
  recentCommands: [],
  language: 'en',
  readonlyMode: false,
  confirmDisconnect: true,
  sidebarCollapsed: false,
  assistantOpen: false,
  consoleOpen: false,
  bottomPanelTab: 'console' as const,
  defaultViewMode: 'cards' as DefaultViewMode,
  defaultEntityViewMode: 'form' as EntityViewMode,
  defaultEditMode: 'form' as EditMode,
  sidebarViewMode: 'cards' as SidebarViewMode,
  sidebarSortOption: 'name-asc' as SidebarSortOption,
  pageSize: 50,
  defaultQueryRunMode: 'run' as DefaultQueryRunMode,
  shortcuts: DEFAULT_SHORTCUTS,
  activeShortcutPreset: 'default' as ShortcutPresetId | 'custom',
  codeEditorPrefs: { ...DEFAULT_EDITOR_PREFS },
  dataclassCustomizations: {} as Record<string, DataclassCustomization>,
  assistantDisabledNamespaces: [] as AssistantToolNamespace[],
  assistantDisabledTools: [] as string[],
  disabledWidgetTypes: [] as string[],
}

/** Normalize a raw profile from JSON into a Profile (same id, merged shortcuts and defaults). */
function normalizeImportedProfile(
  raw: {
    id?: string
    name?: string
    icon?: string
    color?: string
    settings?: Record<string, unknown>
  },
  id: string
): Profile {
  const name = raw?.name && typeof raw.name === 'string' ? raw.name : 'Imported'
  const icon = typeof raw?.icon === 'string' ? raw.icon : undefined
  const color = typeof raw?.color === 'string' ? raw.color : undefined
  const s = raw?.settings && typeof raw.settings === 'object' ? raw.settings : {}
  const mergedShortcuts = mergeShortcutsWithDefaults(s.shortcuts as KeyboardShortcut[] | undefined)
  const version = typeof s.version === 'number' ? s.version : DEFAULT_SETTINGS.version
  const theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : DEFAULT_SETTINGS.theme
  const themeName = typeof s.themeName === 'string' ? s.themeName : DEFAULT_SETTINGS.themeName
  const panels =
    s.panels && typeof s.panels === 'object'
      ? (s.panels as ProfilePrefs['panels'])
      : DEFAULT_SETTINGS.panels
  const recentCommands = Array.isArray(s.recentCommands)
    ? (s.recentCommands as ProfilePrefs['recentCommands'])
    : DEFAULT_SETTINGS.recentCommands
  const language =
    s.language === 'en' || s.language === 'fr' || s.language === 'es'
      ? s.language
      : DEFAULT_SETTINGS.language
  return {
    id,
    name,
    icon,
    color,
    settings: {
      version,
      theme,
      themeName,
      panels,
      recentCommands,
      language,
      readonlyMode: (s.readonlyMode as boolean) ?? DEFAULT_SETTINGS.readonlyMode,
      confirmDisconnect: (s.confirmDisconnect as boolean) ?? DEFAULT_SETTINGS.confirmDisconnect,
      sidebarCollapsed: (s.sidebarCollapsed as boolean) ?? DEFAULT_SETTINGS.sidebarCollapsed,
      assistantOpen: (s.assistantOpen as boolean) ?? DEFAULT_SETTINGS.assistantOpen,
      consoleOpen: (s.consoleOpen as boolean) ?? DEFAULT_SETTINGS.consoleOpen,
      bottomPanelTab:
        s.bottomPanelTab === 'terminal' || s.bottomPanelTab === 'console'
          ? s.bottomPanelTab
          : DEFAULT_SETTINGS.bottomPanelTab,
      defaultViewMode: (s.defaultViewMode as DefaultViewMode) ?? DEFAULT_SETTINGS.defaultViewMode,
      defaultEntityViewMode:
        (s.defaultEntityViewMode as EntityViewMode) ?? DEFAULT_SETTINGS.defaultEntityViewMode,
      defaultEditMode: (s.defaultEditMode as EditMode) ?? DEFAULT_SETTINGS.defaultEditMode,
      sidebarViewMode: (s.sidebarViewMode as SidebarViewMode) ?? DEFAULT_SETTINGS.sidebarViewMode,
      sidebarSortOption: parseSidebarSortOption(
        s.sidebarSortOption,
        DEFAULT_SETTINGS.sidebarSortOption
      ),
      pageSize: (s.pageSize as number) ?? DEFAULT_SETTINGS.pageSize,
      defaultQueryRunMode:
        s.defaultQueryRunMode === 'run' || s.defaultQueryRunMode === 'runAsSelection'
          ? s.defaultQueryRunMode
          : DEFAULT_SETTINGS.defaultQueryRunMode,
      shortcuts: mergedShortcuts,
      activeShortcutPreset:
        (s.activeShortcutPreset as ProfileSettings['activeShortcutPreset']) ??
        DEFAULT_SETTINGS.activeShortcutPreset,
      codeEditorPrefs: (s.codeEditorPrefs && typeof s.codeEditorPrefs === 'object'
        ? { ...DEFAULT_EDITOR_PREFS, ...s.codeEditorPrefs }
        : DEFAULT_EDITOR_PREFS) as EditorPrefs,
      dataclassCustomizations:
        (s.dataclassCustomizations as Record<string, DataclassCustomization>) ?? {},
      assistantDisabledNamespaces: Array.isArray(s.assistantDisabledNamespaces)
        ? (s.assistantDisabledNamespaces as AssistantToolNamespace[]).filter((ns) =>
            ASSISTANT_TOOL_NAMESPACES.includes(ns)
          )
        : DEFAULT_SETTINGS.assistantDisabledNamespaces,
      assistantDisabledTools: Array.isArray(s.assistantDisabledTools)
        ? (s.assistantDisabledTools as string[])
        : DEFAULT_SETTINGS.assistantDisabledTools,
      disabledWidgetTypes: Array.isArray(s.disabledWidgetTypes)
        ? (s.disabledWidgetTypes as string[])
        : DEFAULT_SETTINGS.disabledWidgetTypes,
    },
  }
}

// =============================================================================
// Store
// =============================================================================

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        ...DEFAULT_SETTINGS,
        profiles: [buildDefaultProfile()],
        currentProfileId: DEFAULT_PROFILE_ID,

        // Actions
        setLanguage: (language) => set({ language }),
        setReadonlyMode: (readonly) => set({ readonlyMode: readonly }),
        toggleReadonlyMode: () => set({ readonlyMode: !get().readonlyMode }),
        setConfirmDisconnect: (confirm) => set({ confirmDisconnect: confirm }),
        setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
        toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
        setAssistantOpen: (open) => set({ assistantOpen: open }),
        toggleAssistantOpen: () => set({ assistantOpen: !get().assistantOpen }),
        setConsoleOpen: (open) => {
          if (open) prepareMobileOverlay('console')
          set({ consoleOpen: open, ...(open ? { bottomPanelTab: 'console' as const } : {}) })
        },
        toggleConsoleOpen: () => {
          const { consoleOpen, bottomPanelTab } = get()
          if (consoleOpen && bottomPanelTab === 'console') {
            set({ consoleOpen: false })
            return
          }
          prepareMobileOverlay('console')
          set({ consoleOpen: true, bottomPanelTab: 'console' })
        },
        setBottomPanelTab: (tab) => {
          prepareMobileOverlay(tab === 'terminal' ? 'terminal' : 'console')
          set({ bottomPanelTab: tab, consoleOpen: true })
        },
        toggleTerminalOpen: () => {
          const { consoleOpen, bottomPanelTab } = get()
          if (consoleOpen && bottomPanelTab === 'terminal') {
            set({ consoleOpen: false })
            return
          }
          prepareMobileOverlay('terminal')
          set({ consoleOpen: true, bottomPanelTab: 'terminal' })
        },
        setDefaultViewMode: (mode) => {
          set({ defaultViewMode: mode })
          // Apply to all existing dataclass tabs
          useTabsStore.getState().applyDefaultViewModeToAllTabs(mode)
        },
        setDefaultEntityViewMode: (mode) => set({ defaultEntityViewMode: mode }),
        setDefaultEditMode: (mode) => set({ defaultEditMode: mode }),
        setSidebarViewMode: (mode) => set({ sidebarViewMode: mode }),
        setSidebarSortOption: (option) => set({ sidebarSortOption: option }),
        setPageSize: (size) => {
          const newSize = Math.max(5, Math.min(100, size))
          set({ pageSize: newSize })
          // Apply to all existing dataclass tabs
          useTabsStore.getState().applyDefaultPageSizeToAllTabs(newSize)
        },
        setDefaultQueryRunMode: (mode) => set({ defaultQueryRunMode: mode }),

        updateShortcut: (id, updates) => {
          const shortcuts = mergeShortcutsWithDefaults(get().shortcuts)
          const newShortcuts = shortcuts.map((s) => (s.id === id ? { ...s, ...updates } : s))
          // Mark as custom when shortcuts are manually modified
          set({ shortcuts: newShortcuts, activeShortcutPreset: 'custom' })
        },

        setAllShortcutsEnabled: (enabled) => {
          const shortcuts = mergeShortcutsWithDefaults(get().shortcuts)
          const newShortcuts = shortcuts.map((s) => ({ ...s, enabled }))
          set({ shortcuts: newShortcuts, activeShortcutPreset: 'custom' })
        },

        setCategoryShortcutsEnabled: (category, enabled) => {
          const shortcuts = mergeShortcutsWithDefaults(get().shortcuts)
          const newShortcuts = shortcuts.map((s) =>
            s.category === category ? { ...s, enabled } : s
          )
          set({ shortcuts: newShortcuts, activeShortcutPreset: 'custom' })
        },

        applyShortcutPreset: (presetId) => {
          const presetShortcuts = getPresetShortcuts(presetId)
          set({
            shortcuts: mergeShortcutsWithDefaults(presetShortcuts.map((s) => ({ ...s }))),
            activeShortcutPreset: presetId,
          })
        },

        resetShortcuts: () =>
          set({
            shortcuts: mergeShortcutsWithDefaults(DEFAULT_SHORTCUTS),
            activeShortcutPreset: 'default',
          }),

        /** Ensure newly registered shortcuts appear for customization (e.g. after app update). */
        syncShortcutsWithDefaults: () => {
          const current = get().shortcuts
          const merged = mergeShortcutsWithDefaults(current)
          const currentIds = current.map((s) => s.id).join('\0')
          const mergedIds = merged.map((s) => s.id).join('\0')
          if (currentIds !== mergedIds || current.length !== merged.length) {
            set({ shortcuts: merged })
          }
        },

        updateCodeEditorPrefs: (partial) => {
          const { codeEditorPrefs } = get()
          set({ codeEditorPrefs: { ...codeEditorPrefs, ...partial } })
        },

        setDataclassCustomization: (dataclassName, customization) => {
          const { dataclassCustomizations } = get()
          // Empty patch clears the entry (existing API contract).
          if (Object.keys(customization).length === 0) {
            const { [dataclassName]: _, ...rest } = dataclassCustomizations
            set({ dataclassCustomizations: rest })
            saveDataclassCustomizations(rest)
            return
          }

          // Partial update: merge into existing so fields like `position` are preserved
          // when only icon/color/description are patched (e.g. assistant tools).
          const existing = dataclassCustomizations[dataclassName] ?? {}
          const merged: DataclassCustomization = { ...existing }
          if ('icon' in customization) {
            if (customization.icon) merged.icon = customization.icon
            else delete merged.icon
          }
          if ('color' in customization) {
            if (customization.color) merged.color = customization.color
            else delete merged.color
          }
          if ('description' in customization) {
            if (customization.description) merged.description = customization.description
            else delete merged.description
          }
          if ('position' in customization) {
            if (customization.position) merged.position = customization.position
            else delete merged.position
          }

          let updated: Record<string, DataclassCustomization>
          if (!merged.icon && !merged.color && !merged.description && !merged.position) {
            const { [dataclassName]: _, ...rest } = dataclassCustomizations
            updated = rest
          } else {
            updated = {
              ...dataclassCustomizations,
              [dataclassName]: merged,
            }
          }
          set({ dataclassCustomizations: updated })
          saveDataclassCustomizations(updated)
        },

        setDataclassCustomizations: (updates) => {
          const { dataclassCustomizations } = get()
          // Merge a batch of customizations in a single state update + single
          // persist. Avoids O(n) copies and localStorage writes per dataclass
          // (previously auto-organize called setDataclassCustomization in a loop).
          const merged: Record<string, DataclassCustomization> = { ...dataclassCustomizations }
          for (const [dataclassName, customization] of Object.entries(updates)) {
            if (Object.keys(customization).length === 0) {
              delete merged[dataclassName]
              continue
            }
            const existing = merged[dataclassName] ?? {}
            const next: DataclassCustomization = { ...existing }
            if ('icon' in customization) {
              if (customization.icon) next.icon = customization.icon
              else delete next.icon
            }
            if ('color' in customization) {
              if (customization.color) next.color = customization.color
              else delete next.color
            }
            if ('description' in customization) {
              if (customization.description) next.description = customization.description
              else delete next.description
            }
            if ('position' in customization) {
              if (customization.position) next.position = customization.position
              else delete next.position
            }
            if (!next.icon && !next.color && !next.description && !next.position) {
              delete merged[dataclassName]
            } else {
              merged[dataclassName] = next
            }
          }
          set({ dataclassCustomizations: merged })
          saveDataclassCustomizations(merged)
        },

        setDataclassPositions: (positions) => {
          const { dataclassCustomizations } = get()
          // Positions are graph-only metadata. Preserve the outer reference so
          // sidebar subscribers do not rerender hundreds of presentation items.
          for (const [dataclassName, position] of Object.entries(positions)) {
            dataclassCustomizations[dataclassName] = {
              ...dataclassCustomizations[dataclassName],
              position,
            }
          }
          saveDataclassCustomizations(dataclassCustomizations)
        },

        removeDataclassCustomization: (dataclassName) => {
          const { dataclassCustomizations } = get()
          const { [dataclassName]: _, ...rest } = dataclassCustomizations
          set({ dataclassCustomizations: rest })
          // Persist to base settings
          saveDataclassCustomizations(rest)
        },

        resetDataclassCustomizations: () => {
          set({ dataclassCustomizations: {} })
          // Persist to base settings
          saveDataclassCustomizations({})
        },

        resetAllSettings: () => {
          set(DEFAULT_SETTINGS)
          // Reset theme in storage so ThemeProvider syncs (persist will also write it)
          saveThemeToStorage(DEFAULT_SETTINGS.theme)
          saveThemeNameToStorage(DEFAULT_SETTINGS.themeName)
          // Also reset dataclass customizations in base settings
          saveDataclassCustomizations({})
        },

        addProfile: (name) => {
          const { profiles, currentProfileId } = get()
          const current = profiles.find((p) => p.id === currentProfileId)
          const base = current?.settings ?? DEFAULT_SETTINGS
          const id = `profile-${Date.now()}`
          const newProfile: Profile = {
            id,
            name: name.trim() || 'Unnamed',
            settings: {
              ...base,
              shortcuts: base.shortcuts.map((s) => ({ ...s })),
              dataclassCustomizations: { ...base.dataclassCustomizations },
            },
          }
          set({ profiles: [...profiles, newProfile], currentProfileId: id })
        },

        duplicateProfile: (id) => {
          const { profiles } = get()
          const source = profiles.find((p) => p.id === id)
          if (!source) return
          const newId = `profile-${Date.now()}`
          const newProfile: Profile = {
            id: newId,
            name: `${source.name} (copy)`,
            icon: source.icon,
            color: source.color,
            settings: {
              ...source.settings,
              shortcuts: source.settings.shortcuts.map((s) => ({ ...s })),
              dataclassCustomizations: { ...source.settings.dataclassCustomizations },
            },
          }
          set({ profiles: [...profiles, newProfile], currentProfileId: newId })
        },

        removeProfile: (id) => {
          if (id === DEFAULT_PROFILE_ID) return
          const { profiles, currentProfileId } = get()
          const next = profiles.filter((p) => p.id !== id)
          if (next.length === 0) return
          const nextCurrent = currentProfileId === id ? DEFAULT_PROFILE_ID : currentProfileId
          const nextProfile = next.find((p) => p.id === nextCurrent)
          const fromBase = getDataclassCustomizations() as Record<string, DataclassCustomization>
          if (!nextProfile) {
            set({
              profiles: next,
              currentProfileId: DEFAULT_PROFILE_ID,
              ...profileSettingsForStore(next[0].settings),
              dataclassCustomizations: fromBase,
            })
            return
          }
          set({
            profiles: next,
            currentProfileId: nextCurrent,
            ...profileSettingsForStore(nextProfile.settings),
            dataclassCustomizations: fromBase,
          })
        },

        renameProfile: (id, name) => {
          const trimmed = name.trim()
          if (!trimmed) return
          set((state) => ({
            profiles: state.profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
          }))
        },

        updateProfileAppearance: (id, updates) => {
          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.id === id
                ? {
                    ...p,
                    icon: updates.icon !== undefined ? updates.icon : p.icon,
                    color: updates.color !== undefined ? updates.color : p.color,
                  }
                : p
            ),
          }))
        },

        switchProfile: (id) => {
          const state = get()
          const { profiles, currentProfileId } = state
          const profile = profiles.find((p) => p.id === id)
          if (!profile) return
          const prefs = getCurrentPrefs()
          const currentSettings: ProfileSettings = {
            version: prefs.version,
            theme: prefs.theme,
            themeName: prefs.themeName,
            panels: prefs.panels,
            recentCommands: prefs.recentCommands,
            language: state.language,
            readonlyMode: state.readonlyMode,
            confirmDisconnect: state.confirmDisconnect,
            sidebarCollapsed: state.sidebarCollapsed,
            assistantOpen: state.assistantOpen,
            consoleOpen: state.consoleOpen,
            bottomPanelTab: state.bottomPanelTab,
            defaultViewMode: state.defaultViewMode,
            defaultEntityViewMode: state.defaultEntityViewMode,
            defaultEditMode: state.defaultEditMode,
            sidebarViewMode: state.sidebarViewMode,
            sidebarSortOption: state.sidebarSortOption,
            pageSize: state.pageSize,
            defaultQueryRunMode: state.defaultQueryRunMode,
            shortcuts: state.shortcuts,
            activeShortcutPreset: state.activeShortcutPreset,
            codeEditorPrefs: state.codeEditorPrefs,
            dataclassCustomizations: state.dataclassCustomizations,
            assistantDisabledNamespaces: state.assistantDisabledNamespaces,
            assistantDisabledTools: state.assistantDisabledTools,
            disabledWidgetTypes: state.disabledWidgetTypes,
          }
          const updatedProfiles = profiles.map((p) =>
            p.id === currentProfileId ? { ...p, settings: currentSettings } : p
          )
          set({
            profiles: updatedProfiles,
            currentProfileId: id,
            ...profileSettingsForStore(profile.settings),
            dataclassCustomizations: getDataclassCustomizations() as Record<
              string,
              DataclassCustomization
            >,
          })
          const data = getProfilesStorage()
          data.profiles[id] = {
            name: profile.name,
            icon: profile.icon,
            color: profile.color,
            settings: withPreservedEnvironments(
              settingsWithoutBaseOnlyFields(profile.settings) as Record<string, unknown>,
              data.profiles[id]?.settings
            ),
          }
          data.current = id
          saveProfilesStorage(data)
          useTabsStore.getState().applyDefaultViewModeToAllTabs(profile.settings.defaultViewMode)
          useTabsStore.getState().applyDefaultPageSizeToAllTabs(profile.settings.pageSize)
          // Profile environments / pick lists live in profile settings — refresh selectors.
          void import('~/store/environments').then((m) => m.useEnvironmentsStore.getState().touch())
          void import('~/store/lists').then((m) => m.useListsStore.getState().touch())
        },

        exportSettings: () => {
          const {
            readonlyMode,
            confirmDisconnect,
            sidebarCollapsed,
            assistantOpen,
            consoleOpen,
            bottomPanelTab,
            defaultViewMode,
            defaultEntityViewMode,
            defaultEditMode,
            sidebarViewMode,
            sidebarSortOption,
            pageSize,
            defaultQueryRunMode,
            shortcuts,
            activeShortcutPreset,
          } = get()
          // Load dataclass customizations from base settings
          const dataclassCustomizations = getDataclassCustomizations() as Record<
            string,
            DataclassCustomization
          >
          return JSON.stringify(
            {
              version: 1,
              settings: {
                readonlyMode,
                confirmDisconnect,
                sidebarCollapsed,
                assistantOpen,
                consoleOpen,
                bottomPanelTab,
                defaultViewMode,
                defaultEntityViewMode,
                defaultEditMode,
                sidebarViewMode,
                sidebarSortOption,
                pageSize,
                defaultQueryRunMode,
                shortcuts,
                activeShortcutPreset,
                dataclassCustomizations,
              },
            },
            null,
            2
          )
        },

        importSettings: (json) => {
          try {
            const data = JSON.parse(json)
            if (data.version !== 1 || !data.settings) {
              return false
            }
            const { settings } = data
            set({
              readonlyMode: settings.readonlyMode ?? DEFAULT_SETTINGS.readonlyMode,
              confirmDisconnect: settings.confirmDisconnect ?? DEFAULT_SETTINGS.confirmDisconnect,
              sidebarCollapsed: settings.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed,
              assistantOpen: settings.assistantOpen ?? DEFAULT_SETTINGS.assistantOpen,
              consoleOpen: settings.consoleOpen ?? DEFAULT_SETTINGS.consoleOpen,
              bottomPanelTab:
                settings.bottomPanelTab === 'terminal' || settings.bottomPanelTab === 'console'
                  ? settings.bottomPanelTab
                  : DEFAULT_SETTINGS.bottomPanelTab,
              defaultViewMode: settings.defaultViewMode ?? DEFAULT_SETTINGS.defaultViewMode,
              defaultEntityViewMode:
                settings.defaultEntityViewMode ?? DEFAULT_SETTINGS.defaultEntityViewMode,
              defaultEditMode: settings.defaultEditMode ?? DEFAULT_SETTINGS.defaultEditMode,
              sidebarViewMode: settings.sidebarViewMode ?? DEFAULT_SETTINGS.sidebarViewMode,
              sidebarSortOption: parseSidebarSortOption(
                settings.sidebarSortOption,
                DEFAULT_SETTINGS.sidebarSortOption
              ),
              pageSize: settings.pageSize ?? DEFAULT_SETTINGS.pageSize,
              defaultQueryRunMode:
                settings.defaultQueryRunMode === 'run' ||
                settings.defaultQueryRunMode === 'runAsSelection'
                  ? settings.defaultQueryRunMode
                  : DEFAULT_SETTINGS.defaultQueryRunMode,
              shortcuts: mergeShortcutsWithDefaults(
                (settings.shortcuts as KeyboardShortcut[] | undefined) ?? DEFAULT_SETTINGS.shortcuts
              ),
              activeShortcutPreset:
                settings.activeShortcutPreset ?? DEFAULT_SETTINGS.activeShortcutPreset,
            })
            // Import dataclass customizations to base settings
            if (settings.dataclassCustomizations) {
              const customizations = settings.dataclassCustomizations as Record<
                string,
                DataclassCustomization
              >
              set({ dataclassCustomizations: customizations })
              saveDataclassCustomizations(customizations)
            }
            return true
          } catch {
            return false
          }
        },

        exportProfiles: (ids) => {
          const { profiles } = get()
          const toExport = ids === undefined ? profiles : profiles.filter((p) => ids.includes(p.id))
          if (toExport.length === 0) return JSON.stringify({ version: 1, profiles: [] }, null, 2)
          return JSON.stringify(
            {
              version: 1,
              profiles: toExport.map((p) => ({
                id: p.id,
                name: p.name,
                icon: p.icon,
                color: p.color,
                settings: { ...p.settings },
              })),
            },
            null,
            2
          )
        },

        importProfiles: (json) => {
          try {
            const data = JSON.parse(json)
            if (data.version !== 1) return { ok: false }
            if (data.profiles && Array.isArray(data.profiles)) {
              const { profiles } = get()
              const existingIds = new Set(profiles.map((p) => p.id))
              const toAdd: Profile[] = []
              for (const p of data.profiles as Profile[]) {
                if (!p?.id || !p?.name || !p?.settings) continue
                let id = p.id
                if (existingIds.has(id)) id = `profile-${Date.now()}-${toAdd.length}`
                existingIds.add(id)
                toAdd.push(normalizeImportedProfile(p, id))
              }
              if (toAdd.length > 0) {
                set({ profiles: [...profiles, ...toAdd] })
              }
              return { ok: true, importedCount: toAdd.length }
            }
            if (data.settings) {
              const ok = get().importSettings(json)
              return { ok }
            }
            return { ok: false }
          } catch {
            return { ok: false }
          }
        },

        parseImportProfiles: (json): ParseImportProfilesResult => {
          try {
            const data = JSON.parse(json)
            if (data.version !== 1) return { ok: false }
            if (data.profiles && Array.isArray(data.profiles)) {
              const existingIds = new Set(get().profiles.map((p) => p.id))
              const profiles = (
                data.profiles as Array<{ id?: string; name?: string; settings?: unknown }>
              )
                .filter((p) => p?.id && p?.name && p?.settings)
                .map((p) => ({
                  id: p.id as string,
                  name: (p.name as string) || 'Imported',
                  willOverwrite: existingIds.has(p.id as string),
                }))
              return { ok: true, profiles }
            }
            if (data.settings) return { ok: true, legacy: true }
            return { ok: false }
          } catch {
            return { ok: false }
          }
        },

        importProfilesByIds: (json, ids) => {
          if (ids.length === 0) return { ok: true, importedCount: 0 }
          try {
            const data = JSON.parse(json)
            if (data.version !== 1 || !data.profiles || !Array.isArray(data.profiles)) {
              return { ok: false }
            }
            const idSet = new Set(ids)
            type RawProfile = { id?: string; name?: string; settings?: Record<string, unknown> }
            const rawById = new Map<string, RawProfile>(
              (data.profiles as RawProfile[])
                .filter((p): p is RawProfile & { id: string } => Boolean(p?.id && idSet.has(p.id)))
                .map((p) => [p.id, p])
            )
            const { profiles } = get()
            const next: Profile[] = []
            const used = new Set<string>()
            for (const p of profiles) {
              const raw = rawById.get(p.id)
              if (raw) {
                next.push(normalizeImportedProfile(raw, p.id))
                used.add(p.id)
              } else {
                next.push(p)
              }
            }
            for (const id of ids) {
              if (used.has(id)) continue
              const raw = rawById.get(id)
              if (raw) next.push(normalizeImportedProfile(raw, id))
            }
            const currentId = get().currentProfileId
            const updatedCurrent = next.find((p) => p.id === currentId)
            const currentWasImported = rawById.has(currentId)
            if (currentWasImported && updatedCurrent) {
              set({
                profiles: next,
                ...updatedCurrent.settings,
                dataclassCustomizations: getDataclassCustomizations() as Record<
                  string,
                  DataclassCustomization
                >,
              })
              useTabsStore
                .getState()
                .applyDefaultViewModeToAllTabs(updatedCurrent.settings.defaultViewMode)
              useTabsStore
                .getState()
                .applyDefaultPageSizeToAllTabs(updatedCurrent.settings.pageSize)
            } else {
              set({ profiles: next })
            }
            return { ok: true, importedCount: rawById.size }
          } catch {
            return { ok: false }
          }
        },

        getAssistantToolPrefs: () => {
          const { assistantDisabledNamespaces, assistantDisabledTools } = get()
          return { assistantDisabledNamespaces, assistantDisabledTools }
        },

        setAssistantToolEnabled: (name, enabled) => {
          const pattern = name.startsWith('@') ? name : `@${name}`
          const next = applyToolPattern(get().getAssistantToolPrefs(), pattern, enabled)
          set({
            assistantDisabledNamespaces: next.assistantDisabledNamespaces,
            assistantDisabledTools: next.assistantDisabledTools,
          })
        },

        setAssistantNamespaceToolsEnabled: (namespace, enabled) => {
          const next = applyToolPattern(get().getAssistantToolPrefs(), `@${namespace}/*`, enabled)
          set({
            assistantDisabledNamespaces: next.assistantDisabledNamespaces,
            assistantDisabledTools: next.assistantDisabledTools,
          })
        },

        setAllAssistantToolsEnabled: (enabled) => {
          const next = applyToolPattern(get().getAssistantToolPrefs(), '*', enabled)
          set({
            assistantDisabledNamespaces: next.assistantDisabledNamespaces,
            assistantDisabledTools: next.assistantDisabledTools,
          })
        },

        applyAssistantToolPattern: (pattern, enabled) => {
          if (!parseToolPattern(pattern)) return false
          const next = applyToolPattern(get().getAssistantToolPrefs(), pattern, enabled)
          set({
            assistantDisabledNamespaces: next.assistantDisabledNamespaces,
            assistantDisabledTools: next.assistantDisabledTools,
          })
          return true
        },

        setWidgetTypeEnabled: (widgetType, enabled) => {
          const type = widgetType.trim()
          if (!type) return
          const current = new Set(get().disabledWidgetTypes)
          if (enabled) current.delete(type)
          else current.add(type)
          set({ disabledWidgetTypes: [...current] })
        },

        setAllWidgetTypesEnabled: (enabled, allTypes) => {
          set({
            disabledWidgetTypes: enabled ? [] : [...allTypes],
          })
        },

        restoreBuiltinWidgets: () => {
          set({ disabledWidgetTypes: [] })
        },
      }),
      {
        name: 'dataexplorer-settings',
        storage: createSettingsStorage(),
        partialize: (state) => {
          // Persist all settings + profiles; dataclassCustomizations and graphEditorState are base-only (written from base in setItem / saveGraphEditorState)
          return state
        },
        // Merge persisted shortcuts with new defaults; ensure profiles exist; sync dataclass customizations to base
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<SettingsState>
          const mergedShortcuts = mergeShortcutsWithDefaults(persisted.shortcuts)

          const rawProfiles = persisted.profiles?.length
            ? persisted.profiles
            : [buildDefaultProfile()]
          const profiles = rawProfiles.map((profile) => ({
            ...profile,
            settings: {
              ...profile.settings,
              shortcuts: mergeShortcutsWithDefaults(profile.settings?.shortcuts),
            },
          }))
          const currentProfileId = persisted.currentProfileId ?? DEFAULT_PROFILE_ID
          const dataclassCustomizations = readDataclassCustomizationsForRehydrate() as Record<
            string,
            DataclassCustomization
          >

          return {
            ...currentState,
            ...persisted,
            shortcuts: mergedShortcuts,
            activeShortcutPreset:
              persisted.activeShortcutPreset ?? DEFAULT_SETTINGS.activeShortcutPreset,
            codeEditorPrefs:
              (persisted as Partial<SettingsState>).codeEditorPrefs != null
                ? {
                    ...DEFAULT_EDITOR_PREFS,
                    ...(persisted as Partial<SettingsState>).codeEditorPrefs,
                  }
                : DEFAULT_EDITOR_PREFS,
            profiles,
            currentProfileId,
            dataclassCustomizations,
            disabledWidgetTypes:
              persisted.disabledWidgetTypes ?? DEFAULT_SETTINGS.disabledWidgetTypes,
            // Restore dock open state (console vs terminal) after reload.
            consoleOpen:
              typeof persisted.consoleOpen === 'boolean'
                ? persisted.consoleOpen
                : DEFAULT_SETTINGS.consoleOpen,
            bottomPanelTab:
              persisted.bottomPanelTab === 'terminal' || persisted.bottomPanelTab === 'console'
                ? persisted.bottomPanelTab
                : DEFAULT_SETTINGS.bottomPanelTab,
          }
        },
      }
    ),
    {
      name: 'DataExplorerSettings',
      enabled: !!import.meta.env.DEV,
    }
  )
)

// =============================================================================
// Hooks
// =============================================================================

// Hook to check if readonly mode is enabled
export const useReadonlyMode = () => useSettingsStore((state) => state.readonlyMode)
export const useConfirmDisconnect = () => useSettingsStore((state) => state.confirmDisconnect)

// Hook for sidebar collapsed state
export const useSidebarCollapsed = () => useSettingsStore((state) => state.sidebarCollapsed)

// Hook for assistant chatbot open state
export const useAssistantOpen = () => useSettingsStore((state) => state.assistantOpen)

// Hook for bottom console panel open state
export const useConsoleOpen = () => useSettingsStore((state) => state.consoleOpen)

// Hook for default view mode
export const useDefaultViewMode = () => useSettingsStore((state) => state.defaultViewMode)

// Hook for default entity view mode
export const useDefaultEntityViewMode = () =>
  useSettingsStore((state) => state.defaultEntityViewMode)

// Hook for default edit mode
export const useDefaultEditMode = () => useSettingsStore((state) => state.defaultEditMode)

// Hook for sidebar view mode
export const useSidebarViewMode = () => useSettingsStore((state) => state.sidebarViewMode)

// Hook for sidebar dataclass sort order
export const useSidebarSortOption = () => useSettingsStore((state) => state.sidebarSortOption)

// Hook for page size
export const usePageSize = () => useSettingsStore((state) => state.pageSize)

export const useDefaultQueryRunMode = () => useSettingsStore((state) => state.defaultQueryRunMode)

// Hook for shortcuts
export const useShortcuts = () => useSettingsStore((state) => state.shortcuts)

// Get a specific shortcut by ID
export const useShortcut = (id: string) =>
  useSettingsStore((state) => state.shortcuts.find((s) => s.id === id))

// Hook for dataclass customizations
export const useDataclassCustomizations = () =>
  useSettingsStore((state) => state.dataclassCustomizations)

// Get customization for a specific dataclass
export const useDataclassCustomization = (dataclassName: string) =>
  useSettingsStore((state) => state.dataclassCustomizations[dataclassName])

// Hook for active shortcut preset
export const useActiveShortcutPreset = () => useSettingsStore((state) => state.activeShortcutPreset)

// Hook for code editor prefs (stored in dataexplorer:profiles)
export const useCodeEditorPrefs = () => useSettingsStore((state) => state.codeEditorPrefs)
export const useUpdateCodeEditorPrefs = () =>
  useSettingsStore((state) => state.updateCodeEditorPrefs)

// Hook for profiles
export const useProfiles = () => useSettingsStore((state) => state.profiles)

// Hook for current profile id
export const useCurrentProfileId = () => useSettingsStore((state) => state.currentProfileId)
