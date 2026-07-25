import type { AssistantMetadataSchema } from './assistant-metadata-schema'
import { eventBus } from './eventBus'

/**
 * Centralized localStorage management for Data Explorer
 *
 * Two localStorage keys are used:
 * 1. `dataexplorer:profiles` - Profiles with per-profile settings (prefs + settings merged; no dataclassCustomizations, no graphEditorState)
 * 2. `dataexplorer:bases:{BASEID}` - Per-database settings (tabs, dataclassCustomizations, graphEditorState, assistantMetadataSchema)
 */

// =============================================================================
// Types
// =============================================================================

export type Theme = 'light' | 'dark'
export type ThemeName = string

/**
 * Panel sizes stored in user preferences
 */
export type PanelSizes = {
  sidebar?: { width: number }
  entitylist?: { width: number }
  console?: { height: number }
  /** Request pane width % in Method Executor (lg+) */
  methodExecutor?: { width: number }
  /** Request pane width % in HTTP Client (lg+) */
  httpClient?: { width: number }
}

/**
 * Recent command entry for command palette
 */
export type RecentCommand = {
  id: string
  usedAt: number
}

/**
 * Per-profile prefs (theme, panels, etc.) stored in dataexplorer:profiles
 */
export type ProfilePrefs = {
  version: number
  theme: Theme
  themeName: ThemeName
  panels: PanelSizes
  recentCommands: RecentCommand[]
}

/**
 * One profile entry in dataexplorer:profiles.
 * settings = merged prefs (theme, themeName, panels, recentCommands) + profile settings (no dataclassCustomizations, no graphEditorState)
 */
export type ProfileEntry = {
  name: string
  icon?: string // Lucide icon name
  color?: string // Color preset key (e.g. "blue", "green")
  settings: Record<string, unknown>
}

/**
 * dataexplorer:profiles storage format
 */
export type ProfilesStorage = {
  current: string
  profiles: Record<string, ProfileEntry>
}

/**
 * Graph editor viewport state
 */
export type GraphEditorState = {
  zoom?: number
  center?: { x: number; y: number }
  relationFilter?: 'all' | 'none' | 'selected'
}

/**
 * One column entry in a saved table preset: the (possibly dotted) attribute
 * path plus an optional persisted width in pixels, applied when the column is
 * rendered so manual resizing survives reloads.
 */
export type ColumnPresetColumn = {
  name: string
  width?: number
}

/**
 * Saved default field selection for a dataclass (per-dataclass preset).
 * `table` is an ordered list of columns (name + optional width); `cards` is an
 * ordered list of (possibly dotted) attribute paths.
 */
export type ColumnPreset = {
  table: ColumnPresetColumn[]
  cards: string[]
}

/**
 * Base-specific settings structure (dataexplorer:bases:{BASEID})
 */
export type BaseSettings = {
  tabs: unknown[]
  activeTabId: string | null
  dataclassCustomizations: Record<string, unknown>
  graphEditorState?: GraphEditorState
  assistantMetadataSchema?: AssistantMetadataSchema
  /** Per-dataclass default field selection presets (keyed by dataclass name). */
  columnPresets?: Record<string, ColumnPreset>
}

// =============================================================================
// Constants
// =============================================================================

const PROFILES_KEY = 'dataexplorer:profiles'
const BASE_KEY_PREFIX = 'dataexplorer:bases:'
const CURRENT_VERSION = 1

const DEFAULT_BASE_SETTINGS: BaseSettings = {
  tabs: [],
  activeTabId: null,
  dataclassCustomizations: {},
  graphEditorState: {},
}

// =============================================================================
// Internal State
// =============================================================================

// Cache for profiles storage
let profilesCache: ProfilesStorage | null = null

// Current base BASEID (set when catalog is fetched)
let currentBaseId: string | null = null

// =============================================================================
// Profiles Storage (dataexplorer:profiles)
// =============================================================================

/** Default prefs for a profile (exported for migration/defaults) */
export const DEFAULT_PROFILE_PREFS: ProfilePrefs = {
  version: CURRENT_VERSION,
  theme: 'dark',
  themeName: 'tangerine',
  panels: {
    sidebar: { width: 325 },
    entitylist: { width: 40 },
    console: { height: 220 },
    methodExecutor: { width: 40 },
    httpClient: { width: 50 },
  },
  recentCommands: [],
}

/**
 * Get profiles storage from localStorage
 */
