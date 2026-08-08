import type { LayoutPoint } from './layout-point'

export function getRoutedEdgePath(points: LayoutPoint[]): {
  path: string
  labelX: number
  labelY: number
} {
  const normalized: LayoutPoint[] = []
  for (const point of points) {
    const previous = normalized[normalized.length - 1]
    const next = {
      x: previous && Math.abs(point.x - previous.x) < 0.01 ? previous.x : point.x,
      y: previous && Math.abs(point.y - previous.y) < 0.01 ? previous.y : point.y,
    }
    if (!previous || next.x !== previous.x || next.y !== previous.y) {
      normalized.push(next)
    }
  }

  const deduped = normalized.filter((point, index) => {
    if (index === 0 || index === normalized.length - 1) return true
    const previous = normalized[index - 1]
    const next = normalized[index + 1]
    const isVertical = previous.x === point.x && point.x === next.x
    const isHorizontal = previous.y === point.y && point.y === next.y
    return !isVertical && !isHorizontal
  })

  const pathParts = [`M ${deduped[0]?.x ?? 0} ${deduped[0]?.y ?? 0}`]
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = deduped[index - 1]
    const corner = deduped[index]
    const next = deduped[index + 1]
    const incomingLength = Math.hypot(corner.x - previous.x, corner.y - previous.y)
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y)
    const radius = Math.min(5, incomingLength / 2, outgoingLength / 2)
    const before = {
      x: corner.x - ((corner.x - previous.x) / incomingLength) * radius,
      y: corner.y - ((corner.y - previous.y) / incomingLength) * radius,
    }
    const after = {
      x: corner.x + ((next.x - corner.x) / outgoingLength) * radius,
      y: corner.y + ((next.y - corner.y) / outgoingLength) * radius,
    }
    pathParts.push(`L ${before.x} ${before.y}`, `Q ${corner.x} ${corner.y} ${after.x} ${after.y}`)
  }
  const lastPoint = deduped[deduped.length - 1]
  if (lastPoint) {
    pathParts.push(`L ${lastPoint.x} ${lastPoint.y}`)
  }
  const path = pathParts.join(' ')

  let totalLength = 0
  const lengths: number[] = []
  for (let index = 1; index < deduped.length; index += 1) {
    const previous = deduped[index - 1]
    const current = deduped[index]
    const length = Math.hypot(current.x - previous.x, current.y - previous.y)
    lengths.push(length)
    totalLength += length
  }

  const halfway = totalLength / 2
  let traversed = 0
  let labelX = deduped[0]?.x ?? 0
  let labelY = deduped[0]?.y ?? 0
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]
    if (traversed + length >= halfway) {
      const start = deduped[index]
      const end = deduped[index + 1]
      const ratio = length === 0 ? 0 : (halfway - traversed) / length
      labelX = start.x + (end.x - start.x) * ratio
      labelY = start.y + (end.y - start.y) * ratio
      break
    }
    traversed += length
  }

  return { path, labelX, labelY }
}
