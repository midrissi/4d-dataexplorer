import { beforeEach, describe, expect, it } from 'bun:test'
import { Window } from 'happy-dom'
import { act, createElement } from 'react'
import { type Container, createRoot, type Root } from 'react-dom/client'
import { clearProfilesCache, setCurrentBaseId } from '~/lib/storage'
import {
  DEFAULT_PROFILE_ID,
  useActiveShortcutPreset,
  useAssistantOpen,
  useCodeEditorPrefs,
  useDataclassCustomization,
  useDataclassCustomizations,
  useDefaultEditMode,
  useDefaultEntityViewMode,
  useDefaultViewMode,
  usePageSize,
  useProfiles,
  useReadonlyMode,
  useSettingsStore,
  useShortcut,
  useShortcuts,
  useSidebarCollapsed,
  useSidebarSortOption,
  useSidebarViewMode,
  useUpdateCodeEditorPrefs,
} from './settings'

function withDom<T>(run: (dom: Window) => T): T {
  const dom = new Window()
  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
  }
  ;(dom.window as Window & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  try {
    return run(dom)
  } finally {
    Object.assign(globalThis, prev)
  }
}

function readHook<T>(useHook: () => T): T {
  return withDom((dom) => {
    let value!: T
    const container = dom.document.createElement('div')
    const root: Root = createRoot(container as unknown as Container)

    function Probe() {
      value = useHook()
      return null
    }

    act(() => {
      root.render(createElement(Probe))
    })
    act(() => {
      root.unmount()
    })

    return value
  })
}

describe('store/settings selectors', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    clearProfilesCache()
    useSettingsStore.setState({
      readonlyMode: true,
      sidebarCollapsed: true,
      assistantOpen: true,
      defaultViewMode: 'table',
      defaultEntityViewMode: 'json',
      defaultEditMode: 'json',
      sidebarViewMode: 'icons',
      sidebarSortOption: 'count-desc',
      pageSize: 25,
      currentProfileId: DEFAULT_PROFILE_ID,
    })
    useSettingsStore.getState().setDataclassCustomization('Employee', { icon: 'User' })
  })

  it('reads core preference hooks', () => {
    expect(readHook(useReadonlyMode)).toBe(true)
    expect(readHook(useSidebarCollapsed)).toBe(true)
    expect(readHook(useAssistantOpen)).toBe(true)
    expect(readHook(useDefaultViewMode)).toBe('table')
    expect(readHook(useDefaultEntityViewMode)).toBe('json')
    expect(readHook(useDefaultEditMode)).toBe('json')
    expect(readHook(useSidebarViewMode)).toBe('icons')
    expect(readHook(useSidebarSortOption)).toBe('count-desc')
    expect(readHook(usePageSize)).toBe(25)
  })

  it('reads shortcuts and dataclass hooks', () => {
    expect(readHook(useShortcuts).length).toBeGreaterThan(0)
    expect(readHook(() => useShortcut('command-palette'))?.id).toBe('command-palette')
    expect(readHook(useDataclassCustomizations).Employee?.icon).toBe('User')
    expect(readHook(() => useDataclassCustomization('Employee'))?.icon).toBe('User')
    expect(readHook(useActiveShortcutPreset)).toBeTruthy()
  })

  it('reads code editor and profile hooks', () => {
    expect(readHook(useCodeEditorPrefs)).toBeTruthy()
    expect(typeof readHook(useUpdateCodeEditorPrefs)).toBe('function')
    expect(readHook(useProfiles).some((p) => p.id === DEFAULT_PROFILE_ID)).toBe(true)
  })
})
