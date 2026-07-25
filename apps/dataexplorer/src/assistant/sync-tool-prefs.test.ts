import { describe, expect, test } from 'bun:test'
import { createAssistantToolRegistry } from '@4djs/assistant/tools'
import { useSettingsStore } from '~/store/settings'
import { syncAssistantToolPrefs } from './sync-tool-prefs'

describe('syncAssistantToolPrefs', () => {
  test('deactivates tools in disabled namespace', async () => {
    useSettingsStore.setState({
      assistantDisabledNamespaces: ['query'],
      assistantDisabledTools: [],
    })

    const registry = createAssistantToolRegistry()
    registry.register({
      definition: {
        name: '@query/run',
        description: 'test',
        inputSchema: { type: 'object', properties: {} },
      },
      invoke: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })
    registry.register({
      definition: {
        name: '@datastore/query',
        description: 'test',
        inputSchema: { type: 'object', properties: {} },
      },
      invoke: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })

    syncAssistantToolPrefs(registry)

    const tools = await registry.listTools()
    expect(tools.some((t) => t.name === '@query/run')).toBe(false)
    expect(tools.some((t) => t.name === '@datastore/query')).toBe(true)
  })

  test('deactivates all tools when all namespaces disabled', async () => {
    useSettingsStore.setState({
      assistantDisabledNamespaces: [
        'datastore',
        'commands',
        'navigation',
        'appearance',
        'view',
        'entities',
        'query',
        'graph',
        'settings',
        'help',
      ],
      assistantDisabledTools: [],
    })

    const registry = createAssistantToolRegistry()
    registry.register({
      definition: {
        name: '@datastore/catalog',
        description: 'test',
        inputSchema: { type: 'object', properties: {} },
      },
      invoke: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })
    registry.register({
      definition: {
        name: '@commands/list',
        description: 'test',
        inputSchema: { type: 'object', properties: {} },
      },
      invoke: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    })

    syncAssistantToolPrefs(registry)

    const tools = await registry.listTools()
    expect(tools).toHaveLength(0)
  })
})
