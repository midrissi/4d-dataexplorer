import { describe, expect, test } from 'bun:test'
import type { AssistantToolHandler } from '@4djs/assistant/tools'
import { buildCommandTools } from './commands'

function requireTool(tools: AssistantToolHandler[], name: string): AssistantToolHandler {
  const tool = tools.find((t) => t.definition.name === name)
  if (!tool) {
    throw new Error(`Tool not found: ${name}`)
  }
  return tool
}

describe('@commands tools', () => {
  const tools = buildCommandTools()

  test('@commands/list returns commands', async () => {
    const listTool = requireTool(tools, '@commands/list')
    const result = await listTool.invoke({})
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      commands: Array<{ id: string }>
    }
    expect(data.commands.some((c) => c.id === 'open-home')).toBe(true)
  })

  test('@commands/execute runs open-home', async () => {
    const executeTool = requireTool(tools, '@commands/execute')
    const result = await executeTool.invoke({ commandId: 'open-home' })
    expect(result.isError).toBeFalsy()
  })

  test('@commands/open emits palette mode', async () => {
    const openTool = requireTool(tools, '@commands/open')
    const result = await openTool.invoke({ mode: 'go-to' })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as { mode: string }
    expect(data.mode).toBe('go-to')
  })
})
