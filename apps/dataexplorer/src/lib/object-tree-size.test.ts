import { describe, expect, test } from 'bun:test'
import {
  countObjectTreeNodes,
  EXPAND_ALL_MAX_NODES,
  isObjectTreeTooLarge,
} from './object-tree-size'

describe('object-tree-size', () => {
  test('counts primitives and nested objects', () => {
    expect(countObjectTreeNodes(1)).toBe(1)
    expect(countObjectTreeNodes({ a: 1, b: { c: 2 } })).toBe(4)
  })

  test('stops at limit for large arrays', () => {
    const big = Array.from({ length: 500 }, (_, i) => i)
    expect(countObjectTreeNodes(big, 10)).toBe(10)
    expect(isObjectTreeTooLarge(big, 50)).toBe(true)
    expect(isObjectTreeTooLarge({ a: 1 }, EXPAND_ALL_MAX_NODES)).toBe(false)
  })
})
