import { beforeEach, describe, expect, test } from 'bun:test'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { setCurrentBaseId } from '~/lib/storage'
import { useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { buildSettingsTools } from './settings'

function requireTool(tools: AssistantToolHandler[], name: string): AssistantToolHandler {
  const tool = tools.find((t) => t.definition.name === name)
  if (!tool) throw new Error(`Tool not found: ${name}`)
  return tool
}

describe('buildSettingsTools', () => {
  const tools = buildSettingsTools()

  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  test('@settings/open opens settings tab', async () => {
    const result = await requireTool(tools, '@settings/open').invoke({})
    expect(result.isError).toBeFalsy()
    expect(useTabsStore.getState().tabs.some((t) => t.type === 'settings')).toBe(true)
  })

  test('@settings/update applies valid keys and rejects invalid values', async () => {
    const update = requireTool(tools, '@settings/update')
    expect((await update.invoke({ key: 'defaultViewMode', value: 'table' })).isError).toBeFalsy()
    expect((await update.invoke({ key: 'defaultViewMode', value: 'bad' })).isError).toBe(true)
    expect(
      (await update.invoke({ key: 'defaultEntityViewMode', value: 'form' })).isError
    ).toBeFalsy()
    expect((await update.invoke({ key: 'defaultEntityViewMode', value: 'bad' })).isError).toBe(true)
    expect((await update.invoke({ key: 'defaultEditMode', value: 'json' })).isError).toBeFalsy()
    expect((await update.invoke({ key: 'defaultEditMode', value: 'bad' })).isError).toBe(true)
    expect((await update.invoke({ key: 'sidebarViewMode', value: 'icons' })).isError).toBeFalsy()
    expect((await update.invoke({ key: 'sidebarViewMode', value: 'bad' })).isError).toBe(true)
    expect((await update.invoke({ key: 'pageSize', value: 25 })).isError).toBeFalsy()
    expect((await update.invoke({ key: 'language', value: 'fr' })).isError).toBeFalsy()
    expect((await update.invoke({ key: 'language', value: 'de' })).isError).toBe(true)
    expect((await update.invoke({ key: 'unknown', value: 'x' })).isError).toBe(true)
  })

  test('@settings/toggle-readonly toggles or sets readonly mode', async () => {
    const toggle = requireTool(tools, '@settings/toggle-readonly')
    const before = useSettingsStore.getState().readonlyMode
    expect((await toggle.invoke({})).isError).toBeFalsy()
    expect(useSettingsStore.getState().readonlyMode).toBe(!before)
    await toggle.invoke({ enabled: true })
    expect(useSettingsStore.getState().readonlyMode).toBe(true)
    await toggle.invoke({ enabled: false })
    expect(useSettingsStore.getState().readonlyMode).toBe(false)
  })

  test('@settings/profile read and error branches', async () => {
    const profile = requireTool(tools, '@settings/profile')
    expect((await profile.invoke({ action: 'current' })).isError).toBeFalsy()
    expect((await profile.invoke({ action: 'switch' })).isError).toBe(true)
    expect((await profile.invoke({ action: 'rename' })).isError).toBe(true)
    expect((await profile.invoke({ action: 'duplicate' })).isError).toBe(true)
    expect((await profile.invoke({ action: 'remove' })).isError).toBe(true)
  })

  test('@settings/profile mutating actions', async () => {
    const profile = requireTool(tools, '@settings/profile')
    await profile.invoke({ action: 'add', name: 'ToolProfile' })
    const list = JSON.parse(
      (await profile.invoke({ action: 'list' })).content[0]?.text ?? '{}'
    ) as {
      profiles: Array<{ id: string; name: string }>
    }
    const added = list.profiles.find((p) => p.name === 'ToolProfile')
    expect(added).toBeTruthy()
    if (added) {
      await profile.invoke({ action: 'switch', profileId: added.id })
      await profile.invoke({ action: 'rename', profileId: added.id, name: 'Renamed' })
      const renamed = useSettingsStore.getState().profiles.find((p) => p.name === 'Renamed')
      if (renamed) {
        await profile.invoke({ action: 'duplicate', profileId: renamed.id })
        await profile.invoke({ action: 'remove', profileId: renamed.id })
      }
    }
    expect((await profile.invoke({ action: 'unknown' })).isError).toBe(true)
  })

  test('@settings/dataclass-customization set/remove/reset-all', async () => {
    const tool = requireTool(tools, '@settings/dataclass-customization')
    await tool.invoke({ action: 'set', dataclassName: 'Employee', icon: 'User', color: '#fff' })
    expect(useSettingsStore.getState().dataclassCustomizations.Employee?.icon).toBe('User')
    await tool.invoke({ action: 'remove', dataclassName: 'Employee' })
    expect(useSettingsStore.getState().dataclassCustomizations.Employee).toBeUndefined()
    await tool.invoke({ action: 'set', dataclassName: 'Dept', description: 'desc' })
    await tool.invoke({ action: 'reset-all' })
    expect(Object.keys(useSettingsStore.getState().dataclassCustomizations)).toHaveLength(0)
    expect((await tool.invoke({ action: 'set' })).isError).toBe(true)
    expect((await tool.invoke({ action: 'remove' })).isError).toBe(true)
    expect((await tool.invoke({ action: 'bad' })).isError).toBe(true)
  })

  test('@settings/export and import all scopes', async () => {
    const exported = JSON.parse(
      (await requireTool(tools, '@settings/export').invoke({ scope: 'settings' })).content[0]
        ?.text ?? '{}'
    )
    expect(exported.json).toBeTruthy()
    const profilesJson = JSON.parse(
      (await requireTool(tools, '@settings/export').invoke({ scope: 'profiles' })).content[0]
        ?.text ?? '{}'
    )
    expect(profilesJson.json).toBeTruthy()
    const profileIdsJson = JSON.parse(
      (
        await requireTool(tools, '@settings/export').invoke({
          scope: 'profile-ids',
          profileIds: ['default'],
        })
      ).content[0]?.text ?? '{}'
    )
    expect(profileIdsJson.json).toBeTruthy()
    expect((await requireTool(tools, '@settings/export').invoke({ scope: 'bad' })).isError).toBe(
      true
    )

    expect(
      (
        await requireTool(tools, '@settings/import').invoke({
          scope: 'settings',
          json: exported.json,
        })
      ).isError
    ).toBeFalsy()
    expect(
      (
        await requireTool(tools, '@settings/import').invoke({
          scope: 'profiles',
          json: profilesJson.json,
        })
      ).isError
    ).toBeFalsy()
    expect(
      (
        await requireTool(tools, '@settings/import').invoke({
          scope: 'profile-ids',
          json: profileIdsJson.json,
          profileIds: ['default'],
        })
      ).isError
    ).toBeFalsy()
    expect(
      (await requireTool(tools, '@settings/import').invoke({ scope: 'settings', json: '' })).isError
    ).toBe(true)
    expect(
      (await requireTool(tools, '@settings/import').invoke({ scope: 'bad', json: '{}' })).isError
    ).toBe(true)
    expect(
      (await requireTool(tools, '@settings/import').invoke({ scope: 'settings', json: 'not-json' }))
        .isError
    ).toBe(true)
  })

  test('@settings/reset resets settings', async () => {
    useSettingsStore.getState().setReadonlyMode(true)
    await requireTool(tools, '@settings/reset').invoke({})
    expect(useSettingsStore.getState().readonlyMode).toBe(false)
  })

  test('@settings/assistant-tools list enable disable', async () => {
    const meta = requireTool(tools, '@settings/assistant-tools')
    expect((await meta.invoke({ action: 'list' })).isError).toBeFalsy()
    expect((await meta.invoke({ action: 'disable', pattern: '@query/*' })).isError).toBeFalsy()
    expect((await meta.invoke({ action: 'enable', pattern: '@query/*' })).isError).toBeFalsy()
    expect((await meta.invoke({ action: 'enable' })).isError).toBe(true)
    expect((await meta.invoke({ action: 'enable', pattern: '!!!' })).isError).toBe(true)
    expect((await meta.invoke({ action: 'bad', pattern: '*' })).isError).toBe(true)
  })
})
