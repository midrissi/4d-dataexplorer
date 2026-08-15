import { api } from '~/lib/api'
import {
  collectInlineListRefs,
  PICK_LIST_DEFAULT_LIMIT,
  type PickListDistinctLoader,
  stringifyDistinctValue,
} from '~/lib/env'
import { useListsStore } from '~/store/lists'

/** Loader used by ensurePickLists — kept outside the store to avoid api↔store cycles. */
export const loadPickListDistinctValues: PickListDistinctLoader = async ({
  dataclass,
  attribute,
  top,
  entitySetId,
}) => {
  const result = await api.getDistinctValues({
    dataclass,
    attribute,
    top,
    ...(entitySetId ? { entitySetId } : {}),
  })
  const values: string[] = []
  for (const raw of result.values) {
    const text = stringifyDistinctValue(raw)
    if (text != null) values.push(text)
  }
  return {
    values,
    truncated: result.values.length >= top,
  }
}

/** Ensure named `$lists` are loaded across merged scopes. */
export function ensureCurrentPickLists(names: readonly string[]) {
  return useListsStore.getState().ensurePickLists(names, loadPickListDistinctValues)
}

/**
 * Load distinct values for inline `Dataclass.Attribute` references found in
 * template text(s) and return a map ready to merge into `ResolveEnvOptions.lists`.
 *
 * Usage:
 *   const inlineLists = await loadInlineListRefs(['{{$pick | from:Employee.ID}}'])
 *   resolveEnvTemplates(text, map, { lists: { ...namedLists, ...inlineLists } })
 */
export async function loadInlineListRefs(
  texts: readonly string[]
): Promise<Record<string, readonly string[]>> {
  const refs = collectInlineListRefs(texts)
  if (refs.length === 0) return {}

  const results = await Promise.allSettled(
    refs.map(async (ref) => {
      const top = ref.top ?? PICK_LIST_DEFAULT_LIMIT
      const result = await api.getDistinctValues({
        dataclass: ref.dataclass,
        attribute: ref.attribute,
        top,
        ...(ref.entitySetId ? { entitySetId: ref.entitySetId } : {}),
      })
      const values: string[] = []
      for (const raw of result.values) {
        const text = stringifyDistinctValue(raw)
        if (text != null) values.push(text)
      }
      return { key: ref.key, values }
    })
  )

  const out: Record<string, readonly string[]> = {}
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.values.length > 0) {
      out[result.value.key] = result.value.values
    }
  }
  return out
}
