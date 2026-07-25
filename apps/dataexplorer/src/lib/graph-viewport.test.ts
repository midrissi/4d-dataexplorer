import { describe, expect, test } from 'bun:test'
import {
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  isGraphViewportValid,
  normalizeGraphViewport,
} from './graph-viewport'

describe('graph-viewport', () => {
  test('normalizeGraphViewport clamps zoom and replaces non-finite values', () => {
    expect(normalizeGraphViewport({ x: 10, y: -20, zoom: 5 })).toEqual({
      x: 10,
      y: -20,
      zoom: GRAPH_MAX_ZOOM,
    })
    expect(normalizeGraphViewport({ x: Number.NaN, y: 0, zoom: 0 })).toEqual({
      x: 0,
      y: 0,
      zoom: GRAPH_MIN_ZOOM,
    })
  })

  test('isGraphViewportValid rejects invalid viewports', () => {
    expect(isGraphViewportValid({ x: 0, y: 0, zoom: 1 })).toBe(true)
    expect(isGraphViewportValid({ x: 0, y: 0, zoom: 0.05 })).toBe(false)
    expect(isGraphViewportValid({ x: Number.NaN, y: 0, zoom: 1 })).toBe(false)
    expect(isGraphViewportValid(undefined)).toBe(false)
  })
})
