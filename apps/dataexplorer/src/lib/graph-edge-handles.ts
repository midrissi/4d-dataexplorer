export type HandleSide = 'left' | 'right'

export type NodeRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Pick source/target left|right handles so the orthogonal path faces the other
 * node. Comparing only left-edge X ties (or near-ties) when cards are stacked
 * vertically and wrongly defaults both sides to "right", wrapping around the
 * source card — e.g. Car.ID_color → Color while Color sits below/left of Car.
 */
export function pickEdgeHandleSides(
  source: NodeRect,
  target: NodeRect
): { sourceSide: HandleSide; targetSide: HandleSide } {
  const sourceMidY = source.y + source.height / 2
  const targetMidY = target.y + target.height / 2
  const sourceCenterX = source.x + source.width / 2

  let best: { sourceSide: HandleSide; targetSide: HandleSide; dist: number } | null = null

  for (const sourceSide of ['left', 'right'] as const) {
    for (const targetSide of ['left', 'right'] as const) {
      const sx = sourceSide === 'left' ? source.x : source.x + source.width
      const tx = targetSide === 'left' ? target.x : target.x + target.width
      let dist = Math.abs(sx - tx) + Math.abs(sourceMidY - targetMidY)

      // Strongly prefer exiting toward the target instead of wrapping behind the source card.
      const exitsAwayFromTarget =
        (sourceSide === 'right' && tx < sourceCenterX) ||
        (sourceSide === 'left' && tx > sourceCenterX)
      if (exitsAwayFromTarget) {
        dist += source.width
      }

      if (!best || dist < best.dist) {
        best = { sourceSide, targetSide, dist }
      }
    }
  }

  return {
    sourceSide: best?.sourceSide ?? 'right',
    targetSide: best?.targetSide ?? 'left',
  }
}
