import { describe, expect, test } from 'bun:test'
import { applyAttributeInsertText, measureSuggestionPlacement } from './AttributePathInput'

describe('applyAttributeInsertText', () => {
  test('replaces a partial root segment', () => {
    expect(applyAttributeInsertText('fir', 3, 'firstName')).toEqual({
      value: 'firstName',
      cursor: 'firstName'.length,
    })
  })

  test('replaces a partial segment after a relation', () => {
    expect(applyAttributeInsertText('user.fir', 8, 'firstName')).toEqual({
      value: 'user.firstName',
      cursor: 'user.firstName'.length,
    })
  })

  test('appends after a trailing dot for relation drill-down', () => {
    expect(applyAttributeInsertText('user.', 5, 'firstName')).toEqual({
      value: 'user.firstName',
      cursor: 'user.firstName'.length,
    })
  })
})

describe('measureSuggestionPlacement', () => {
  test('opens below when there is enough space', () => {
    const placement = measureSuggestionPlacement(
      { top: 100, bottom: 132, left: 40, width: 200 },
      800
    )
    expect(placement.side).toBe('bottom')
    expect(placement.top).toBe(136)
  })

  test('opens above when the bottom of the viewport is tight', () => {
    const placement = measureSuggestionPlacement(
      { top: 700, bottom: 732, left: 40, width: 200 },
      800
    )
    expect(placement.side).toBe('top')
    expect(placement.top).toBe(696)
    expect(placement.maxHeight).toBeLessThanOrEqual(700 - 8)
  })
})
