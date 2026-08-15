import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  clearProfilesCache,
  DEFAULT_PROFILE_PREFS,
  getBasePickLists,
  getBaseSettings,
  getConsoleHeight,
  getCurrentBaseId,
  getCurrentPrefs,
  getDataclassCustomizations,
  getEntityListHeight,
  getEntityListWidth,
  getGraphEditorState,
  getHttpClientRequestHeight,
  getHttpClientRequestWidth,
  getMethodExecutorRequestHeight,
  getMethodExecutorRequestWidth,
  getProfilesStorage,
  getRecentCommands,
  getSidebarWidth,
  getTheme,
  getThemeName,
  readDataclassCustomizationsForRehydrate,
  saveBasePickLists,
  saveBaseSettings,
  saveDataclassCustomizations,
  saveGraphEditorState,
  saveProfilesStorage,
  saveRecentCommand,
  setConsoleHeight,
  setCurrentBaseId,
  setEntityListHeight,
  setEntityListWidth,
  setHttpClientRequestHeight,
  setHttpClientRequestWidth,
  setMethodExecutorRequestHeight,
  setMethodExecutorRequestWidth,
  setSidebarWidth,
  setTheme,
  setThemeName,
  subscribeToStorageChanges,
} from './storage'

const PROFILES_KEY = 'dataexplorer:profiles' // must match storage.ts internal key
const BASE_KEY_PREFIX = 'dataexplorer:bases:'

