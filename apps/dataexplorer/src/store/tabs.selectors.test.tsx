import { beforeEach, describe, expect, it } from 'bun:test'
import { Window } from 'happy-dom'
import { act, createElement } from 'react'
import { type Container, createRoot, type Root } from 'react-dom/client'
import { setCurrentBaseId } from '~/lib/storage'
import {
  RELEASE_NOTES_STATIC_ID,
  useActiveAssistantMetadataTab,
  useActiveDataclassName,
  useActiveDataclassTab,
  useActiveGraphTab,
  useActiveRestExportBuilderTab,
  useActiveSchemaBuilderTab,
  useActiveSettingsTab,
  useActiveStaticTab,
  useActiveTab,
  useActiveTabId,
  useIsAssistantMetadataTabActive,
  useIsGraphTabActive,
  useIsHomeTabActive,
  useIsRestExportBuilderTabActive,
  useIsSchemaBuilderTabActive,
  useIsSettingsTabActive,
  useIsStaticTabActive,
  useTabsStore,
} from './tabs'

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

describe('store/tabs selectors', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('useActiveTab and useActiveTabId reflect store state', () => {
    useTabsStore.getState().openTab('Employee')
    const activeId = useTabsStore.getState().activeTabId
    expect(activeId).toBeDefined()
    expect(readHook(useActiveTab)?.id).toBe(activeId ?? undefined)
    expect(readHook(useActiveTabId)).toBe(activeId)
  })

  it('useActiveDataclassTab and useActiveDataclassName', () => {
    useTabsStore.getState().openTab('Employee')
    expect(readHook(useActiveDataclassTab)?.dataclassName).toBe('Employee')
    expect(readHook(useActiveDataclassName)).toBe('Employee')
  })

  it('useIsHomeTabActive when home tab open', () => {
    useTabsStore.getState().openHomeTab()
    expect(readHook(useIsHomeTabActive)).toBe(true)
    expect(readHook(useActiveDataclassTab)).toBeNull()
  })

  it('settings tab selectors', () => {
    useTabsStore.getState().openSettingsTab()
    expect(readHook(useIsSettingsTabActive)).toBe(true)
    expect(readHook(useActiveSettingsTab)?.type).toBe('settings')
  })

  it('graph tab selectors', () => {
    useTabsStore.getState().openGraphTab()
    useTabsStore.getState().notifyGraphTabReady()
    expect(readHook(useIsGraphTabActive)).toBe(true)
    expect(readHook(useActiveGraphTab)?.type).toBe('graph')
  })

  it('static tab selectors', () => {
    useTabsStore.getState().openStaticTab(RELEASE_NOTES_STATIC_ID)
    expect(readHook(useIsStaticTabActive)).toBe(true)
    expect(readHook(useActiveStaticTab)?.staticId).toBe(RELEASE_NOTES_STATIC_ID)
  })

  it('schema builder tab selector', () => {
    useTabsStore.getState().openSchemaBuilderTab()
    expect(readHook(useIsSchemaBuilderTabActive)).toBe(true)
    expect(readHook(useActiveSchemaBuilderTab)?.type).toBe('schema-builder')
  })

  it('rest export builder tab selector', () => {
    useTabsStore.getState().openRestExportBuilderTab()
    expect(readHook(useIsRestExportBuilderTabActive)).toBe(true)
    expect(readHook(useActiveRestExportBuilderTab)?.type).toBe('rest-export-builder')
  })

  it('assistant metadata tab selector', () => {
    useTabsStore.getState().openAssistantMetadataTab()
    expect(readHook(useIsAssistantMetadataTabActive)).toBe(true)
    expect(readHook(useActiveAssistantMetadataTab)?.type).toBe('assistant-metadata')
  })
})
