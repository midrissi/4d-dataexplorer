export function parseQueryArgs(args: Record<string, unknown>) {
  const filterParams = Array.isArray(args.filterParams)
    ? args.filterParams.map((value) => {
        if (value != null && typeof value === 'object' && !Array.isArray(value)) {
          const obj = value as Record<string, unknown>
          const raw = obj.value
          const type =
            typeof obj.type === 'string'
              ? obj.type
              : typeof raw === 'number'
                ? 'number'
                : typeof raw === 'boolean'
                  ? 'boolean'
                  : Array.isArray(raw) || (raw != null && typeof raw === 'object')
                    ? 'json'
                    : 'string'
          return {
            type,
            value: raw == null ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw),
          }
        }
        // Nested arrays for ORDA `in :1` (e.g. filterParams: [[9, 13, 4]])
        if (Array.isArray(value)) {
          return { type: 'json', value: JSON.stringify(value) }
        }
        return {
          type:
            typeof value === 'number'
              ? 'number'
              : typeof value === 'boolean'
                ? 'boolean'
                : 'string',
          value: String(value),
        }
      })
    : undefined

  return {
    dataClass: String(args.dataClass ?? args.dataclassName ?? ''),
    filter: typeof args.filter === 'string' ? args.filter : undefined,
    filterParams,
    sort: typeof args.sort === 'string' ? args.sort : undefined,
    order: args.order === 'asc' ? ('asc' as const) : ('desc' as const),
    top:
      typeof args.top === 'number'
        ? args.top
        : typeof args.limit === 'number'
          ? args.limit
          : undefined,
    page: typeof args.page === 'number' ? args.page : undefined,
    // `attributes` is preferred ($attributes); `select` kept as alias for older prompts.
    select: (() => {
      const attrs = Array.isArray(args.attributes)
        ? args.attributes.map(String)
        : Array.isArray(args.select)
          ? args.select.map(String)
          : undefined
      return attrs
    })(),
    expand: Array.isArray(args.expand) ? args.expand.map(String) : undefined,
  }
}

export function resolveCreateMode(
  args: Record<string, unknown>
):
  | { mode: 'single'; data: Record<string, unknown> }
  | { mode: 'many'; entities: Record<string, unknown>[] }
  | { error: string } {
  const entities = args.entities
  if (Array.isArray(entities)) {
    if (entities.length === 0) return { error: 'entities must be a non-empty array' }
    return { mode: 'many', entities: entities as Record<string, unknown>[] }
  }

  if (args.data != null && typeof args.data === 'object' && !Array.isArray(args.data)) {
    return { mode: 'single', data: args.data as Record<string, unknown> }
  }

  return { error: 'Provide data (one entity) or entities (array of records)' }
}

export function resolveUpdateMode(
  args: Record<string, unknown>
):
  | { mode: 'single'; key: string; data: Record<string, unknown> }
  | { mode: 'many'; entities: Record<string, unknown>[] }
  | { error: string } {
  const entities = args.entities
  if (Array.isArray(entities)) {
    if (entities.length === 0) return { error: 'entities must be a non-empty array' }
    return { mode: 'many', entities: entities as Record<string, unknown>[] }
  }

  const key = typeof args.key === 'string' ? args.key.trim() : ''
  if (key && args.data != null && typeof args.data === 'object' && !Array.isArray(args.data)) {
    return { mode: 'single', key, data: args.data as Record<string, unknown> }
  }

  return { error: 'Provide key+data (one entity) or entities (array with __KEY/__STAMP)' }
}

export function resolveDeleteMode(args: Record<string, unknown>):
  | { mode: 'single'; key: string }
  | {
      mode: 'many'
      dataClass: string
      parsed: ReturnType<typeof parseQueryArgs>
      entitySetId?: string
    }
  | { error: string } {
  const key = typeof args.key === 'string' ? args.key.trim() : ''
  if (key) return { mode: 'single', key }

  const dataClass = String(args.dataClass ?? '').trim()
  if (!dataClass) return { error: 'dataClass is required' }

  const parsed = parseQueryArgs(args)
  const entitySetId =
    typeof args.entitySetId === 'string' && args.entitySetId.trim()
      ? args.entitySetId.trim()
      : undefined

  return { mode: 'many', dataClass, parsed, entitySetId }
}