function clearTestLocalStorage(): void {
  try {
    localStorage.removeItem(PROFILES_KEY)
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(BASE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore if localStorage not available
  }
}

describe('storage', () => {
  beforeEach(() => {
    clearProfilesCache()
    setCurrentBaseId('')
    clearTestLocalStorage()
  })

  afterEach(() => {
    clearProfilesCache()
  })

  describe('DEFAULT_PROFILE_PREFS', () => {
    it('has required shape and default values', () => {
      expect(DEFAULT_PROFILE_PREFS).toBeDefined()
      expect(DEFAULT_PROFILE_PREFS.version).toBe(1)
      expect(DEFAULT_PROFILE_PREFS.theme).toBe('dark')
      expect(DEFAULT_PROFILE_PREFS.themeName).toBe('tangerine')
      expect(DEFAULT_PROFILE_PREFS.panels).toEqual({
        sidebar: { width: 325 },
        entitylist: { width: 40, height: 45 },
        console: { height: 220 },
        methodExecutor: { width: 40, height: 45 },
        httpClient: { width: 50, height: 45 },
      })
      expect(Array.isArray(DEFAULT_PROFILE_PREFS.recentCommands)).toBe(true)
      expect(DEFAULT_PROFILE_PREFS.recentCommands).toHaveLength(0)
    })
  })

  describe('getProfilesStorage', () => {
    it('returns default profiles when localStorage is empty', () => {
      const data = getProfilesStorage()
      expect(data.current).toBe('default')
      expect(data.profiles.default).toBeDefined()
      expect(data.profiles.default.name).toBe('Default')
      expect(data.profiles.default.settings.theme).toBe('dark')
      expect(data.profiles.default.settings.themeName).toBe('tangerine')
    })

    it('returns cached data on second call', () => {
      const first = getProfilesStorage()
      first.current = 'other'
      const second = getProfilesStorage()
      expect(second.current).toBe('other')
    })

    it('parses valid stored data', () => {
      localStorage.setItem(
        PROFILES_KEY,
        JSON.stringify({
          current: 'custom',
          profiles: {
            custom: { name: 'Custom', settings: { theme: 'dark' } },
          },
        })
      )
      clearProfilesCache()
      const data = getProfilesStorage()
      expect(data.current).toBe('custom')
      expect(data.profiles.custom?.name).toBe('Custom')
      expect(data.profiles.custom?.settings.theme).toBe('dark')
    })

    it('returns default when stored data is invalid', () => {
      localStorage.setItem(PROFILES_KEY, 'not json')
      clearProfilesCache()
      const data = getProfilesStorage()
      expect(data.current).toBe('default')
      expect(data.profiles.default).toBeDefined()
    })
  })

  describe('clearProfilesCache', () => {
    it('clears cache so next getProfilesStorage reads from localStorage', () => {
      getProfilesStorage()
      localStorage.setItem(
        PROFILES_KEY,
        JSON.stringify({ current: 'x', profiles: { x: { name: 'X', settings: {} } } })
      )
      clearProfilesCache()
      const data = getProfilesStorage()
      expect(data.current).toBe('x')
    })
  })

  describe('saveProfilesStorage', () => {
    it('persists and updates cache', () => {
      const data = getProfilesStorage()
      data.current = 'saved'
      data.profiles.saved = { name: 'Saved', settings: {} }
      saveProfilesStorage(data)
      clearProfilesCache()
      const loaded = getProfilesStorage()
      expect(loaded.current).toBe('saved')
      expect(loaded.profiles.saved).toBeDefined()
    })
  })

  describe('getCurrentPrefs', () => {
    it('returns normalized prefs with panels', () => {
      const prefs = getCurrentPrefs()
      expect(prefs.theme).toBeDefined()
      expect(prefs.panels.sidebar).toBeDefined()
      expect(prefs.panels.entitylist).toBeDefined()
      expect(prefs.panels.console).toBeDefined()
      expect(prefs.panels.methodExecutor).toBeDefined()
      expect(prefs.panels.httpClient).toBeDefined()
      expect(prefs.panels.sidebar?.width).toBe(325)
      expect(prefs.panels.entitylist?.width).toBe(40)
      expect(prefs.panels.entitylist?.height).toBe(45)
      expect(prefs.panels.console?.height).toBe(220)
      expect(prefs.panels.methodExecutor?.width).toBe(40)
      expect(prefs.panels.methodExecutor?.height).toBe(45)
      expect(prefs.panels.httpClient?.width).toBe(50)
      expect(prefs.panels.httpClient?.height).toBe(45)
    })
  })

  describe('theme helpers', () => {
    it('getTheme returns current theme', () => {
      expect(getTheme()).toBe('dark')
    })

    it('setTheme persists theme', () => {
      setTheme('dark')
      clearProfilesCache()
      expect(getTheme()).toBe('dark')
      setTheme('light')
    })

    it('getThemeName and setThemeName', () => {
      expect(getThemeName()).toBe('tangerine')
      setThemeName('slate')
      clearProfilesCache()
      expect(getThemeName()).toBe('slate')
      setThemeName('tangerine')
    })
  })

  describe('panel helpers', () => {
    it('getSidebarWidth returns default then persisted value', () => {
      expect(getSidebarWidth()).toBe(325)
      setSidebarWidth(400)
      clearProfilesCache()
      expect(getSidebarWidth()).toBe(400)
      setSidebarWidth(325)
    })

    it('getEntityListWidth and setEntityListWidth', () => {
      expect(getEntityListWidth()).toBe(40)
      setEntityListWidth(50)
      clearProfilesCache()
      expect(getEntityListWidth()).toBe(50)
      setEntityListWidth(40)
    })

    it('getEntityListHeight and setEntityListHeight', () => {
      expect(getEntityListHeight()).toBe(45)
      setEntityListHeight(55)
      clearProfilesCache()
      expect(getEntityListHeight()).toBe(55)
      // Width is preserved when updating height
      setEntityListWidth(48)
      setEntityListHeight(30)
      clearProfilesCache()
      expect(getEntityListWidth()).toBe(48)
      expect(getEntityListHeight()).toBe(30)
      setEntityListWidth(40)
      setEntityListHeight(45)
    })

    it('getMethodExecutorRequestHeight and setMethodExecutorRequestHeight', () => {
      expect(getMethodExecutorRequestHeight()).toBe(45)
      setMethodExecutorRequestHeight(60)
      clearProfilesCache()
      expect(getMethodExecutorRequestHeight()).toBe(60)
      setMethodExecutorRequestWidth(35)
      setMethodExecutorRequestHeight(25)
      clearProfilesCache()
      expect(getMethodExecutorRequestWidth()).toBe(35)
      expect(getMethodExecutorRequestHeight()).toBe(25)
      setMethodExecutorRequestWidth(40)
      setMethodExecutorRequestHeight(45)
    })

    it('getHttpClientRequestHeight and setHttpClientRequestHeight', () => {
      expect(getHttpClientRequestHeight()).toBe(45)
      setHttpClientRequestHeight(55)
      clearProfilesCache()
      expect(getHttpClientRequestHeight()).toBe(55)
      setHttpClientRequestWidth(42)
      setHttpClientRequestHeight(28)
      clearProfilesCache()
      expect(getHttpClientRequestWidth()).toBe(42)
      expect(getHttpClientRequestHeight()).toBe(28)
      setHttpClientRequestWidth(50)
      setHttpClientRequestHeight(45)
    })

    it('getConsoleHeight and setConsoleHeight', () => {
      expect(getConsoleHeight()).toBe(220)
      setConsoleHeight(300)
      clearProfilesCache()
      expect(getConsoleHeight()).toBe(300)
      setConsoleHeight(220)
    })
  })

  describe('recent commands', () => {
    it('getRecentCommands returns array', () => {
      expect(getRecentCommands()).toEqual([])
    })

    it('saveRecentCommand adds and deduplicates', () => {
      saveRecentCommand('cmd1')
      expect(getRecentCommands().map((c) => c.id)).toContain('cmd1')
      saveRecentCommand('cmd2')
      expect(getRecentCommands()).toHaveLength(2)
      saveRecentCommand('cmd1')
      expect(getRecentCommands()[0]?.id).toBe('cmd1')
      expect(getRecentCommands()).toHaveLength(2)
    })
  })

  describe('base BASEID', () => {
    it('setCurrentBaseId and getCurrentBaseId', () => {
      setCurrentBaseId('test-uniq-123')
      expect(getCurrentBaseId()).toBe('test-uniq-123')
    })
  })

  describe('base settings', () => {
    it('getBaseSettings returns defaults when no uniqid', () => {
      setCurrentBaseId('')
      const base = getBaseSettings()
      expect(base.tabs).toEqual([])
      expect(base.activeTabId).toBeNull()
      expect(base.dataclassCustomizations).toEqual({})
    })

    it('saveBaseSettings and getBaseSettings when uniqid set', () => {
      setCurrentBaseId('base-1')
      saveBaseSettings({ activeTabId: 'tab-1' })
      expect(getBaseSettings().activeTabId).toBe('tab-1')
      setCurrentBaseId('')
    })
  })

  describe('dataclass customizations', () => {
    it('getDataclassCustomizations and saveDataclassCustomizations', () => {
      setCurrentBaseId('base-dc')
      expect(getDataclassCustomizations()).toEqual({})
      saveDataclassCustomizations({ Employee: { columns: ['name'] } })
      expect(getDataclassCustomizations()).toEqual({ Employee: { columns: ['name'] } })
      setCurrentBaseId('')
    })

    it('readDataclassCustomizationsForRehydrate reads base key before BASEID is set', () => {
      setCurrentBaseId('base-rehydrate')
      saveDataclassCustomizations({ Agency: { icon: 'ChartBar', color: 'lime' } })
      setCurrentBaseId('')
      expect(readDataclassCustomizationsForRehydrate()).toEqual({
        Agency: { icon: 'ChartBar', color: 'lime' },
      })
    })
  })

  describe('graph editor state', () => {
    it('getGraphEditorState and saveGraphEditorState', () => {
      setCurrentBaseId('base-graph')
      expect(getGraphEditorState()).toEqual({})
      saveGraphEditorState({ zoom: 1.5, relationFilter: 'all' })
      expect(getGraphEditorState().zoom).toBe(1.5)
      expect(getGraphEditorState().relationFilter).toBe('all')
      setCurrentBaseId('')
    })
  })

  describe('base pick lists', () => {
    it('defaults to empty when settings omit pickLists', () => {
      setCurrentBaseId('base-pick-legacy')
      saveBaseSettings({ activeTabId: null })
      expect(getBasePickLists()).toEqual([])
      expect(getBaseSettings().pickLists).toBeUndefined()
      setCurrentBaseId('')
    })

    it('persists declarations per base and scopes them by BASEID', () => {
      setCurrentBaseId('base-pick-a')
      saveBasePickLists([
        {
          id: '1',
          name: 'companyKeys',
          type: 'dataclass' as const,
          dataclass: 'Company',
          attribute: 'ID',
        },
      ])
      expect(getBasePickLists()).toEqual([
        { id: '1', name: 'companyKeys', type: 'dataclass', dataclass: 'Company', attribute: 'ID' },
      ])

      setCurrentBaseId('base-pick-b')
      expect(getBasePickLists()).toEqual([])
      saveBasePickLists([
        {
          id: '2',
          name: 'roleNames',
          type: 'dataclass' as const,
          dataclass: 'Role',
          attribute: 'name',
        },
      ])
      expect(getBasePickLists()).toEqual([
        { id: '2', name: 'roleNames', type: 'dataclass', dataclass: 'Role', attribute: 'name' },
      ])

      setCurrentBaseId('base-pick-a')
      expect(getBasePickLists()).toEqual([
        { id: '1', name: 'companyKeys', type: 'dataclass', dataclass: 'Company', attribute: 'ID' },
      ])
      setCurrentBaseId('')
    })
  })

  describe('subscribeToStorageChanges', () => {
    it('returns unsubscribe function', () => {
      const unsubscribe = subscribeToStorageChanges(() => {})
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })
  })
})
