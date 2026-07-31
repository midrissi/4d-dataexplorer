export type TerminalHistoryDirection = 'previous' | 'next'

export function terminalHistoryDirectionFromSwipe(
  startY: number,
  endY: number,
  threshold = 24
): TerminalHistoryDirection | null {
  const distance = endY - startY
  if (Math.abs(distance) < threshold) return null
  return distance < 0 ? 'previous' : 'next'
}
