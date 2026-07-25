import { describe, expect, test } from 'bun:test'
import { pickEdgeHandleSides } from './graph-edge-handles'

describe('pickEdgeHandleSides', () => {
  test('exits left toward a target below-left instead of wrapping around the source', () => {
    // Car (source) top-right; Color (target) bottom-left — same left-edge X would
    // previously force both handles to the right and route behind Car.
    const car = { x: 400, y: 40, width: 320, height: 360 }
    const color = { x: 400, y: 480, width: 260, height: 140 }

    expect(pickEdgeHandleSides(car, color)).toEqual({
      sourceSide: 'left',
      targetSide: 'left',
    })
  })

  test('exits left when target is clearly to the left (Agency case)', () => {
    const car = { x: 420, y: 40, width: 320, height: 360 }
    const agency = { x: 40, y: 40, width: 280, height: 260 }

    expect(pickEdgeHandleSides(car, agency)).toEqual({
      sourceSide: 'left',
      targetSide: 'right',
    })
  })

  test('exits right when target is clearly to the right', () => {
    const car = { x: 40, y: 40, width: 320, height: 360 }
    const model = { x: 480, y: 40, width: 280, height: 220 }

    expect(pickEdgeHandleSides(car, model)).toEqual({
      sourceSide: 'right',
      targetSide: 'left',
    })
  })

  test('uses left when target is slightly left but left-edges nearly tie', () => {
    const car = { x: 400, y: 40, width: 320, height: 360 }
    const color = { x: 390, y: 500, width: 260, height: 140 }

    const sides = pickEdgeHandleSides(car, color)
    expect(sides.sourceSide).toBe('left')
  })
})
