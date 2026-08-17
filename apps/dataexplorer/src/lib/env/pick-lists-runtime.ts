import { api } from '~/lib/api'
import {
  collectInlineListRefs,
  createPickListValuesCache,
  PICK_LIST_DEFAULT_LIMIT,
  type PickListDistinctLoader,
  stringifyDistinctValue,
} from '~/lib/env'
import { getCurrentBaseId } from '~/lib/storage'
import { useListsStore } from '~/store/lists'

const inlineListValuesCache = createPickListValuesCache()

function inlineListCacheId(ref: { key: string; top?: number; entitySetId?: string }): string {
  return `${ref.key}\0${ref.top ?? PICK_LIST_DEFAULT_LIMIT}\0${ref.entitySetId ?? ''}`
}

/** Loader used by ensurePickLists — kept outside the store to avoid api↔store cycles. */
export const loadPickListDistinctValues: PickListDistinctLoader = async ({
  dataclass,
  attribute,
  top,
  entitySetId,
}) => {
  let raw: unknown[] = []
  try {
    const result = await api.getDistinctValues({
      dataclass,
      attribute,
      top,
      ...(entitySetId ? { entitySetId } : {}),
    })
    raw = result.values
  } catch {
    raw = []
  }

  let values = distinctValueStrings(raw, attribute)
  if (values.length === 0) {
    values = await loadDistinctFromEntities({ dataclass, attribute, top, entitySetId })
  }
  return {
    values,
    truncated: values.length >= top,
  }
}

function distinctValueStrings(raw: readonly unknown[], attribute: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const text = stringifyDistinctValue(item, attribute)
    if (text == null || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

async function loadDistinctFromEntities(params: {
  dataclass: string
  attribute: string
  top: number
  entitySetId?: string
}): Promise<string[]> {
  try {
    const page = await api.getEntities(params.dataclass, {
      top: params.top,
      select: [params.attribute],
      createEntitySet: false,
      ...(params.entitySetId ? { entitySetId: params.entitySetId } : {}),
    })
    return distinctValueStrings(page.entities, params.attribute)
  } catch {
    return []
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

  const baseId = getCurrentBaseId() ?? ''
  const results = await Promise.allSettled(
    refs.map(async (ref) => {
      const top = ref.top ?? PICK_LIST_DEFAULT_LIMIT
      const result = await inlineListValuesCache.ensure(
        baseId,
        inlineListCacheId(ref),
        {
          dataclass: ref.dataclass,
          attribute: ref.attribute,
          top,
          ...(ref.entitySetId ? { entitySetId: ref.entitySetId } : {}),
        },
        loadPickListDistinctValues
      )
      return { key: ref.key, values: result.values }
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