export function getProfilesStorage(): ProfilesStorage {
  if (profilesCache) {
    return profilesCache
  }

  try {
    const stored = localStorage.getItem(PROFILES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ProfilesStorage>
      if (parsed.profiles && typeof parsed.profiles === 'object') {
        profilesCache = {
          current: parsed.current ?? 'default',
          profiles: parsed.profiles,
        }
        return profilesCache
      }
    }
  } catch {
    // Ignore parse errors
  }

  profilesCache = {
    current: 'default',
    profiles: {
      default: {
        name: 'Default',
        settings: { ...DEFAULT_PROFILE_PREFS },
      },
    },
  }
  return profilesCache
}

/**
 * Save profiles storage to localStorage
 */
export function saveProfilesStorage(data: ProfilesStorage): void {
  profilesCache = data
  localStorage.setItem(PROFILES_KEY, JSON.stringify(data))

  window.dispatchEvent(
    new StorageEvent('storage', {
      key: PROFILES_KEY,
      newValue: JSON.stringify(data),
    })
  )
}

/**
 * Clear profiles cache (useful for testing or when localStorage changes externally)
 */
export function clearProfilesCache(): void {
  profilesCache = null
}

/**
 * Get current profile's prefs (from dataexplorer:profiles settings).
 * Normalizes so panel dimensions are always present for restoration.
 */
export function getCurrentPrefs(): ProfilePrefs {
  const data = getProfilesStorage()
  const current = data.profiles[data.current]
  const raw = (current?.settings ?? {}) as Partial<ProfilePrefs>
  const defaultPanels = DEFAULT_PROFILE_PREFS.panels
  return {
    ...DEFAULT_PROFILE_PREFS,
    ...raw,
    panels: {
      sidebar: {
        width: raw.panels?.sidebar?.width ?? defaultPanels.sidebar?.width ?? 325,
      },
      entitylist: {
        width: raw.panels?.entitylist?.width ?? defaultPanels.entitylist?.width ?? 40,
      },
      console: {
        height: raw.panels?.console?.height ?? defaultPanels.console?.height ?? 220,
      },
      methodExecutor: {
        width: raw.panels?.methodExecutor?.width ?? defaultPanels.methodExecutor?.width ?? 40,
      },
      httpClient: {
        width: raw.panels?.httpClient?.width ?? defaultPanels.httpClient?.width ?? 50,
      },
    },
  }
}

/**
 * Update current profile's prefs in dataexplorer:profiles (merged into settings)
 */
export function saveCurrentPrefs(partial: Partial<ProfilePrefs>): void {
  const data = getProfilesStorage()
  const currentId = data.current
  const entry = data.profiles[currentId]
  if (!entry) return
  const updated: ProfileEntry = {
    name: entry.name,
    settings: { ...entry.settings, ...partial },
  }
  data.profiles = { ...data.profiles, [currentId]: updated }
  saveProfilesStorage(data)
}

// =============================================================================
// Theme Helpers (read/write current profile prefs)
// =============================================================================

/**
 * Get the current theme (light/dark)
 */
export function getTheme(): Theme {
  return getCurrentPrefs().theme
}

/**
 * Set the theme (light/dark)
 */
export function setTheme(theme: Theme): void {
  saveCurrentPrefs({ theme })
}

/**
 * Get the current theme name (tangerine, slate, etc.)
 */
export function getThemeName(): ThemeName {
  return getCurrentPrefs().themeName
}

/**
 * Set the theme name
 */
export function setThemeName(themeName: ThemeName): void {
  saveCurrentPrefs({ themeName })
}

// =============================================================================
// Panel Size Helpers (read/write current profile prefs)
// =============================================================================

/**
 * Get sidebar panel width
 */
export function getSidebarWidth(): number {
  return getCurrentPrefs().panels.sidebar?.width ?? 325
}

/**
 * Set sidebar panel width
 */
export function setSidebarWidth(width: number): void {
  const prefs = getCurrentPrefs()
  saveCurrentPrefs({
    panels: {
      ...prefs.panels,
      sidebar: { width },
    },
  })
}

/**
 * Get entity list width (as percentage)
 */
export function getEntityListWidth(): number {
  return getCurrentPrefs().panels.entitylist?.width ?? 40
}

/**
 * Set entity list width (as percentage)
 */
export function setEntityListWidth(width: number): void {
  const prefs = getCurrentPrefs()
  saveCurrentPrefs({
    panels: {
      ...prefs.panels,
      entitylist: { width },
    },
  })
}

/**
 * Get Method Executor request pane width (as percentage).
 */
export function getMethodExecutorRequestWidth(): number {
  return getCurrentPrefs().panels.methodExecutor?.width ?? 40
}

/**
 * Set Method Executor request pane width (as percentage).
 */
