import { describe, expect, it } from 'bun:test'
import { countEntityFields } from './stats'

describe('countEntityFields', () => {
  it('counts scalar object fields at depth 0', () => {
    expect(countEntityFields({ a: 1, b: 2 })).toEqual({ fields: 2, depth: 0 })
  })

  it('counts nested objects and depth', () => {
    expect(countEntityFields({ a: 1, nested: { b: 2, c: { d: 3 } } })).toEqual({
      fields: 5,
      depth: 2,
    })
  })
})
