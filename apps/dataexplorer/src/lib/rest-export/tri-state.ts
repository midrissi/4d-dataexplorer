export type TriState = boolean | 'indeterminate'

export function triState(activeCount: number, total: number): TriState {
  if (total <= 0 || activeCount <= 0) return false
  if (activeCount >= total) return true
  return 'indeterminate'
}

/** Next click on a tri-state control: all → none, otherwise → all. */
export function triStateSelectsAll(state: TriState): boolean {
  return state !== true
}
