import type { PickListValuesState } from '~/lib/env'

export function formatListValuesPreview(state: PickListValuesState): string | null {
  if (state.status !== 'ready') return null
  const extra = state.values.length - 4
  const head = state.values.slice(0, 4).join(', ')
  return extra > 0 ? `${head}, …(+${extra})` : head
}
