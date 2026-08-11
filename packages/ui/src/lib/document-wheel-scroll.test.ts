import { describe, expect, it } from 'bun:test'
import {
  applyWheelDeltaToScrollTop,
  pointInRect,
  shouldHandleDocumentWheelScroll,
} from './document-wheel-scroll'

describe('pointInRect', () => {
  const rect = { left: 10, right: 50, top: 20, bottom: 80 }

  it('includes edges', () => {
    expect(pointInRect(10, 20, rect)).toBe(true)
    expect(pointInRect(50, 80, rect)).toBe(true)
  })

  it('rejects outside points', () => {
    expect(pointInRect(9, 40, rect)).toBe(false)
    expect(pointInRect(30, 19, rect)).toBe(false)
  })
})

describe('shouldHandleDocumentWheelScroll', () => {
  function mockBox(rect: { left: number; right: number; top: number; bottom: number }) {
    return {
      contains() {
        return false
      },
      getBoundingClientRect() {
        return rect
      },
    } as unknown as HTMLElement
  }

  it('handles when pointer is over hit root bounds', () => {
    const scrollEl = mockBox({ left: 0, right: 1, top: 0, bottom: 1 })
    const hitRoot = mockBox({ left: 100, right: 300, top: 100, bottom: 300 })

    expect(
      shouldHandleDocumentWheelScroll({
        scrollEl,
        hitRoot,
        event: { clientX: 150, clientY: 150, target: null },
        includeFocusedTextControl: false,
      })
    ).toBe(true)

    expect(
      shouldHandleDocumentWheelScroll({
        scrollEl,
        hitRoot,
        event: { clientX: 10, clientY: 10, target: null },
        includeFocusedTextControl: false,
      })
    ).toBe(false)
  })
})

describe('applyWheelDeltaToScrollTop', () => {
  it('updates scrollTop when content overflows', () => {
    const el = {
      scrollHeight: 500,
      clientHeight: 100,
      scrollTop: 0,
    } as HTMLElement

    expect(applyWheelDeltaToScrollTop(el, 40)).toBe(true)
    expect(el.scrollTop).toBe(40)
    expect(applyWheelDeltaToScrollTop(el, 0)).toBe(false)
    expect(applyWheelDeltaToScrollTop(el, 9999)).toBe(true)
    expect(el.scrollTop).toBe(400)
  })

  it('no-ops when content fits', () => {
    const el = {
      scrollHeight: 100,
      clientHeight: 100,
      scrollTop: 0,
    } as HTMLElement
    expect(applyWheelDeltaToScrollTop(el, 40)).toBe(false)
  })
})
