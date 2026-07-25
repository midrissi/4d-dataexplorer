import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { waitForAppReady, waitForDataclassesLoaded } from './app'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const E2E_SETTINGS_PATH = path.resolve(__dirname, '../../fixtures/dataexplorer-settings.json')

const PROFILES_KEY = 'dataexplorer:profiles'
const BASE_KEY_PREFIX = 'dataexplorer:bases:'

type KeyModifiers = {
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

type KeyCombo = {
  key: string
  modifiers: KeyModifiers
}

type KeyboardShortcut = {
  id: string
  label: string
  key: string
  modifiers: KeyModifiers
  chord?: [KeyCombo, KeyCombo]
  enabled: boolean
  category: string
}

type SettingsExport = {
  version: number
  settings: {
    dataclassCustomizations?: Record<string, { icon?: string; color?: string }>
    shortcuts?: KeyboardShortcut[]
    [key: string]: unknown
  }
}

/** Remap fixture shortcuts exported on macOS (meta) to ctrl on Linux/Windows CI runners. */
function normalizePlatformModifier(modifiers: KeyModifiers): KeyModifiers {
  if (process.platform === 'darwin' || !modifiers.meta || modifiers.ctrl) {
    return modifiers
  }

  const { meta: _meta, ...rest } = modifiers
  return { ...rest, ctrl: true }
}

function normalizeKeyCombo(combo: KeyCombo): KeyCombo {
  return { ...combo, modifiers: normalizePlatformModifier(combo.modifiers) }
}

function normalizeShortcutsForPlatform(shortcuts: KeyboardShortcut[]): KeyboardShortcut[] {
  return shortcuts.map((shortcut) => ({
    ...shortcut,
    modifiers: normalizePlatformModifier(shortcut.modifiers),
    chord: shortcut.chord
      ? [normalizeKeyCombo(shortcut.chord[0]), normalizeKeyCombo(shortcut.chord[1])]
      : undefined,
  }))
}

function loadSettingsExport(): SettingsExport {
  const exportData = JSON.parse(readFileSync(E2E_SETTINGS_PATH, 'utf-8')) as SettingsExport
  if (exportData.version !== 1 || !exportData.settings) {
    throw new Error(`Invalid e2e settings fixture: ${E2E_SETTINGS_PATH}`)
  }
  return exportData
}

function toLucideClassName(icon: string): string {
  return icon
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])(\d+)/g, '$1-$2')
    .toLowerCase()
}

async function waitForDataclassCustomizationsInUi(
  page: Page,
  customizations: Record<string, { icon?: string; color?: string }>
): Promise<void> {
  const canaries = Object.entries(customizations)
    .filter((entry): entry is [string, { icon?: string; color?: string } & { icon: string }] => {
      return typeof entry[1].icon === 'string' && entry[1].icon.length > 0
    })
    .slice(0, 3)
    .map(([name, value]) => ({
      name,
      className: `lucide-${toLucideClassName(value.icon)}`,
    }))

  await page.waitForFunction(
    ({ baseKeyPrefix, sidebarLabel, expectedCount, checks }) => {
      const baseKey = Object.keys(localStorage).find((key) => key.startsWith(baseKeyPrefix))
      if (!baseKey) return false

      const baseData = JSON.parse(localStorage.getItem(baseKey) ?? '{}') as {
        dataclassCustomizations?: Record<string, { icon?: string }>
      }
      const stored = baseData.dataclassCustomizations ?? {}
      if (Object.keys(stored).length < expectedCount) return false

      const sidebar = document.querySelector(`[aria-label="${sidebarLabel}"]`)
      if (!sidebar) return false

      return checks.every(({ name, className }) => {
        const entry = Array.from(sidebar.querySelectorAll('[aria-label]')).find((node) => {
          const label = node.getAttribute('aria-label') ?? ''
          return label.startsWith(`${name} - `)
        })
        if (!entry) return false
        return entry.querySelector(`svg.${className}`) !== null
      })
    },
    {
      baseKeyPrefix: BASE_KEY_PREFIX,
      sidebarLabel: 'Dataclasses',
      expectedCount: Object.keys(customizations).length,
      checks: canaries,
    },
    { timeout: 30_000 }
  )
}

