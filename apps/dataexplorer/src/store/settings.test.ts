import { beforeEach, describe, expect, it } from 'bun:test'
import { clearProfilesCache } from '~/lib/storage'
import type { KeyboardShortcut, KeyCombo } from './settings'
import {
  COLOR_PRESETS,
  DEFAULT_PROFILE_ID,
  formatKeyCombo,
  formatShortcut,
  getPresetShortcuts,
  getShortcutById,
  SHORTCUT_PRESETS,
  useSettingsStore,
} from './settings'

describe('store/settings', () => {
  beforeEach(() => {
    clearProfilesCache()
    useSettingsStore.setState({
      readonlyMode: false,
      sidebarCollapsed: false,
      defaultViewMode: 'cards',
      defaultEntityViewMode: 'form',
      defaultEditMode: 'form',
      sidebarViewMode: 'cards',
      sidebarSortOption: 'name-asc',
      pageSize: 100,
      currentProfileId: DEFAULT_PROFILE_ID,
    })
  })

  describe('constants', () => {
    it('DEFAULT_PROFILE_ID is "default"', () => {
      expect(DEFAULT_PROFILE_ID).toBe('default')
    })

    it('COLOR_PRESETS has expected keys', () => {
      expect(Object.keys(COLOR_PRESETS)).toContain('default')
      expect(Object.keys(COLOR_PRESETS)).toContain('red')
      expect(COLOR_PRESETS.default.name).toBe('Default')
    })

    it('SHORTCUT_PRESETS has default, vscode, minimal, vim', () => {
      expect(SHORTCUT_PRESETS.map((p) => p.id)).toEqual(['default', 'vscode', 'minimal', 'vim'])
    })
  })

  describe('getPresetShortcuts', () => {
    it('returns array of shortcuts for default preset', () => {
      const shortcuts = getPresetShortcuts('default')
      expect(Array.isArray(shortcuts)).toBe(true)
      expect(shortcuts.length).toBeGreaterThan(0)
      expect(shortcuts.some((s) => s.id === 'command-palette')).toBe(true)
    })

    it('returns different shortcuts for vscode preset', () => {
      const defaultShortcuts = getPresetShortcuts('default')
      const vscodeShortcuts = getPresetShortcuts('vscode')
      const defaultPalette = defaultShortcuts.find((s) => s.id === 'command-palette')
      const vscodePalette = vscodeShortcuts.find((s) => s.id === 'command-palette')
      expect(defaultPalette).toBeDefined()
      expect(vscodePalette).toBeDefined()
      expect(JSON.stringify(defaultPalette?.modifiers)).not.toBe(
        JSON.stringify(vscodePalette?.modifiers)
      )
    })

    it('returns default when preset id is unknown', () => {
      const shortcuts = getPresetShortcuts('unknown' as 'default')
      expect(shortcuts.length).toBeGreaterThan(0)
    })
  })

  describe('formatKeyCombo', () => {
    it('formats key without modifiers', () => {
      const combo: KeyCombo = { key: 'k', modifiers: {} }
      expect(formatKeyCombo(combo)).toBe('K')
    })

    it('formats key with ctrl', () => {
      const combo: KeyCombo = { key: 's', modifiers: { ctrl: true } }
      const formatted = formatKeyCombo(combo)
      expect(formatted).toMatch(/Ctrl|⌃/)
      expect(formatted).toContain('S')
    })

    it('formats ArrowUp as arrow symbol', () => {
      const combo: KeyCombo = { key: 'ArrowUp', modifiers: {} }
      expect(formatKeyCombo(combo)).toBe('↑')
    })
  })

  describe('formatShortcut', () => {
    it('formats shortcut without chord', () => {
      const s: KeyboardShortcut = {
        id: 'x',
        label: 'Test',
        key: 'k',
        modifiers: {},
        enabled: true,
        category: 'General',
      }
      expect(formatShortcut(s)).toBe('K')
    })

    it('formats shortcut with chord', () => {
      const s: KeyboardShortcut = {
        id: 'x',
        label: 'Test',
        key: 'k',
        modifiers: {},
        chord: [
          { key: 'k', modifiers: { ctrl: true } },
          { key: 'p', modifiers: {} },
        ],
        enabled: true,
        category: 'General',
      }
      const formatted = formatShortcut(s)
      expect(formatted).toMatch(/Ctrl|⌃/)
      expect(formatted).toMatch(/P|K/)
    })
  })

  describe('getShortcutById', () => {
    it('returns shortcut when found', () => {
      const shortcuts = getPresetShortcuts('default')
      const s = getShortcutById(shortcuts, 'command-palette')
      expect(s?.id).toBe('command-palette')
      expect(s?.label).toBe('Open Command Palette')
    })

    it('returns undefined when not found', () => {
      const shortcuts = getPresetShortcuts('default')
      expect(getShortcutById(shortcuts, 'nonexistent')).toBeUndefined()
    })
  })

  describe('useSettingsStore actions', () => {
    it('setReadonlyMode updates state', () => {
      useSettingsStore.getState().setReadonlyMode(true)
      expect(useSettingsStore.getState().readonlyMode).toBe(true)
      useSettingsStore.getState().setReadonlyMode(false)
      expect(useSettingsStore.getState().readonlyMode).toBe(false)
    })

    it('toggleReadonlyMode toggles state', () => {
      expect(useSettingsStore.getState().readonlyMode).toBe(false)
      useSettingsStore.getState().toggleReadonlyMode()
      expect(useSettingsStore.getState().readonlyMode).toBe(true)
      useSettingsStore.getState().toggleReadonlyMode()
      expect(useSettingsStore.getState().readonlyMode).toBe(false)
    })

    it('setSidebarCollapsed updates state', () => {
      useSettingsStore.getState().setSidebarCollapsed(true)
      expect(useSettingsStore.getState().sidebarCollapsed).toBe(true)
    })

    it('toggleSidebarCollapsed toggles state', () => {
      useSettingsStore.getState().toggleSidebarCollapsed()
      expect(useSettingsStore.getState().sidebarCollapsed).toBe(true)
      useSettingsStore.getState().toggleSidebarCollapsed()
      expect(useSettingsStore.getState().sidebarCollapsed).toBe(false)
    })

    it('setDefaultViewMode updates state', () => {
      useSettingsStore.getState().setDefaultViewMode('table')
      expect(useSettingsStore.getState().defaultViewMode).toBe('table')
    })

    it('setPageSize clamps between 5 and 100', () => {
      useSettingsStore.getState().setPageSize(200)
      expect(useSettingsStore.getState().pageSize).toBe(100)
      useSettingsStore.getState().setPageSize(1)
      expect(useSettingsStore.getState().pageSize).toBe(5)
    })

    it('updateShortcut marks preset as custom', () => {
      useSettingsStore.getState().updateShortcut('command-palette', { enabled: false })
      expect(useSettingsStore.getState().activeShortcutPreset).toBe('custom')
      const s = useSettingsStore.getState().shortcuts.find((x) => x.id === 'command-palette')
      expect(s?.enabled).toBe(false)
    })

    it('setAllShortcutsEnabled toggles all shortcuts', () => {
      useSettingsStore.getState().setAllShortcutsEnabled(false)
      expect(useSettingsStore.getState().shortcuts.every((s) => !s.enabled)).toBe(true)
      useSettingsStore.getState().setAllShortcutsEnabled(true)
      expect(useSettingsStore.getState().shortcuts.every((s) => s.enabled)).toBe(true)
      expect(useSettingsStore.getState().activeShortcutPreset).toBe('custom')
    })

    it('setCategoryShortcutsEnabled toggles category', () => {
      useSettingsStore.getState().setCategoryShortcutsEnabled('General', false)
      const general = useSettingsStore.getState().shortcuts.filter((s) => s.category === 'General')
      expect(general.every((s) => !s.enabled)).toBe(true)
      useSettingsStore.getState().setCategoryShortcutsEnabled('General', true)
      expect(general.length).toBeGreaterThan(0)
      expect(useSettingsStore.getState().activeShortcutPreset).toBe('custom')
    })

    it('setDataclassCustomization with empty object removes customization', () => {
      useSettingsStore.getState().setDataclassCustomization('Employee', { icon: 'User' })
      expect(useSettingsStore.getState().dataclassCustomizations.Employee).toBeDefined()
      useSettingsStore.getState().setDataclassCustomization('Employee', {})
      expect(useSettingsStore.getState().dataclassCustomizations.Employee).toBeUndefined()
    })

    it('setDataclassCustomization merges and preserves position', () => {
      useSettingsStore.getState().setDataclassCustomization('Agency', {
        icon: 'Rocket',
        color: 'purple',
        position: { x: 120, y: 40 },
      })
      useSettingsStore.getState().setDataclassCustomization('Agency', {
        icon: '🌟',
        color: '#1D6CE5',
      })
      expect(useSettingsStore.getState().dataclassCustomizations.Agency).toEqual({
        icon: '🌟',
        color: '#1D6CE5',
        position: { x: 120, y: 40 },
      })
    })

    it('applyShortcutPreset replaces shortcuts', () => {
      useSettingsStore.getState().applyShortcutPreset('vim')
      expect(useSettingsStore.getState().activeShortcutPreset).toBe('vim')
      const palette = useSettingsStore.getState().shortcuts.find((x) => x.id === 'command-palette')
      expect(palette?.key).toBe(':')
    })

    it('setDataclassCustomization and removeDataclassCustomization', () => {
      useSettingsStore
        .getState()
        .setDataclassCustomization('Employee', { icon: 'User', color: 'blue' })
      expect(useSettingsStore.getState().dataclassCustomizations.Employee).toEqual({
        icon: 'User',
        color: 'blue',
      })
      useSettingsStore.getState().removeDataclassCustomization('Employee')
      expect(useSettingsStore.getState().dataclassCustomizations.Employee).toBeUndefined()
    })

    it('addProfile adds new profile and switches to it', () => {
      useSettingsStore.getState().addProfile('Work')
      const { profiles, currentProfileId } = useSettingsStore.getState()
      expect(profiles).toHaveLength(2)
      const work = profiles.find((p) => p.name === 'Work')
      expect(work).toBeDefined()
      if (work) expect(currentProfileId).toBe(work.id)
    })

    it('duplicateProfile clones profile', () => {
      useSettingsStore.getState().addProfile('ProfileA')
      const id = useSettingsStore.getState().currentProfileId
      expect(id).toBeDefined()
      const countBefore = useSettingsStore.getState().profiles.length
      if (id !== undefined) {
        useSettingsStore.getState().duplicateProfile(id)
      }
      const { profiles } = useSettingsStore.getState()
      expect(profiles.length).toBe(countBefore + 1)
      const copy = profiles.find((p) => p.name.endsWith(' (copy)'))
      expect(copy).toBeDefined()
    })

    it('removeProfile does not remove default profile', () => {
      const before = useSettingsStore.getState().profiles.length
      useSettingsStore.getState().removeProfile(DEFAULT_PROFILE_ID)
      expect(useSettingsStore.getState().profiles).toHaveLength(before)
      expect(useSettingsStore.getState().profiles.some((p) => p.id === DEFAULT_PROFILE_ID)).toBe(
        true
      )
    })

    it('removeProfile when current is removed switches to default and updates state', () => {
      useSettingsStore.getState().addProfile('ToRemove')
      const removeId = useSettingsStore.getState().currentProfileId
      expect(removeId).toBeDefined()
      if (removeId !== undefined) {
        useSettingsStore.getState().removeProfile(removeId)
      }
      expect(useSettingsStore.getState().currentProfileId).toBe(DEFAULT_PROFILE_ID)
      expect(useSettingsStore.getState().profiles.some((p) => p.id === removeId)).toBe(false)
    })

    it('renameProfile does nothing when name is empty or whitespace', () => {
      useSettingsStore.getState().addProfile('Named')
      const id = useSettingsStore.getState().currentProfileId
      const nameBefore = useSettingsStore.getState().profiles.find((p) => p.id === id)?.name
      expect(id).toBeDefined()
      if (id !== undefined) {
        useSettingsStore.getState().renameProfile(id, '   ')
      }
      const nameAfter = useSettingsStore.getState().profiles.find((p) => p.id === id)?.name
      expect(nameAfter).toBe(nameBefore)
    })

    it('renameProfile updates name', () => {
      useSettingsStore.getState().addProfile('Old')
      const id = useSettingsStore.getState().currentProfileId
      expect(id).toBeDefined()
      if (id !== undefined) {
        useSettingsStore.getState().renameProfile(id, 'New')
      }
      const profile = useSettingsStore.getState().profiles.find((p) => p.id === id)
      expect(profile?.name).toBe('New')
    })
  })

  describe('parseImportProfiles', () => {
    it('returns ok: false for invalid JSON', () => {
      const result = useSettingsStore.getState().parseImportProfiles('{')
      expect(result.ok).toBe(false)
    })

    it('returns ok: false for wrong version', () => {
      const result = useSettingsStore
        .getState()
        .parseImportProfiles(JSON.stringify({ version: 2, profiles: [] }))
      expect(result.ok).toBe(false)
    })

    it('returns ok: true and profiles list for valid export', () => {
      const exportJson = useSettingsStore.getState().exportProfiles()
      const result = useSettingsStore.getState().parseImportProfiles(exportJson)
      expect(result.ok).toBe(true)
      if (result.ok && 'profiles' in result) {
        expect(result.profiles.length).toBeGreaterThan(0)
      }
    })

    it('returns ok: true legacy for data.settings (legacy format)', () => {
      const result = useSettingsStore
        .getState()
        .parseImportProfiles(JSON.stringify({ version: 1, settings: {} }))
      expect(result.ok).toBe(true)
      if (result.ok && 'legacy' in result) {
        expect(result.legacy).toBe(true)
      }
    })
  })

  describe('exportProfiles / importProfiles', () => {
    it('exportProfiles returns JSON with version 1', () => {
      const json = useSettingsStore.getState().exportProfiles()
      const data = JSON.parse(json)
      expect(data.version).toBe(1)
      expect(Array.isArray(data.profiles)).toBe(true)
    })

    it('exportProfiles with ids filters profiles', () => {
      useSettingsStore.getState().addProfile('P1')
      const ids = useSettingsStore.getState().profiles.map((p) => p.id)
      const json = useSettingsStore.getState().exportProfiles([ids[0]])
      const data = JSON.parse(json)
      expect(data.profiles).toHaveLength(1)
    })

    it('importProfiles returns ok: false for invalid JSON', () => {
      const result = useSettingsStore.getState().importProfiles('not json')
      expect(result.ok).toBe(false)
    })

    it('importProfiles with valid profiles array adds profiles', () => {
      const baseProfile = useSettingsStore.getState().profiles[0]
      expect(baseProfile).toBeDefined()
      if (!baseProfile) return
      const json = JSON.stringify({
        version: 1,
        profiles: [
          {
            id: 'imported-1',
            name: 'Imported',
            settings: {
              ...baseProfile.settings,
              assistantDisabledNamespaces: ['query', 'invalid-ns'],
            },
          },
        ],
      })
      const result = useSettingsStore.getState().importProfiles(json)
      expect(result.ok).toBe(true)
      const imported = useSettingsStore.getState().profiles.find((p) => p.id === 'imported-1')
      expect(imported?.settings.assistantDisabledNamespaces).toEqual(['query'])
      expect(result.importedCount).toBe(1)
    })

    it('importProfiles with exported profiles JSON adds profiles', () => {
      const json = useSettingsStore.getState().exportProfiles()
      const result = useSettingsStore.getState().importProfiles(json)
      expect(result.ok).toBe(true)
    })

    it('importProfiles with legacy data.settings calls importSettings', () => {
      const legacyJson = JSON.stringify({
        version: 1,
        settings: { readonlyMode: true, defaultViewMode: 'table' },
      })
      const result = useSettingsStore.getState().importProfiles(legacyJson)
      expect(result.ok).toBe(true)
      expect(useSettingsStore.getState().readonlyMode).toBe(true)
      expect(useSettingsStore.getState().defaultViewMode).toBe('table')
    })
  })

  describe('reset and switchProfile', () => {
    it('resetShortcuts restores default preset', () => {
      useSettingsStore.getState().applyShortcutPreset('vim')
      useSettingsStore.getState().resetShortcuts()
      expect(useSettingsStore.getState().activeShortcutPreset).toBe('default')
    })

    it('resetAllSettings resets to defaults', () => {
      useSettingsStore.getState().setReadonlyMode(true)
      useSettingsStore.getState().resetAllSettings()
      expect(useSettingsStore.getState().readonlyMode).toBe(false)
    })

    it('resetDataclassCustomizations clears customizations', () => {
      useSettingsStore.getState().setDataclassCustomization('Employee', { icon: 'User' })
      useSettingsStore.getState().resetDataclassCustomizations()
      expect(useSettingsStore.getState().dataclassCustomizations.Employee).toBeUndefined()
    })

    it('setDataclassPositions preserves presentation metadata and the outer reference', () => {
      useSettingsStore.getState().setDataclassCustomization('Employee', {
        icon: 'User',
        color: 'blue',
      })
      const customizations = useSettingsStore.getState().dataclassCustomizations

      useSettingsStore.getState().setDataclassPositions({ Employee: { x: 120, y: 240 } })

      expect(useSettingsStore.getState().dataclassCustomizations).toBe(customizations)
      expect(useSettingsStore.getState().dataclassCustomizations.Employee).toEqual({
        icon: 'User',
        color: 'blue',
        position: { x: 120, y: 240 },
      })
    })

    it('switchProfile updates current profile', () => {
      useSettingsStore.getState().addProfile('Work')
      const workId = useSettingsStore.getState().currentProfileId
      useSettingsStore.getState().switchProfile(DEFAULT_PROFILE_ID)
      expect(useSettingsStore.getState().currentProfileId).toBe(DEFAULT_PROFILE_ID)
      useSettingsStore.getState().switchProfile(workId)
      expect(useSettingsStore.getState().currentProfileId).toBe(workId)
    })

    it('switchProfile applies default view mode and page size to tabs', () => {
      useSettingsStore.getState().addProfile('Work')
      useSettingsStore.getState().setDefaultViewMode('table')
      useSettingsStore.getState().setPageSize(50)
      const workId = useSettingsStore.getState().currentProfileId
      useSettingsStore.getState().switchProfile(DEFAULT_PROFILE_ID)
      useSettingsStore.getState().switchProfile(workId)
      expect(useSettingsStore.getState().defaultViewMode).toBe('table')
      expect(useSettingsStore.getState().pageSize).toBe(50)
    })

    it('switchProfile does nothing when profile id not found', () => {
      const current = useSettingsStore.getState().currentProfileId
      useSettingsStore.getState().switchProfile('nonexistent-id')
      expect(useSettingsStore.getState().currentProfileId).toBe(current)
    })
  })

  describe('importProfilesByIds', () => {
    it('imports selected profile ids from JSON', () => {
      const json = useSettingsStore.getState().exportProfiles()
      useSettingsStore.getState().addProfile('Extra')
      const ids = useSettingsStore
        .getState()
        .profiles.map((p) => p.id)
        .slice(0, 1)
      const result = useSettingsStore.getState().importProfilesByIds(json, ids)
      expect(result.ok).toBe(true)
    })

    it('returns ok: true with 0 when ids is empty', () => {
      const result = useSettingsStore.getState().importProfilesByIds('{}', [])
      expect(result).toEqual({ ok: true, importedCount: 0 })
    })

    it('returns ok: false for invalid JSON or wrong version', () => {
      expect(useSettingsStore.getState().importProfilesByIds('{', ['default']).ok).toBe(false)
      expect(
        useSettingsStore
          .getState()
          .importProfilesByIds(JSON.stringify({ version: 2, profiles: [] }), ['default']).ok
      ).toBe(false)
      expect(
        useSettingsStore
          .getState()
          .importProfilesByIds(JSON.stringify({ version: 1, profiles: null }), ['default']).ok
      ).toBe(false)
    })

    it('importProfilesByIds with current profile in set merges and returns ok', () => {
      useSettingsStore.getState().addProfile('Other')
      const otherId = useSettingsStore.getState().currentProfileId
      const json = useSettingsStore.getState().exportProfiles()
      useSettingsStore.getState().switchProfile(DEFAULT_PROFILE_ID)
      const result = useSettingsStore
        .getState()
        .importProfilesByIds(json, [DEFAULT_PROFILE_ID, otherId])
      expect(result.ok).toBe(true)
      expect(result.importedCount).toBe(2)
      expect(useSettingsStore.getState().profiles.some((p) => p.id === otherId)).toBe(true)
    })

    it('importProfilesByIds adds profiles not already in store', () => {
      useSettingsStore.getState().addProfile('Exported')
      const exportedId = useSettingsStore.getState().profiles.find((p) => p.name === 'Exported')?.id
      const json = useSettingsStore.getState().exportProfiles()
      useSettingsStore.setState({
        profiles: useSettingsStore.getState().profiles.filter((p) => p.id === DEFAULT_PROFILE_ID),
        currentProfileId: DEFAULT_PROFILE_ID,
      })
      if (exportedId) {
        const result = useSettingsStore.getState().importProfilesByIds(json, [exportedId])
        expect(result.ok).toBe(true)
        expect(useSettingsStore.getState().profiles.some((p) => p.id === exportedId)).toBe(true)
      }
    })
  })

  describe('persist storage', () => {
    it('rehydrates default profile when profiles storage is empty', async () => {
      const { saveProfilesStorage } = await import('~/lib/storage')
      saveProfilesStorage({ current: DEFAULT_PROFILE_ID, profiles: {} })
      await useSettingsStore.persist.rehydrate()
      expect(useSettingsStore.getState().profiles.length).toBeGreaterThan(0)
    })

    it('persist adapter setItem, getItem, removeItem, and parse errors', async () => {
      const storage = useSettingsStore.persist.getOptions().storage
      expect(storage).toBeTruthy()
      if (!storage) return

      const state = useSettingsStore.getState()
      storage.setItem('dataexplorer-settings', {
        state: {
          language: state.language,
          readonlyMode: state.readonlyMode,
          sidebarCollapsed: state.sidebarCollapsed,
          assistantOpen: state.assistantOpen,
          defaultViewMode: state.defaultViewMode,
          defaultEntityViewMode: state.defaultEntityViewMode,
          defaultEditMode: state.defaultEditMode,
          sidebarViewMode: state.sidebarViewMode,
          pageSize: state.pageSize,
          shortcuts: state.shortcuts,
          activeShortcutPreset: state.activeShortcutPreset,
          codeEditorPrefs: state.codeEditorPrefs,
          dataclassCustomizations: state.dataclassCustomizations,
          profiles: state.profiles,
          currentProfileId: state.currentProfileId,
        },
      })
      expect(storage.getItem('dataexplorer-settings')).toBeTruthy()
      storage.setItem('dataexplorer-settings', {
        state: null as unknown as typeof state,
      })
      storage.removeItem('dataexplorer-settings')
      await useSettingsStore.persist.rehydrate()
    })

    it('persist getItem filters invalid assistant namespaces from profiles storage', async () => {
      const { saveProfilesStorage } = await import('~/lib/storage')
      saveProfilesStorage({
        current: DEFAULT_PROFILE_ID,
        profiles: {
          [DEFAULT_PROFILE_ID]: {
            name: 'Default',
            settings: {
              assistantDisabledNamespaces: ['query', 'not-a-real-namespace'],
            },
          },
        },
      })
      const storage = useSettingsStore.persist.getOptions().storage
      const raw = storage?.getItem('dataexplorer-settings')
      expect(raw).toBeTruthy()
      if (!raw) return
      const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
        state: { profiles: Array<{ settings: { assistantDisabledNamespaces: string[] } }> }
      }
      expect(parsed.state.profiles[0]?.settings.assistantDisabledNamespaces).toEqual(['query'])
    })

    it('persist merge fills missing shortcuts from defaults on rehydrate', async () => {
      const storage = useSettingsStore.persist.getOptions().storage
      if (!storage) return
      const state = useSettingsStore.getState()
      storage.setItem('dataexplorer-settings', {
        state: {
          language: state.language,
          readonlyMode: state.readonlyMode,
          sidebarCollapsed: state.sidebarCollapsed,
          assistantOpen: state.assistantOpen,
          defaultViewMode: state.defaultViewMode,
          defaultEntityViewMode: state.defaultEntityViewMode,
          defaultEditMode: state.defaultEditMode,
          sidebarViewMode: state.sidebarViewMode,
          pageSize: state.pageSize,
          shortcuts: [],
          activeShortcutPreset: state.activeShortcutPreset,
          codeEditorPrefs: state.codeEditorPrefs,
          dataclassCustomizations: state.dataclassCustomizations,
          profiles: state.profiles,
          currentProfileId: state.currentProfileId,
        },
      })
      await useSettingsStore.persist.rehydrate()
      expect(useSettingsStore.getState().shortcuts.length).toBeGreaterThan(0)
    })

    it('setCategoryShortcutsEnabled toggles a category', () => {
      useSettingsStore.getState().setCategoryShortcutsEnabled('General', false)
      const disabled = useSettingsStore
        .getState()
        .shortcuts.filter((s) => s.category === 'General')
        .every((s) => !s.enabled)
      expect(disabled).toBe(true)
    })
  })

  describe('assistant and language', () => {
    it('setLanguage updates locale', () => {
      useSettingsStore.getState().setLanguage('fr')
      expect(useSettingsStore.getState().language).toBe('fr')
    })

    it('setAssistantOpen and toggleAssistantOpen', () => {
      useSettingsStore.getState().setAssistantOpen(true)
      expect(useSettingsStore.getState().assistantOpen).toBe(true)
      useSettingsStore.getState().toggleAssistantOpen()
      expect(useSettingsStore.getState().assistantOpen).toBe(false)
    })

    it('setConsoleOpen and toggleConsoleOpen', () => {
      useSettingsStore.getState().setConsoleOpen(true)
      expect(useSettingsStore.getState().consoleOpen).toBe(true)
      useSettingsStore.getState().toggleConsoleOpen()
      expect(useSettingsStore.getState().consoleOpen).toBe(false)
    })
  })

  describe('code editor and export', () => {
    it('updateCodeEditorPrefs merges partial prefs', () => {
      useSettingsStore.getState().updateCodeEditorPrefs({ fontSizeDelta: 2 })
      expect(useSettingsStore.getState().codeEditorPrefs.fontSizeDelta).toBe(2)
    })

    it('exportSettings returns JSON string', () => {
      const json = useSettingsStore.getState().exportSettings()
      expect(JSON.parse(json).version).toBe(1)
    })

    it('importSettings merges legacy settings', () => {
      const ok = useSettingsStore.getState().importSettings(
        JSON.stringify({
          version: 1,
          settings: { readonlyMode: true, defaultViewMode: 'table' },
        })
      )
      expect(ok).toBe(true)
      expect(useSettingsStore.getState().readonlyMode).toBe(true)
    })

    it('importSettings returns false for invalid version', () => {
      expect(
        useSettingsStore.getState().importSettings(JSON.stringify({ version: 2, settings: {} }))
      ).toBe(false)
    })

    it('importProfiles delegates to importSettings for settings-only export', () => {
      const json = useSettingsStore.getState().exportSettings()
      const result = useSettingsStore.getState().importProfiles(json)
      expect(result.ok).toBe(true)
    })

    it('updateProfileAppearance updates icon and color', () => {
      useSettingsStore.getState().updateProfileAppearance(DEFAULT_PROFILE_ID, {
        icon: 'Star',
        color: 'blue',
      })
      const profile = useSettingsStore.getState().profiles.find((p) => p.id === DEFAULT_PROFILE_ID)
      expect(profile?.icon).toBe('Star')
      expect(profile?.color).toBe('blue')
    })

    it('removeProfile falls back when current profile id is missing', () => {
      useSettingsStore.getState().addProfile('Temp')
      const tempId = useSettingsStore.getState().profiles.find((p) => p.name === 'Temp')?.id
      expect(tempId).toBeDefined()
      useSettingsStore.setState({ currentProfileId: 'missing-profile-id' })
      if (tempId) {
        useSettingsStore.getState().removeProfile(tempId)
      }
      expect(useSettingsStore.getState().currentProfileId).toBe(DEFAULT_PROFILE_ID)
    })
  })

  describe('view mode and assistant tool prefs', () => {
    it('setDefaultEntityViewMode and setDefaultEditMode', () => {
      useSettingsStore.getState().setDefaultEntityViewMode('form')
      useSettingsStore.getState().setDefaultEditMode('json')
      expect(useSettingsStore.getState().defaultEntityViewMode).toBe('form')
      expect(useSettingsStore.getState().defaultEditMode).toBe('json')
    })

    it('setSidebarViewMode updates sidebar layout', () => {
      useSettingsStore.getState().setSidebarViewMode('cards')
      expect(useSettingsStore.getState().sidebarViewMode).toBe('cards')
    })

    it('setSidebarSortOption updates dataclass list sort', () => {
      useSettingsStore.getState().setSidebarSortOption('count-desc')
      expect(useSettingsStore.getState().sidebarSortOption).toBe('count-desc')
      useSettingsStore.getState().setSidebarSortOption('name-asc')
      expect(useSettingsStore.getState().sidebarSortOption).toBe('name-asc')
    })

    it('assistant tool preference actions', () => {
      useSettingsStore.getState().setAssistantToolEnabled('@query/run', false)
      expect(useSettingsStore.getState().getAssistantToolPrefs().assistantDisabledTools).toContain(
        '@query/run'
      )
      useSettingsStore.getState().setAssistantToolEnabled('@query/run', true)
      useSettingsStore.getState().setAssistantNamespaceToolsEnabled('query', false)
      useSettingsStore.getState().setAllAssistantToolsEnabled(true)
      expect(useSettingsStore.getState().applyAssistantToolPattern('@query/*', false)).toBe(true)
    })

    it('updateProfileAppearance updates icon and color', () => {
      useSettingsStore.getState().updateProfileAppearance(DEFAULT_PROFILE_ID, {
        icon: 'Star',
        color: '#ff0000',
      })
      const profile = useSettingsStore.getState().profiles.find((p) => p.id === DEFAULT_PROFILE_ID)
      expect(profile?.icon).toBe('Star')
      expect(profile?.color).toBe('#ff0000')
    })

    it('removeProfile falls back when next profile missing', () => {
      useSettingsStore.getState().addProfile('Temp')
      const tempId = useSettingsStore.getState().profiles.find((p) => p.name === 'Temp')?.id
      expect(tempId).toBeDefined()
      if (tempId) {
        useSettingsStore.getState().switchProfile(tempId)
        useSettingsStore.getState().removeProfile(DEFAULT_PROFILE_ID)
        useSettingsStore.getState().removeProfile(tempId)
        expect(useSettingsStore.getState().currentProfileId).toBe(DEFAULT_PROFILE_ID)
      }
    })
  })
})