export function setMethodExecutorRequestWidth(width: number): void {
  const prefs = getCurrentPrefs()
  saveCurrentPrefs({
    panels: {
      ...prefs.panels,
      methodExecutor: { width },
    },
  })
}

/**
 * Get HTTP Client request pane width (as percentage).
 */
export function getHttpClientRequestWidth(): number {
  return getCurrentPrefs().panels.httpClient?.width ?? 50
}

/**
 * Set HTTP Client request pane width (as percentage).
 */
export function setHttpClientRequestWidth(width: number): void {
  const prefs = getCurrentPrefs()
  saveCurrentPrefs({
    panels: {
      ...prefs.panels,
      httpClient: { width },
    },
  })
}

/**
 * Get console panel height in pixels.
 */
export function getConsoleHeight(): number {
  return getCurrentPrefs().panels.console?.height ?? 220
}

/**
 * Set console panel height in pixels.
 */
export function setConsoleHeight(height: number): void {
  const prefs = getCurrentPrefs()
  saveCurrentPrefs({
    panels: {
      ...prefs.panels,
      console: { height },
    },
  })
}

// =============================================================================
// Recent Commands Helpers (read/write current profile prefs)
// =============================================================================

const MAX_RECENT_COMMANDS = 5

/**
 * Get recent commands
 */
export function getRecentCommands(): RecentCommand[] {
  return getCurrentPrefs().recentCommands
}

/**
 * Save a recent command
 */
export function saveRecentCommand(commandId: string): void {
  const recent = getRecentCommands()
  const filtered = recent.filter((cmd) => cmd.id !== commandId)
  const updated: RecentCommand[] = [{ id: commandId, usedAt: Date.now() }, ...filtered].slice(
    0,
    MAX_RECENT_COMMANDS
  )
  saveCurrentPrefs({ recentCommands: updated })
}

// =============================================================================
// Base Settings (dataexplorer:bases:{BASEID})
// =============================================================================

/**
 * Set the current base BASEID (called when catalog is fetched)
 */
export function setCurrentBaseId(baseId: string): void {
  currentBaseId = baseId
}

/**
 * Get the current base BASEID
 */
export function getCurrentBaseId(): string | null {
  return currentBaseId
}

/** @deprecated Use {@link setCurrentBaseId} */
export const setCurrentBaseUniqId = setCurrentBaseId

/** @deprecated Use {@link getCurrentBaseId} */
export const getCurrentBaseUniqId = getCurrentBaseId

/**
 * Get the storage key for the current base
 */
function getBaseStorageKey(): string | null {
  if (!currentBaseId) {
    return null
  }
  return `${BASE_KEY_PREFIX}${currentBaseId}`
}

/**
 * Get base settings from localStorage
 */
export function getBaseSettings(): BaseSettings {
  const key = getBaseStorageKey()
  if (!key) {
    return { ...DEFAULT_BASE_SETTINGS }
  }

  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<BaseSettings>
      return {
        ...DEFAULT_BASE_SETTINGS,
        ...parsed,
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { ...DEFAULT_BASE_SETTINGS }
}

/**
 * Save base settings to localStorage
 */
export function saveBaseSettings(settings: Partial<BaseSettings>): void {
  const key = getBaseStorageKey()
  if (!key) {
    console.warn('Cannot save base settings: no base BASEID set')
    return
  }

  const current = getBaseSettings()
  const updated: BaseSettings = {
    ...current,
    ...settings,
  }
  const serialized = JSON.stringify(updated)
  localStorage.setItem(key, serialized)

  // Dispatch storage event for cross-tab sync
  window.dispatchEvent(
    new StorageEvent('storage', {
      key,
      newValue: serialized,
    })
  )
}

// =============================================================================
// Dataclass Customizations Helpers (Base-specific)
// =============================================================================

/**
 * Get dataclass customizations from base settings
 */
export function getDataclassCustomizations(): Record<string, unknown> {
  return getBaseSettings().dataclassCustomizations ?? {}
}

/**
 * List base storage keys in localStorage (works with Storage.key iteration, not only Object.keys).
 */
function getBaseStorageKeys(): string[] {
  if (typeof localStorage === 'undefined') {
    return []
  }

  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(BASE_KEY_PREFIX)) {
      keys.push(key)
    }
  }
  return keys
}

/**
 * Read dataclass customizations during store rehydration, before catalog sets base BASEID.
 * When exactly one base key exists in localStorage, read customizations from it directly.
 */
