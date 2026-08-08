import { describe, expect, test } from 'bun:test'
import { getRoutedEdgePath } from './get-routed-edge-path'

describe('getRoutedEdgePath', () => {
  test('builds an SVG path starting with M and places the label near the midpoint', () => {
    const result = getRoutedEdgePath([
      { x: 0, y: 0 },
      { x: 100, y: 40 },
    ])

    expect(result.path.startsWith('M ')).toBe(true)
    expect(result.labelX).toBeCloseTo(50, 5)
    expect(result.labelY).toBeCloseTo(20, 5)
  })
})
