import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { getTheme, setCurrentBaseId, setTheme, setThemeName } from '~/lib/storage'
import { useDataExplorerStore } from '~/store'
import { useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { createCommandContext } from './command-context'

describe('lib/command-context', () => {
  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    setTheme('light')
    setThemeName('graphite')
    useSettingsStore.setState({ sidebarCollapsed: false, language: 'en' })
    useTabsStore.setState({ tabs: [], activeTabId: null })
    useDataExplorerStore.setState({ dataclasses: [], selectedDataclass: null, entities: [] })
  })

  it('builds context with store state and noop callbacks', () => {
    const ctx = createCommandContext()
    expect(ctx.theme).toBe('light')
    expect(ctx.sidebarCollapsed).toBe(false)
    expect(typeof ctx.t).toBe('function')
    expect(ctx.onClose()).toBeUndefined()
  })

  it('uses override callbacks when provided', () => {
    let closed = false
    const ctx = createCommandContext({
      onClose: () => {
        closed = true
      },
    })
    ctx.onClose()
    expect(closed).toBe(true)
  })

  it('theme callbacks persist to storage', () => {
    setTheme('dark')
    const ctx = createCommandContext()
    expect(ctx.theme).toBe('dark')
    ctx.toggleTheme()
    expect(getTheme()).toBe('light')
    ctx.setThemeName('graphite')
  })

  it('invokes all context callbacks', () => {
    useTabsStore.getState().openTab('Employee')
    setTheme('light')
    const onClose = mock(() => {})
    const ctx = createCommandContext({ onClose, onShowHelp: onClose })
    ctx.setTheme('dark')
    ctx.toggleTheme()
    ctx.setThemeName('graphite')
    ctx.toggleSidebarCollapsed()
    ctx.selectDataclass('Employee')
    ctx.fetchDataclasses()
    ctx.fetchEntities(1)
    ctx.openTab('Company')
    ctx.openAllDataclasses(['Employee'])
    ctx.openHomeTab()
    void ctx.openGraphTab()
    ctx.setIsEditing(true)
    ctx.setViewMode('table')
    const tabId = useTabsStore.getState().activeTabId
    if (tabId) ctx.togglePinTab(tabId)
    ctx.pinAllTabs()
    ctx.unpinAllTabs()
    ctx.openSettingsTab()
    ctx.toggleReadonlyMode()
    ctx.toggleAssistantOpen()
    ctx.toggleConsoleOpen()
    ctx.onClose()
    ctx.onShowHelp()
    expect(onClose).toHaveBeenCalled()
  })
})