/**
 * Apply the committed e2e settings export (dataclass icons/colors, shortcuts, view prefs).
 * Mirrors Settings → Import for the legacy `dataexplorer-settings.json` format.
 */
export async function applyE2ESettings(page: Page): Promise<void> {
  const exportData = loadSettingsExport()
  const customizations = exportData.settings.dataclassCustomizations ?? {}
  const shortcuts = exportData.settings.shortcuts
    ? normalizeShortcutsForPlatform(exportData.settings.shortcuts)
    : undefined

  const catalogDataclassNames = await page.evaluate(
    async ({ data, profilesKey, baseKeyPrefix, normalizedShortcuts }) => {
      const settings = data.settings as Record<string, unknown>

      const profilesRaw = localStorage.getItem(profilesKey)
      const profilesData = profilesRaw
        ? (JSON.parse(profilesRaw) as {
            current?: string
            profiles?: Record<string, { name?: string; settings?: Record<string, unknown> }>
          })
        : { current: 'default', profiles: { default: { name: 'Default', settings: {} } } }

      const currentId = profilesData.current ?? 'default'
      profilesData.profiles ??= {}
      profilesData.profiles[currentId] ??= { name: 'Default', settings: {} }

      const profile = profilesData.profiles[currentId]
      profile.settings = {
        ...profile.settings,
        readonlyMode: settings.readonlyMode,
        sidebarCollapsed: settings.sidebarCollapsed,
        assistantOpen: settings.assistantOpen,
        defaultViewMode: settings.defaultViewMode,
        defaultEntityViewMode: settings.defaultEntityViewMode,
        defaultEditMode: settings.defaultEditMode,
        sidebarViewMode: settings.sidebarViewMode,
        pageSize: settings.pageSize,
        shortcuts: normalizedShortcuts ?? settings.shortcuts,
        activeShortcutPreset: settings.activeShortcutPreset,
      }

      const nextProfilesValue = JSON.stringify(profilesData)
      localStorage.setItem(profilesKey, nextProfilesValue)
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: profilesKey,
          newValue: nextProfilesValue,
        })
      )

      const dataclassCustomizations = settings.dataclassCustomizations
      if (!dataclassCustomizations || typeof dataclassCustomizations !== 'object') {
        return [] as string[]
      }

      const response = await fetch('/rest/$catalog/$all?$metadata=full', {
        credentials: 'same-origin',
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog for e2e settings (${response.status})`)
      }
      const catalog = (await response.json()) as {
        __BASEID?: string
        __UNIQID?: string
        dataClasses?: Array<{ name: string }>
      }
      const baseId = catalog.__BASEID ?? catalog.__UNIQID
      if (!baseId) {
        throw new Error('Catalog response is missing __BASEID (and __UNIQID fallback)')
      }

      const baseKey = `${baseKeyPrefix}${baseId}`
      const baseRaw = localStorage.getItem(baseKey)
      const baseData = baseRaw
        ? (JSON.parse(baseRaw) as Record<string, unknown>)
        : {
            tabs: [],
            activeTabId: null,
            dataclassCustomizations: {},
            graphEditorState: {},
          }

      baseData.dataclassCustomizations = dataclassCustomizations
      const nextBaseValue = JSON.stringify(baseData)
      localStorage.setItem(baseKey, nextBaseValue)
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: baseKey,
          newValue: nextBaseValue,
        })
      )

      return (catalog.dataClasses ?? []).map((dataclass) => dataclass.name)
    },
    {
      data: exportData,
      profilesKey: PROFILES_KEY,
      baseKeyPrefix: BASE_KEY_PREFIX,
      normalizedShortcuts: shortcuts,
    }
  )

  await page.reload()
  await waitForAppReady(page)
  await waitForDataclassesLoaded(page)

  const catalogNames = new Set(catalogDataclassNames)
  const relevantCustomizations = Object.fromEntries(
    Object.entries(customizations).filter(([name]) => catalogNames.has(name))
  )

  if (Object.keys(relevantCustomizations).length > 0) {
    await waitForDataclassCustomizationsInUi(page, relevantCustomizations)
  }
}
