import { describe, expect, test } from 'bun:test'
import {
  ASSISTANT_TOOL_CATALOG,
  ASSISTANT_TOOL_NAMESPACES,
  type AssistantToolPrefs,
  applyToolPattern,
  getAssistantToolPrefsSummary,
  getToolNamespace,
  getToolsByNamespace,
  isDynamicMethodToolName,
  isToolEnabled,
  parseToolPattern,
} from './tool-catalog'

describe('tool-catalog patterns', () => {
  test('parseToolPattern handles wildcard, namespace, and tool patterns', () => {
    expect(parseToolPattern('*')).toEqual({ type: 'all' })
    expect(parseToolPattern('@query/*')).toEqual({ type: 'namespace', namespace: 'query' })
    expect(parseToolPattern('@query/set-options')).toEqual({
      type: 'tool',
      toolName: '@query/set-options',
      namespace: 'query',
    })
    expect(parseToolPattern('invalid')).toBeNull()
  })

  test('applyToolPattern disables and enables namespace', () => {
    const disabled = applyToolPattern(
      { assistantDisabledNamespaces: [], assistantDisabledTools: [] },
      '@query/*',
      false
    )
    expect(disabled.assistantDisabledNamespaces).toContain('query')
    expect(isToolEnabled('@query/run', disabled)).toBe(false)
    expect(isToolEnabled('@datastore/query', disabled)).toBe(true)

    const enabled = applyToolPattern(disabled, '@query/*', true)
    expect(enabled.assistantDisabledNamespaces).not.toContain('query')
    expect(isToolEnabled('@query/run', enabled)).toBe(true)
  })

  test('isToolEnabled rejects unknown namespaces', () => {
    expect(
      isToolEnabled('not-a-tool', { assistantDisabledNamespaces: [], assistantDisabledTools: [] })
    ).toBe(false)
  })

  test('getToolNamespace and getToolsByNamespace', () => {
    expect(getToolNamespace('@query/run')).toBe('query')
    expect(getToolNamespace('invalid')).toBeNull()
    expect(getToolsByNamespace('query').length).toBeGreaterThan(0)
  })

  test('applyToolPattern disables all tools with *', () => {
    const prefs = applyToolPattern(
      { assistantDisabledNamespaces: [], assistantDisabledTools: [] },
      '*',
      false
    )
    expect(prefs.assistantDisabledNamespaces).toHaveLength(ASSISTANT_TOOL_NAMESPACES.length)
  })

  test('applyToolPattern enables all tools with *', () => {
    const disabled = applyToolPattern(
      { assistantDisabledNamespaces: ['query'], assistantDisabledTools: ['@query/run'] },
      '*',
      true
    )
    expect(disabled.assistantDisabledNamespaces).toHaveLength(0)
    expect(disabled.assistantDisabledTools).toHaveLength(0)
  })

  test('applyToolPattern enables and disables individual tools', () => {
    const disabled = applyToolPattern(
      { assistantDisabledNamespaces: [], assistantDisabledTools: [] },
      '@query/set-options',
      false
    )
    expect(isToolEnabled('@query/set-options', disabled)).toBe(false)

    const enabled = applyToolPattern(disabled, '@query/set-options', true)
    expect(isToolEnabled('@query/set-options', enabled)).toBe(true)
  })

  test('applyToolPattern re-enables namespace while keeping sibling tools disabled', () => {
    const prefs = applyToolPattern(
      { assistantDisabledNamespaces: ['query'], assistantDisabledTools: [] },
      '@query/set-options',
      true
    )
    expect(prefs.assistantDisabledNamespaces).not.toContain('query')
    expect(isToolEnabled('@query/set-options', prefs)).toBe(true)
  })

  test('getAssistantToolPrefsSummary reports counts', () => {
    const prefs: AssistantToolPrefs = {
      assistantDisabledNamespaces: [],
      assistantDisabledTools: [],
    }
    const summary = getAssistantToolPrefsSummary(prefs)
    expect(summary.totalCount).toBe(ASSISTANT_TOOL_CATALOG.length)
    expect(summary.enabledCount).toBe(summary.totalCount)
    expect(summary.enabledTools.length).toBeGreaterThan(0)
  })

  test('isDynamicMethodToolName recognizes catalog method tools', () => {
    expect(isDynamicMethodToolName('@dataclass/User/searchByDescription')).toBe(true)
    expect(isDynamicMethodToolName('@dataclass/User/Entity/greet')).toBe(true)
    expect(isDynamicMethodToolName('@datastore/methods/backup')).toBe(true)
    expect(isDynamicMethodToolName('@datastore/singletons/App/init')).toBe(true)
    expect(isDynamicMethodToolName('@datastore/query')).toBe(false)
    expect(isDynamicMethodToolName('@query/run')).toBe(false)
  })

  test('parseToolPattern accepts dynamic method tools', () => {
    expect(parseToolPattern('@dataclass/User/searchByDescription')).toEqual({
      type: 'tool',
      toolName: '@dataclass/User/searchByDescription',
      namespace: 'dataclass',
    })
  })

  test('applyToolPattern disables and enables dynamic method tools', () => {
    const disabled = applyToolPattern(
      { assistantDisabledNamespaces: [], assistantDisabledTools: [] },
      '@dataclass/User/searchByDescription',
      false
    )
    expect(isToolEnabled('@dataclass/User/searchByDescription', disabled)).toBe(false)

    const enabled = applyToolPattern(disabled, '@dataclass/User/searchByDescription', true)
    expect(isToolEnabled('@dataclass/User/searchByDescription', enabled)).toBe(true)
  })
})
