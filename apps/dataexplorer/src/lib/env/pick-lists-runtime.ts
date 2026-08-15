import { api } from '~/lib/api'
import { PICK_LIST_TOP, type PickListDistinctLoader, stringifyDistinctValue } from '~/lib/env'
import { useEnvironmentsStore } from '~/store/environments'

/** Loader used by ensurePickLists — kept outside the store to avoid api↔store cycles. */
export const loadPickListDistinctValues: PickListDistinctLoader = async ({
  dataclass,
  attribute,
  top,
}) => {
  const result = await api.getDistinctValues({
    dataclass,
    attribute,
    top: top ?? PICK_LIST_TOP,
  })
  const values: string[] = []
  for (const raw of result.values) {
    const text = stringifyDistinctValue(raw)
    if (text != null) values.push(text)
  }
  return {
    values,
    truncated: result.values.length >= (top ?? PICK_LIST_TOP),
  }
}

/** Ensure named `$lists` are loaded for the current database. */
export function ensureCurrentPickLists(names: readonly string[]) {
  return useEnvironmentsStore.getState().ensurePickLists(names, loadPickListDistinctValues)
}
