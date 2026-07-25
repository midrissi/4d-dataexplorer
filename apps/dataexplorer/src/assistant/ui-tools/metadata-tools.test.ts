import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { type AssistantToolHandler, createAssistantToolRegistry } from '@4djs/assistant/tools'
import { configureTestLlm, mockLlmFetch, unconfigureTestLlm } from '~/lib/metadata-llm.test-helper'
import { setCurrentBaseId } from '~/lib/storage'
import { buildMetadataTools } from './metadata'

function requireTool(tools: AssistantToolHandler[], name: string): AssistantToolHandler {
  const tool = tools.find((entry) => entry.definition.name === name)
  if (!tool) throw new Error(`Tool not found: ${name}`)
  return tool
}

describe('@metadata tools', () => {
  const tools = buildMetadataTools(createAssistantToolRegistry())

  beforeEach(() => {
    setCurrentBaseId('test-uniq')
  })

  test('registers metadata tools', () => {
    expect(tools.map((tool) => tool.definition.name)).toEqual([
      '@metadata/state',
      '@metadata/generate-descriptions',
      '@metadata/clear-descriptions',
      '@metadata/update-descriptions',
    ])
  })

  test('@metadata/state returns counts from catalog metadata', async () => {
    const result = await requireTool(tools, '@metadata/state').invoke({
      include: ['dataclass', 'attribute'],
      excludeAttributes: { idLike: true },
    })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      taskCount: number
      llmConfigured: boolean
    }
    expect(typeof data.taskCount).toBe('number')
    expect(typeof data.llmConfigured).toBe('boolean')
  })

  test('@metadata/clear-descriptions clears documented fields', async () => {
    const result = await requireTool(tools, '@metadata/clear-descriptions').invoke({})
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as { cleared: number }
    expect(typeof data.cleared).toBe('number')
  })

  test('@metadata/update-descriptions applies manual updates', async () => {
    const result = await requireTool(tools, '@metadata/update-descriptions').invoke({
      updates: [{ type: 'dataclass', dataclassName: 'Employee', description: 'Test employees' }],
    })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as { updated: number }
    expect(data.updated).toBe(1)
  })

  test('@metadata/generate-descriptions requires configured LLM', async () => {
    const result = await requireTool(tools, '@metadata/generate-descriptions').invoke({
      include: ['dataclass', 'attribute'],
      excludeAttributes: { idLike: true },
    })
    expect(result.isError).toBe(true)
  })
})

describe('@metadata tools with configured LLM', () => {
  const registry = createAssistantToolRegistry()
  const tools = buildMetadataTools(registry)
  let restoreFetch: (() => void) | undefined

  beforeEach(() => {
    setCurrentBaseId('test-uniq')
    configureTestLlm()
    restoreFetch = mockLlmFetch('Generated description').restore
  })

  afterEach(() => {
    restoreFetch?.()
    unconfigureTestLlm()
  })

  test('@metadata/generate-descriptions generates descriptions and opens editor', async () => {
    const result = await requireTool(tools, '@metadata/generate-descriptions').invoke({
      include: ['dataclass'],
      openMetadataEditor: true,
    })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      generated: number
      planned: number
    }
    expect(data.generated).toBeGreaterThan(0)
    expect(data.planned).toBeGreaterThan(0)
  })

  test('@metadata/generate-descriptions reports when no tasks match', async () => {
    const result = await requireTool(tools, '@metadata/generate-descriptions').invoke({
      dataclassNames: ['NonExistentClass'],
    })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]?.text ?? '{}') as {
      generated: number
      message: string
    }
    expect(data.generated).toBe(0)
    expect(data.message).toContain('No metadata')
  })
})

describe('@metadata tools update/clear edge cases', () => {
  const registry = createAssistantToolRegistry()
  const tools = buildMetadataTools(registry)

  beforeEach(() => {
    setCurrentBaseId('test-uniq')
  })

  test('@metadata/update-descriptions rejects empty updates', async () => {
    const result = await requireTool(tools, '@metadata/update-descriptions').invoke({
      updates: [],
    })
    expect(result.isError).toBe(true)
  })

  test('@metadata/update-descriptions reports errors for unknown targets', async () => {
    const result = await requireTool(tools, '@metadata/update-descriptions').invoke({
      updates: [{ type: 'dataclass', dataclassName: 'Unknown', description: 'x' }],
    })
    expect(result.isError).toBe(true)
  })

  test('@metadata/clear-descriptions accepts filter properties', async () => {
    const result = await requireTool(tools, '@metadata/clear-descriptions').invoke({
      include: ['dataclass', 'attribute'],
      dataclassNames: ['Employee'],
      excludeDataclasses: ['Company'],
      excludeAttributes: {
        names: ['id'],
        namePattern: 'ID$',
        idLike: true,
        identifying: true,
        primaryKeys: true,
      },
      clearArguments: true,
      openMetadataEditor: true,
    })
    expect(result.isError).toBeFalsy()
  })
})
