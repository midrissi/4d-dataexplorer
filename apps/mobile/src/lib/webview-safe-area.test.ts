import { describe, expect, it } from 'bun:test'
import { computeKeyboardOverlap } from './webview-safe-area'

describe('computeKeyboardOverlap', () => {
  it('returns 0 when the visual viewport fills the layout viewport', () => {
    expect(computeKeyboardOverlap(800, 800, 0)).toBe(0)
  })

  it('returns the keyboard height when the visual viewport shrinks', () => {
    expect(computeKeyboardOverlap(800, 500, 0)).toBe(300)
  })

  it('subtracts visualViewport.offsetTop (iOS focus pan)', () => {
    expect(computeKeyboardOverlap(800, 500, 40)).toBe(260)
  })

  it('never returns a negative inset', () => {
    expect(computeKeyboardOverlap(500, 800, 0)).toBe(0)
  })
})
