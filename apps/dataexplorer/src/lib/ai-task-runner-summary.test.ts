import { describe, expect, it } from 'bun:test'
import {
  compactResultValue,
  formatToolResultSummary,
  resolveAiTaskResultValue,
} from './ai-task-runner'

describe('compactResultValue', () => {
  it('keeps leaf labels and numbers at widget nesting depth', () => {
    const widget = {
      widget: {
        title: 'Color Distribution Over Cars',
        data: {
          type: 'pie',
          values: [
            { label: 'Color 1', value: 2161 },
            { label: 'Color 2', value: 2159 },
          ],
        },
      },
    }
    const compacted = compactResultValue(widget) as typeof widget
    expect(compacted.widget.data.values[0]).toEqual({ label: 'Color 1', value: 2161 })
    expect(compacted.widget.data.values[1]).toEqual({ label: 'Color 2', value: 2159 })
  })

  it('keeps all pie slices when under the array limit', () => {
    const values = Array.from({ length: 14 }, (_, i) => ({
      label: `Color ${i + 1}`,
      value: 2000 + i,
    }))
    const compacted = compactResultValue({ widget: { data: { values } } }) as {
      widget: { data: { values: unknown[] } }
    }
    expect(compacted.widget.data.values).toHaveLength(14)
    expect(compacted.widget.data.values[13]).toEqual({ label: 'Color 14', value: 2013 })
  })
})

describe('formatToolResultSummary', () => {
  it('preserves full widget payload in the result summary', () => {
    const result = {
      widget: {
        title: 'Color Distribution Over Cars',
        data: {
          type: 'pie',
          values: Array.from({ length: 14 }, (_, i) => ({
            label: `Color ${i + 1}`,
            value: 2100 + i,
          })),
        },
      },
    }
    const summary = formatToolResultSummary(result)
    expect(summary).toBeDefined()
    if (summary === undefined) throw new Error('expected summary')
    const parsed = JSON.parse(summary) as typeof result
    expect(parsed.widget.data.values).toHaveLength(14)
    expect(parsed.widget.data.values[0]).toEqual({ label: 'Color 1', value: 2100 })
    expect(parsed.widget.data.values[13]).toEqual({ label: 'Color 14', value: 2113 })
    expect(summary).not.toContain('"…"')
  })
})

describe('resolveAiTaskResultValue', () => {
  it('returns the full widget tool result without compaction', () => {
    const widgetResult = {
      widget: {
        title: 'Color Distribution Over Cars',
        data: {
          type: 'pie',
          values: Array.from({ length: 14 }, (_, i) => ({
            label: `Color ${i + 1}`,
            value: 2100 + i,
          })),
        },
      },
    }
    const value = resolveAiTaskResultValue(
      'ask',
      [
        {
          id: '1',
          kind: 'tool',
          name: '@widgets/render',
          args: {},
          status: 'done',
          result: widgetResult,
        },
      ],
      ''
    )
    expect(value).toEqual(widgetResult)
  })
})