export function readDataclassCustomizationsForRehydrate(): Record<string, unknown> {
  if (currentBaseId) {
    return getDataclassCustomizations()
  }

  const baseKeys = getBaseStorageKeys()
  if (baseKeys.length !== 1) {
    return {}
  }

  try {
    const stored = localStorage.getItem(baseKeys[0])
    if (!stored) {
      return {}
    }
    const parsed = JSON.parse(stored) as Partial<BaseSettings>
    return parsed.dataclassCustomizations ?? {}
  } catch {
    return {}
  }
}

/**
 * Save dataclass customizations to base settings
 */
export function saveDataclassCustomizations(customizations: Record<string, unknown>): void {
  saveBaseSettings({ dataclassCustomizations: customizations })
}

// =============================================================================
// Column Preset Helpers (Base-specific)
// =============================================================================

/**
 * Normalize a persisted preset, migrating the legacy `table: string[]` shape
 * into the current `{ name, width? }[]` columns.
 */
function normalizeColumnPreset(raw: unknown): ColumnPreset {
  const obj = (raw ?? {}) as { table?: unknown; cards?: unknown }
  const table: ColumnPresetColumn[] = Array.isArray(obj.table)
    ? obj.table.map((entry) => {
        if (typeof entry === 'string') {
          return { name: entry }
        }
        const e = (entry ?? {}) as { name?: unknown; width?: unknown }
        const col: ColumnPresetColumn = { name: String(e.name ?? '') }
        if (typeof e.width === 'number') {
          col.width = e.width
        }
        return col
      })
    : []
  const cards: string[] = Array.isArray(obj.cards) ? (obj.cards as string[]) : []
  return { table, cards }
}

/**
 * Ordered column names from a preset's table list (without widths).
 */
export function columnPresetTableNames(preset: ColumnPreset | null): string[] {
  return preset?.table.map((col) => col.name) ?? []
}

/**
 * Get all per-dataclass column presets from base settings.
 */
export function getColumnPresets(): Record<string, ColumnPreset> {
  const raw = getBaseSettings().columnPresets ?? {}
  const result: Record<string, ColumnPreset> = {}
  for (const [name, preset] of Object.entries(raw)) {
    result[name] = normalizeColumnPreset(preset)
  }
  return result
}

/**
 * Get the saved default field selection for a single dataclass, or null.
 */
export function getColumnPreset(dataclassName: string): ColumnPreset | null {
  return getColumnPresets()[dataclassName] ?? null
}

/**
 * Save (or overwrite) the default field selection for a dataclass.
 */
export function saveColumnPreset(dataclassName: string, preset: ColumnPreset): void {
  const presets = { ...getColumnPresets(), [dataclassName]: preset }
  saveBaseSettings({ columnPresets: presets })
}

/**
 * Persist a manually-resized column width into an existing preset entry.
 * No-op when the dataclass has no saved preset or the column isn't part of it,
 * so resizing a column never implicitly creates a column selection.
 */
export function saveColumnWidth(dataclassName: string, columnName: string, width: number): void {
  const preset = getColumnPreset(dataclassName)
  if (!preset) return
  let changed = false
  const table = preset.table.map((col) => {
    if (col.name === columnName) {
      changed = true
      return { ...col, width }
    }
    return col
  })
  if (!changed) return
  saveColumnPreset(dataclassName, { table, cards: preset.cards })
}

/**
 * Remove the saved default field selection for a dataclass.
 */
export function deleteColumnPreset(dataclassName: string): void {
  const presets = { ...getColumnPresets() }
  delete presets[dataclassName]
  saveBaseSettings({ columnPresets: presets })
}

// =============================================================================
// Graph Editor State Helpers (Base-specific)
// =============================================================================

/**
 * Get graph editor state from base settings
 */
export function getGraphEditorState(): GraphEditorState {
  return getBaseSettings().graphEditorState ?? {}
}

/**
 * Save graph editor state to base settings
 */
export function saveGraphEditorState(state: GraphEditorState): void {
  saveBaseSettings({ graphEditorState: state })
}

// =============================================================================
// Assistant Metadata Schema Helpers (Base-specific)
// =============================================================================

export function getAssistantMetadataSchema(): AssistantMetadataSchema | null {
  return getBaseSettings().assistantMetadataSchema ?? null
}

export function saveAssistantMetadataSchema(schema: AssistantMetadataSchema): void {
  saveBaseSettings({ assistantMetadataSchema: schema })
  eventBus.emit('assistant-metadata-changed', { updatedAt: schema.updatedAt })
}

// =============================================================================
// Storage Event Listener for Cross-Tab Sync
// =============================================================================

/**
 * Subscribe to storage changes for cross-tab synchronization
 */
export function subscribeToStorageChanges(callback: (event: StorageEvent) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === PROFILES_KEY) {
      clearProfilesCache()
      callback(e)
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
