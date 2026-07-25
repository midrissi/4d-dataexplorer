import { describe, expect, test } from 'bun:test'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { eventBus } from '~/lib/eventBus'
import { buildHelpTools } from './help'
import { buildSettingsTools } from './settings'

function requireTool(tools: AssistantToolHandler[], name: string): AssistantToolHandler {
  const tool = tools.find((t) => t.definition.name === name)
  if (!tool) {
    throw new Error(`Tool not found: ${name}`)
  }
  return tool
}

describe('@help/shortcuts', () => {
  const tools = buildHelpTools()

  test('lists shortcuts matching query', async () => {
    const tool = requireTool(tools, '@help/shortcuts')
    const result = await tool.invoke({ action: 'list', query: 'structure' })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      shortcuts: Array<{ id: string }>
    }
    expect(data.shortcuts.some((s) => s.id === 'open-structure')).toBe(true)
  })

  test('lists shortcut by id', async () => {
    const tool = requireTool(tools, '@help/shortcuts')
    const result = await tool.invoke({ action: 'list', id: 'open-structure' })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      shortcuts: Array<{ id: string; keys: string }>
    }
    expect(data.shortcuts).toHaveLength(1)
    expect(data.shortcuts[0]?.keys.length).toBeGreaterThan(0)
  })

  test('filters by category and opens modal', async () => {
    const tool = requireTool(tools, '@help/shortcuts')
    const list = await tool.invoke({ action: 'list', category: 'General' })
    expect(list.isError).toBeFalsy()
    const data = JSON.parse(list.content[0]?.text ?? '{}') as { count: number }
    expect(data.count).toBeGreaterThan(0)

    let emitted = false
    const sub = eventBus.on('show-keyboard-shortcuts', () => {
      emitted = true
    })
    const open = await tool.invoke({ action: 'open' })
    sub.unsubscribe()
    expect(open.isError).toBeFalsy()
    expect(emitted).toBe(true)
  })
})

describe('@settings/state', () => {
  const tools = buildSettingsTools()

  test('returns configuration snapshot', async () => {
    const tool = requireTool(tools, '@settings/state')
    const result = await tool.invoke({})
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      profile: { name: string } | null
      theme: string
      themeName: string
      language: string
    }
    expect(data.theme).toBeTruthy()
    expect(data.themeName).toBeTruthy()
    expect(data.language).toBeTruthy()
  })
})

describe('@settings/profile read actions', () => {
  const tools = buildSettingsTools()

  test('returns current profile', async () => {
    const tool = requireTool(tools, '@settings/profile')
    const result = await tool.invoke({ action: 'current' })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      currentProfileId: string
      profile: { name: string } | null
    }
    expect(data.currentProfileId).toBeTruthy()
    expect(data.profile?.name).toBeTruthy()
  })

  test('lists profiles', async () => {
    const tool = requireTool(tools, '@settings/profile')
    const result = await tool.invoke({ action: 'list' })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      profiles: Array<{ isCurrent: boolean }>
    }
    expect(data.profiles.length).toBeGreaterThan(0)
    expect(data.profiles.some((p) => p.isCurrent)).toBe(true)
  })
})
